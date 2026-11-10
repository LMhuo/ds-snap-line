/**
 * Photo folder helpers for SnapLine.
 *
 * These functions are plain Node.js (no Cordis, no DOM) so they can be tested
 * on their own: the Host half only has to wire them to a route.
 */
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'

/** Browser-facing base path for the photo manifest and the images. */
export const ROUTE = '/dsh-snap-line'

/** Exact path the Client half posts photo-manager writes to. */
export const MANAGE_PATH = `${ROUTE}/manage`

/** Largest original photo accepted by the photo manager, in bytes. */
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024

/** Largest accepted photo by pixel count (64 megapixels). */
export const MAX_PHOTO_PIXELS = 64_000_000

/** Longest accepted file name, in characters including the extension. */
const MAX_PHOTO_NAME_LENGTH = 120

/** One message for every rejected photo name, kept in step with the limit above. */
const INVALID_NAME_MESSAGE = 'Photo names must be plain file names without path separators, '
  + `a leading dot, control characters, or more than ${MAX_PHOTO_NAME_LENGTH} characters.`

/** Largest JSON body accepted by the photo manager's non-upload actions. */
const MAX_MANAGE_JSON_BYTES = 64 * 1024

/** Number of leading photos that actually hang on the rope. */
export const MAX_ON_ROPE = 6

/**
 * Photo folder inside the DeepSeek Harness home: `$DSH_HOME/dsh-snap-line/photos`,
 * or `~/.dsh/dsh-snap-line/photos` when `DSH_HOME` is missing, blank, or padded
 * with whitespace. A leading `~` / `~/…` in `DSH_HOME` expands to the user's
 * home, and the result is always absolute, matching `dsh-home-paths`.
 */
export function photoFolder(env = process.env, home = homedir()) {
  const configured = env.DSH_HOME
  const usable = typeof configured === 'string'
    && configured.length > 0
    && configured === configured.trim()
  const root = usable ? expandHome(configured, home) : join(home, '.dsh')
  return resolve(root, 'dsh-snap-line', 'photos')
}

/** `~` and `~/…` expand to the user's home; everything else is used as written. */
function expandHome(value, home) {
  if (value === '~') return home
  if (value.startsWith('~/') || value.startsWith('~\\')) return join(home, value.slice(2))
  return value
}

/* --- Supported image formats --------------------------------------------- */

/**
 * The single registry of supported image formats: every media decision
 * (extension, magic bytes, pixel dimensions, accepted Content-Type) reads from
 * this map instead of keeping parallel lists.
 */
const IMAGE_FORMATS = new Map([
  ['image/jpeg', {
    extensions: ['jpg', 'jpeg'],
    matchesMagic: (bytes) => bytes.length >= 3
      && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    dimensions: jpegDimensions,
  }],
  ['image/png', {
    extensions: ['png'],
    matchesMagic: (bytes) => bytes.length >= 8
      && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a,
    dimensions: pngDimensions,
  }],
  ['image/gif', {
    extensions: ['gif'],
    matchesMagic: (bytes) => asciiAt(bytes, 0, 'GIF87a') || asciiAt(bytes, 0, 'GIF89a'),
    dimensions: gifDimensions,
  }],
  ['image/webp', {
    extensions: ['webp'],
    matchesMagic: (bytes) => bytes.length >= 12 && asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WEBP'),
    dimensions: webpDimensions,
  }],
  ['image/avif', {
    extensions: ['avif'],
    matchesMagic: (bytes) => bytes.length >= 12 && asciiAt(bytes, 4, 'ftyp')
      && (asciiAt(bytes, 8, 'avif') || asciiAt(bytes, 8, 'avis')),
    dimensions: avifDimensions,
  }],
])

const EXTENSIONS_BY_MEDIA_TYPE = [...IMAGE_FORMATS]
  .flatMap(([mediaType, format]) => format.extensions.map((extension) => [extension, mediaType]))

/** Image extensions served from the photo folder (with the dot), mapped to their media type. */
export const MEDIA_TYPES = new Map(EXTENSIONS_BY_MEDIA_TYPE.map(([extension, mediaType]) => [`.${extension}`, mediaType]))

/** Image extensions accepted by the write side (without the dot), mapped to their media type. */
const MEDIA_TYPES_BY_EXTENSION = new Map(EXTENSIONS_BY_MEDIA_TYPE)

/** Media types the write side accepts, derived from the one registry. */
const ACCEPTED_MEDIA_TYPES = new Set(IMAGE_FORMATS.keys())

/**
 * Media-type aliases browsers and upload tools send for the formats above.
 * They are normalized before validation, then compared as canonical types.
 */
const CONTENT_TYPE_ALIASES = new Map([
  ['image/jpg', 'image/jpeg'],
  ['image/pjpeg', 'image/jpeg'],
  ['image/x-jpeg', 'image/jpeg'],
  ['image/x-png', 'image/png'],
  ['image/x-webp', 'image/webp'],
])

function notFound() {
  return new Response(null, { status: 404 })
}

/** One photo entry's original-image URL, versioned by mtime so replacements are not cached. */
export function photoUrl(name, mtimeMs) {
  return `${ROUTE}/photos/${encodeURIComponent(name)}?v=${Math.round(mtimeMs)}`
}

/** Display copy for `name`, stored under the hidden `.display/` folder. */
export function displayFileName(name) {
  return `${createHash('sha1').update(name).digest('hex')}.jpg`
}

/** Browser URL for a photo's display copy, versioned by its own mtime. */
export function displayPhotoUrl(name, mtimeMs) {
  return `${ROUTE}/display/${encodeURIComponent(name)}?v=${Math.round(mtimeMs)}`
}

/**
 * A display copy is only usable when it is a complete JPEG (SOI at the start,
 * EOI at the end) and at least as new as the original it was made from. A
 * missing, truncated, corrupt, or stale copy counts as absent, so the manifest
 * falls back to the original and the manager backfills a fresh copy.
 */
async function displayCopyMtime(dir, name, originalMtimeMs) {
  const path = join(dir, '.display', displayFileName(name))
  try {
    const info = await stat(path)
    if (!info.isFile() || info.mtimeMs < originalMtimeMs) return null
    return await isCompleteJpeg(path, info.size) ? info.mtimeMs : null
  } catch {
    return null
  }
}

/** SOI at the start and EOI at the end, without reading the whole file. */
async function isCompleteJpeg(path, size) {
  if (!(size >= 5)) return false
  const handle = await open(path, 'r')
  try {
    const head = Buffer.alloc(3)
    const tail = Buffer.alloc(2)
    const [headRead, tailRead] = await Promise.all([
      handle.read(head, 0, head.length, 0),
      handle.read(tail, 0, tail.length, size - tail.length),
    ])
    return headRead.bytesRead === head.length
      && tailRead.bytesRead === tail.length
      && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
      && tail[0] === 0xff && tail[1] === 0xd9
  } finally {
    await handle.close()
  }
}

/* --- Photo order --------------------------------------------------------- */

/**
 * Hidden file holding the explicit photo order: a JSON array of file names,
 * e.g. `["holiday.jpg", "cat.png"]`. The first `MAX_ON_ROPE` names in the
 * resulting listing hang on the rope.
 */
export const ORDER_FILE = '.order.json'

/**
 * The explicit photo order recorded in `.order.json`, or `[]` when the file is
 * missing, unreadable, oversized or malformed. A damaged order file must never
 * break the listing: it simply falls back to natural filename order.
 */
export async function readOrder(dir) {
  let raw
  try {
    const info = await stat(join(dir, ORDER_FILE))
    if (!info.isFile() || info.size > MAX_MANAGE_JSON_BYTES) return []
    raw = await readFile(join(dir, ORDER_FILE), 'utf8')
  } catch {
    return []
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.filter((name) => typeof name === 'string')
}

/**
 * Pure ordering step: names present in `preferred` come first in that order,
 * then every remaining name keeps its natural order. Names that do not exist
 * and duplicate entries are skipped.
 */
export function applyPhotoOrder(sortedNames, preferred) {
  const remaining = new Set(sortedNames)
  const ordered = []
  for (const name of preferred) {
    if (remaining.delete(name)) ordered.push(name)
  }
  for (const name of sortedNames) {
    if (remaining.delete(name)) ordered.push(name)
  }
  return ordered
}

/** Persist an order atomically: hidden temp file first, then rename over `.order.json`. */
async function writeOrderAtomically(dir, names) {
  await writeAtomically(join(dir, ORDER_FILE), `${JSON.stringify(names)}\n`, { replace: true })
}

/**
 * Current photo folder contents as
 * `{ photos: [{ name, displayUrl, originalUrl, onRope }], revision }`.
 * Missing folder counts as empty; every photo's mtime, display-copy mtime and
 * the explicit order feed the revision.
 */
export async function listPhotos(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return { photos: [], revision: 'empty' }
    throw error
  }
  const photos = []
  for (const entry of entries) {
    if (!entry.isFile() && !entry.isSymbolicLink()) continue
    /* Hidden names (macOS `._*`, `.DS_Store`, dotfiles) never reach the manifest. */
    if (entry.name.startsWith('.')) continue
    if (!MEDIA_TYPES.has(extname(entry.name).toLowerCase())) continue
    const path = join(dir, entry.name)
    try {
      const info = await stat(path)
      if (!info.isFile()) continue
      photos.push({
        name: entry.name,
        mtimeMs: info.mtimeMs,
        displayMtimeMs: await displayCopyMtime(dir, entry.name, info.mtimeMs),
      })
    } catch {
      // Removed while listing.
    }
  }
  photos.sort((left, right) => left.name.localeCompare(right.name, 'en', { numeric: true }))
  const byName = new Map(photos.map((photo) => [photo.name, photo]))
  const ordered = applyPhotoOrder(photos.map((photo) => photo.name), await readOrder(dir))
    .map((name) => byName.get(name))
  const revision = createHash('sha1')
    .update(ordered
      .map((photo) => `${photo.name}\u0000${photo.mtimeMs}\u0000${photo.displayMtimeMs ?? ''}`)
      .join('\n'))
    .digest('hex')
    .slice(0, 12)
  return {
    photos: ordered.map(({ name, mtimeMs, displayMtimeMs }, index) => ({
      name,
      displayUrl: displayMtimeMs === null ? photoUrl(name, mtimeMs) : displayPhotoUrl(name, displayMtimeMs),
      originalUrl: photoUrl(name, mtimeMs),
      onRope: index < MAX_ON_ROPE,
    })),
    revision,
  }
}

/** Decode a route segment and reject traversal, hidden names and non-images. */
function photoName(encodedName) {
  let name
  try {
    name = decodeURIComponent(encodedName)
  } catch {
    return { error: new Response(null, { status: 400 }) }
  }
  if (name.includes('/') || name.includes('\\') || name.startsWith('.')) return { error: notFound() }
  const mediaType = MEDIA_TYPES.get(extname(name).toLowerCase())
  if (mediaType === undefined) return { error: notFound() }
  return { name, mediaType }
}

function imageResponse(body, mediaType) {
  return new Response(body, {
    headers: {
      'content-type': mediaType,
      'content-length': String(body.byteLength),
      'cache-control': 'private, max-age=60',
      'x-content-type-options': 'nosniff',
    },
  })
}

/**
 * One original image from the photo folder.
 * Path traversal, hidden names, and unknown media types answer 404.
 */
export async function servePhoto(dir, encodedName) {
  const { name, mediaType, error } = photoName(encodedName)
  if (error !== undefined) return error
  try {
    return imageResponse(await readFile(join(dir, name)), mediaType)
  } catch {
    return notFound()
  }
}

/**
 * One display copy, addressed by its original photo name.
 * The hidden `.display/<hash>.jpg` layout stays private; hidden names,
 * traversal, unknown media types and missing copies answer 404.
 */
export async function serveDisplayPhoto(dir, encodedName) {
  const { name, error } = photoName(encodedName)
  if (error !== undefined) return error
  try {
    const body = await readFile(join(dir, '.display', displayFileName(name)))
    return imageResponse(body, 'image/jpeg')
  } catch {
    return notFound()
  }
}

/**
 * Route resource for a `kind: 'prefix'` webServer registration:
 * `GET <route>/photos.json`, `GET <route>/photos/<name>` and
 * `GET <route>/display/<name>`.
 */
export function createPhotoResource(dir, route = ROUTE) {
  const photosPrefix = `${route}/photos/`
  const displayPrefix = `${route}/display/`
  return async (request) => {
    const { pathname } = new URL(request.url)
    if (pathname === `${route}/photos.json`) {
      const listing = await listPhotos(dir)
      return new Response(JSON.stringify(listing), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      })
    }
    if (pathname.startsWith(displayPrefix)) {
      return serveDisplayPhoto(dir, pathname.slice(displayPrefix.length))
    }
    if (pathname.startsWith(photosPrefix)) return servePhoto(dir, pathname.slice(photosPrefix.length))
    return notFound()
  }
}

/* --- Photo manager writes ------------------------------------------------ */

/** Extensions the browser should tell people to convert HEIC photos away from. */
const HEIC_EXTENSIONS = new Set(['heic', 'heif'])

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  })
}

function manageError(status, code, message, extraHeaders = {}) {
  return jsonResponse({ error: code, message }, status, extraHeaders)
}

/** Canonical media type for a Content-Type header, or null when it is missing or blank. */
function normalizedContentType(value) {
  if (typeof value !== 'string') return null
  const type = value.split(';', 1)[0].trim().toLowerCase()
  if (type.length === 0) return null
  return CONTENT_TYPE_ALIASES.get(type) ?? type
}

function asciiAt(bytes, start, text) {
  if (bytes.length < start + text.length) return false
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[start + index] !== text.charCodeAt(index)) return false
  }
  return true
}

function matchesMagic(mediaType, bytes) {
  const format = IMAGE_FORMATS.get(mediaType)
  return format === undefined ? false : format.matchesMagic(bytes)
}

/** Pixel size from the image header, or null when the dimensions cannot be read. */
function imageDimensions(mediaType, bytes) {
  const format = IMAGE_FORMATS.get(mediaType)
  return format === undefined ? null : format.dimensions(bytes)
}

function pngDimensions(bytes) {
  return bytes.length >= 24
    ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
    : null
}

function gifDimensions(bytes) {
  return bytes.length >= 10
    ? { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) }
    : null
}

function avifDimensions(bytes) {
  const marker = bytes.indexOf('ispe', 0, 'latin1')
  if (marker === -1 || bytes.length < marker + 16) return null
  return { width: bytes.readUInt32BE(marker + 8), height: bytes.readUInt32BE(marker + 12) }
}

function webpDimensions(bytes) {
  if (bytes.length < 30) return null
  if (asciiAt(bytes, 12, 'VP8 ')) {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff }
  }
  if (asciiAt(bytes, 12, 'VP8L')) {
    const bits = bytes.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (asciiAt(bytes, 12, 'VP8X')) {
    const width = bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)
    const height = bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)
    return { width: width + 1, height: height + 1 }
  }
  return null
}

function jpegDimensions(bytes) {
  let offset = 2
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    let marker = bytes[offset + 1]
    while (marker === 0xff) {
      offset += 1
      marker = bytes[offset + 1]
    }
    offset += 2
    /* Standalone markers carry no length field. */
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue
    const length = (bytes[offset] << 8) | bytes[offset + 1]
    if (length < 2) return null
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf
      && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isStartOfFrame) {
      if (offset + 7 >= bytes.length) return null
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      }
    }
    offset += length
  }
  return null
}

/**
 * The one validator for photo names on the write side: no path separators, no
 * leading dot, no control characters, no replacement character, and no more
 * than MAX_PHOTO_NAME_LENGTH characters. Returns the name, or null when invalid.
 */
function plainPhotoName(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_PHOTO_NAME_LENGTH) return null
  if (raw.includes('/') || raw.includes('\\') || raw.startsWith('.')) return null
  if (raw.includes('\uFFFD')) return null
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null
  return raw
}

/** A plain file name with a supported image extension; `null` means unsupported or invalid. */
function uploadName(raw) {
  const name = plainPhotoName(raw)
  if (name === null) return null
  const extension = extname(name).toLowerCase().slice(1)
  const mediaType = MEDIA_TYPES_BY_EXTENSION.get(extension)
  if (mediaType === undefined) {
    return { error: HEIC_EXTENSIONS.has(extension) ? 'heic' : 'unsupported-media-type' }
  }
  return { name, mediaType }
}

/** Read the body while refusing to buffer more than `limit` bytes. */
async function readLimitedBody(request, limit) {
  const declared = request.headers.get('content-length')
  if (declared !== null && Number(declared) > limit) return { tooLarge: true }
  if (request.body === null) return { bytes: Buffer.alloc(0) }
  const reader = request.body.getReader()
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel().catch(() => {})
      return { tooLarge: true }
    }
    chunks.push(Buffer.from(value))
  }
  return { bytes: Buffer.concat(chunks, total) }
}

/** True when `path` is an existing regular file. */
async function fileExists(path) {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

/** `photo.png` → `photo-2.png` → `photo-3.png`; existing files are never overwritten. */
async function uniquePhotoName(dir, name) {
  const extension = extname(name)
  const stem = name.slice(0, name.length - extension.length)
  let candidate = name
  for (let index = 2; await fileExists(join(dir, candidate)); index += 1) {
    if (index > 1000) throw new Error('dsh-snap-line: no free photo name')
    candidate = `${stem}-${index}${extension}`
  }
  return candidate
}

/**
 * The one atomic writer: a hidden temp file next to the target, then rename.
 * `replace` allows overwriting an existing file (POSIX rename does; Windows
 * needs the unlink fallback). Failures leave no temp file behind.
 */
async function writeAtomically(target, body, { replace = false } = {}) {
  const dir = dirname(target)
  await mkdir(dir, { recursive: true })
  const temp = join(dir, `.snap-line-${randomUUID()}.tmp`)
  try {
    await writeFile(temp, body, { flag: 'wx' })
    if (!replace) {
      await rename(temp, target)
      return
    }
    try {
      await rename(temp, target)
    } catch (error) {
      /* Windows refuses rename onto an existing file; replacing is intended. */
      if (error.code !== 'EEXIST' && error.code !== 'EPERM') throw error
      await unlink(target).catch(() => {})
      await rename(temp, target)
    }
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}

/** Store a new original photo under a fresh name; never overwrites an existing photo. */
async function writePhotoAtomically(dir, name, bytes) {
  const storedName = await uniquePhotoName(dir, name)
  await writeAtomically(join(dir, storedName), bytes)
  return storedName
}

function expectedOrigin(getOrigin) {
  try {
    const origin = getOrigin()
    return typeof origin === 'string' && origin.length > 0 ? new URL(origin).origin : null
  } catch {
    return null
  }
}

/**
 * Same-origin policy for writes: an `Origin` exactly matching the web server's
 * origin, and no `Sec-Fetch-Site: cross-site`. Browsers always send both on a
 * same-origin `fetch`, so a missing `Origin` is refused rather than trusted.
 */
function writeIsSameOrigin(request, getOrigin) {
  const site = request.headers.get('sec-fetch-site')
  if (site !== null && site.toLowerCase() === 'cross-site') return false
  const origin = request.headers.get('origin')
  if (origin === null) return false
  let actual
  try {
    actual = new URL(origin).origin
  } catch {
    return false
  }
  const expected = expectedOrigin(getOrigin)
  return expected !== null && actual === expected
}

async function addPhoto(dir, request, searchParams) {
  const parsed = uploadName(searchParams.get('name'))
  if (parsed === null) return manageError(400, 'invalid-name', INVALID_NAME_MESSAGE)
  if (parsed.error !== undefined) {
    return parsed.error === 'heic'
      ? manageError(415, 'heic', 'HEIC/HEIF photos are not supported yet. Convert the photo to JPG or PNG first.')
      : manageError(415, 'unsupported-media-type', 'Unsupported photo type. Use JPG, PNG, WebP, GIF, or AVIF.')
  }
  const contentType = normalizedContentType(request.headers.get('content-type'))
  if (contentType === null || !ACCEPTED_MEDIA_TYPES.has(contentType) || contentType !== parsed.mediaType) {
    return manageError(415, 'unsupported-media-type', `This photo must be sent as ${parsed.mediaType}.`)
  }
  const limited = await readLimitedBody(request, MAX_PHOTO_BYTES)
  if (limited.tooLarge) return manageError(413, 'too-large', 'Photo is larger than 25MB.')
  const { bytes } = limited
  if (!matchesMagic(parsed.mediaType, bytes)) {
    return manageError(400, 'magic-mismatch', 'File contents do not match the declared image type.')
  }
  const size = imageDimensions(parsed.mediaType, bytes)
  if (size === null) {
    return manageError(400, 'invalid-image', 'Could not read this photo\'s dimensions, so it was not added.')
  }
  if (size.width * size.height > MAX_PHOTO_PIXELS) {
    return manageError(413, 'too-many-pixels', 'Photo is larger than 64 megapixels.')
  }
  try {
    const storedName = await writePhotoAtomically(dir, parsed.name, bytes)
    return jsonResponse({ ok: true, name: storedName })
  } catch {
    return manageError(500, 'write-failed', 'Could not save the photo.')
  }
}

/** A display copy is written for one supported photo name that already exists in the folder. */
function existingPhotoName(raw) {
  const name = plainPhotoName(raw)
  if (name === null) return null
  return MEDIA_TYPES.has(extname(name).toLowerCase()) ? name : null
}

/** Replace a display copy atomically; writing it again is allowed. */
async function writeDisplayAtomically(dir, name, bytes) {
  await writeAtomically(join(dir, '.display', displayFileName(name)), bytes, { replace: true })
}

async function addDisplayCopy(dir, request, searchParams) {
  const name = existingPhotoName(searchParams.get('name'))
  if (name === null) return manageError(400, 'invalid-name', INVALID_NAME_MESSAGE)
  if (!(await fileExists(join(dir, name)))) {
    return manageError(404, 'not-found', 'The original photo does not exist in the photo folder.')
  }
  if (normalizedContentType(request.headers.get('content-type')) !== 'image/jpeg') {
    return manageError(415, 'unsupported-media-type', 'A display copy must be sent as image/jpeg.')
  }
  const limited = await readLimitedBody(request, MAX_PHOTO_BYTES)
  if (limited.tooLarge) return manageError(413, 'too-large', 'Display copy is larger than 25MB.')
  const { bytes } = limited
  if (!matchesMagic('image/jpeg', bytes)) {
    return manageError(400, 'magic-mismatch', 'File contents do not match the declared image type.')
  }
  try {
    await writeDisplayAtomically(dir, name, bytes)
    return jsonResponse({ ok: true, name })
  } catch {
    return manageError(500, 'write-failed', 'Could not save the display copy.')
  }
}

/**
 * `order` action: replace the explicit photo order with `{ "names": [...] }`.
 * Names that no longer exist are ignored and duplicates collapse, so a delete
 * racing a reorder never fails the write. The normalized list is echoed back.
 */
async function orderPhotos(dir, request) {
  if (normalizedContentType(request.headers.get('content-type')) !== 'application/json') {
    return manageError(415, 'unsupported-media-type', 'The photo order must be sent as application/json.')
  }
  const limited = await readLimitedBody(request, MAX_MANAGE_JSON_BYTES)
  if (limited.tooLarge) return manageError(413, 'too-large', 'The photo order is larger than 64KB.')
  let payload
  try {
    payload = JSON.parse(limited.bytes.toString('utf8'))
  } catch {
    return manageError(400, 'invalid-order', 'The photo order must be a JSON object with a names array.')
  }
  if (payload === null || typeof payload !== 'object' || !Array.isArray(payload.names)) {
    return manageError(400, 'invalid-order', 'The photo order must be a JSON object with a names array.')
  }
  let present
  try {
    present = new Set((await listPhotos(dir)).photos.map((photo) => photo.name))
  } catch {
    return manageError(500, 'read-failed', 'Could not read the photo folder.')
  }
  const names = []
  for (const name of payload.names) {
    if (plainPhotoName(name) === null) return manageError(400, 'invalid-name', INVALID_NAME_MESSAGE)
    if (!present.has(name) || names.includes(name)) continue
    names.push(name)
  }
  try {
    await writeOrderAtomically(dir, names)
  } catch {
    return manageError(500, 'write-failed', 'Could not save the photo order.')
  }
  return jsonResponse({ ok: true, names })
}

/**
 * Defensive order cleanup for a deleted photo. Ticket 04 owns ordering, so this
 * only drops one entry when a readable array holds it: a missing, unreadable, or
 * corrupt `.order.json` is left exactly as it is instead of failing the delete.
 */
async function removeOrderEntry(dir, name) {
  const path = join(dir, ORDER_FILE)
  let entries
  try {
    entries = JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return
  }
  if (!Array.isArray(entries) || !entries.includes(name)) return
  const next = entries.filter((entry) => entry !== name)
  try {
    await writeAtomically(path, JSON.stringify(next), { replace: true })
  } catch {
    /* Best effort: the deleted photo is gone even if the order file cannot be updated. */
  }
}

/**
 * Delete one photo: its original, its display copy if present, and its entry in
 * the order file when one exists. A missing original answers 404; other photos
 * and the rest of the order are untouched.
 */
async function deletePhoto(dir, request) {
  const limited = await readLimitedBody(request, MAX_MANAGE_JSON_BYTES)
  if (limited.tooLarge) return manageError(413, 'too-large', 'Delete requests are limited to 64KB.')
  let payload
  try {
    payload = JSON.parse(limited.bytes.toString('utf8'))
  } catch {
    return manageError(400, 'invalid-request', 'Delete requests must be JSON like {"name":"photo.jpg"}.')
  }
  const raw = payload !== null && typeof payload === 'object' ? payload.name : undefined
  const parsed = deleteName(raw)
  if (parsed.error === 'invalid-name') return manageError(400, 'invalid-name', INVALID_NAME_MESSAGE)
  if (parsed.error !== undefined) {
    return manageError(404, 'not-found', 'No photo with that name is in the photo folder.')
  }
  try {
    await unlink(join(dir, parsed.name))
  } catch (error) {
    if (error.code === 'ENOENT') return manageError(404, 'not-found', 'No photo with that name is in the photo folder.')
    return manageError(500, 'delete-failed', 'Could not delete the photo.')
  }
  /* The display copy is disposable and may already be missing. */
  await unlink(join(dir, '.display', displayFileName(parsed.name))).catch(() => {})
  await removeOrderEntry(dir, parsed.name)
  return jsonResponse({ ok: true, name: parsed.name })
}

/** Name for a delete request: plain photo name with a supported extension, never a path. */
function deleteName(raw) {
  const name = plainPhotoName(raw)
  if (name === null) return { error: 'invalid-name' }
  if (MEDIA_TYPES.get(extname(name).toLowerCase()) === undefined) return { error: 'not-found' }
  return { name }
}

/**
 * Fetch-shaped write resource for `POST /dsh-snap-line/manage`. Four actions:
 *
 * - `?action=add&name=<file name>` with the raw original image bytes as the body,
 *   answered with `{ ok: true, name }` (the stored name may carry a `-2` suffix).
 * - `?action=order` with a JSON body `{ "names": [...] }`, answered with
 *   `{ ok: true, names }` after atomically replacing `.order.json`; names that no
 *   longer exist are dropped.
 * - `?action=delete` with a JSON body `{ "name": "<file name>" }`, answered with
 *   `{ ok: true, name }` after deleting the original, its display copy and its
 *   order entry.
 * - `?action=display&name=<file name>` with the raw JPEG display-copy bytes as
 *   the body, answered with `{ ok: true, name }` for the named original.
 *
 * `getOrigin` is called per request because the web server cannot report its
 * origin before the listener binds.
 */
export function createManageResource(dir, getOrigin) {
  return async (request) => {
    let url
    try {
      url = new URL(request.url)
    } catch {
      return manageError(400, 'invalid-request', 'Malformed request URL.')
    }
    if (url.pathname !== MANAGE_PATH) return notFound()
    if (request.method !== 'POST') {
      return manageError(405, 'method-not-allowed', 'Only POST can change photos.', { allow: 'POST' })
    }
    if (!writeIsSameOrigin(request, getOrigin)) {
      return manageError(403, 'forbidden', 'Cross-origin photo writes are refused.')
    }
    const action = url.searchParams.get('action')
    if (action === 'add') return addPhoto(dir, request, url.searchParams)
    if (action === 'order') return orderPhotos(dir, request)
    if (action === 'display') return addDisplayCopy(dir, request, url.searchParams)
    if (action === 'delete') return deletePhoto(dir, request)
    return manageError(400, 'unknown-action', 'Unknown photo manager action.')
  }
}
