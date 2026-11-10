/**
 * Photo folder helpers for SnapLine.
 *
 * These functions are plain Node.js (no Cordis, no DOM) so they can be tested
 * on their own: the Host half only has to wire them to a route.
 */
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { extname, join } from 'node:path'

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

/** Number of leading photos that actually hang on the rope. */
export const MAX_ON_ROPE = 6

/**
 * Photo folder inside the DeepSeek Harness home: `$DSH_HOME/dsh-snap-line/photos`,
 * or `~/.dsh/dsh-snap-line/photos` when `DSH_HOME` is missing, blank, or padded
 * with whitespace. Follows the same `DSH_HOME` precedence as `dsh-home-paths`.
 */
export function photoFolder(env = process.env, home = homedir()) {
  const configured = env.DSH_HOME
  const usable = typeof configured === 'string'
    && configured.length > 0
    && configured === configured.trim()
  return join(usable ? configured : join(home, '.dsh'), 'dsh-snap-line', 'photos')
}

/** Image extensions served from the photo folder, mapped to their media type. */
export const MEDIA_TYPES = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.avif', 'image/avif'],
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
 * A display copy may be missing, unreadable, or no longer a JPEG; all three
 * count as absent so the manifest falls back to the original instead of
 * handing the clothesline a broken image.
 */
async function displayCopyMtime(dir, name) {
  const path = join(dir, '.display', displayFileName(name))
  try {
    const info = await stat(path)
    if (!info.isFile()) return null
    const handle = await open(path, 'r')
    try {
      const header = Buffer.alloc(3)
      const { bytesRead } = await handle.read(header, 0, header.length, 0)
      if (bytesRead < header.length || !matchesMagic('image/jpeg', header)) return null
    } finally {
      await handle.close()
    }
    return info.mtimeMs
  } catch {
    return null
  }
}

/**
 * Current photo folder contents as
 * `{ photos: [{ name, displayUrl, originalUrl, onRope }], revision }`.
 * Missing folder counts as empty; every photo's mtime and display-copy mtime
 * feed the revision.
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
        displayMtimeMs: await displayCopyMtime(dir, entry.name),
      })
    } catch {
      // Removed while listing.
    }
  }
  photos.sort((left, right) => left.name.localeCompare(right.name, 'en', { numeric: true }))
  const revision = createHash('sha1')
    .update(photos
      .map((photo) => `${photo.name}\u0000${photo.mtimeMs}\u0000${photo.displayMtimeMs ?? ''}`)
      .join('\n'))
    .digest('hex')
    .slice(0, 12)
  return {
    photos: photos.map(({ name, mtimeMs, displayMtimeMs }, index) => ({
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

/** Media type each supported extension must declare, and accept in a body. */
const MEDIA_TYPES_BY_EXTENSION = new Map([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
  ['gif', 'image/gif'],
  ['avif', 'image/avif'],
])

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

function normalizedContentType(value) {
  if (typeof value !== 'string') return null
  const type = value.split(';', 1)[0].trim().toLowerCase()
  return type.length === 0 ? null : type
}

function asciiAt(bytes, start, text) {
  if (bytes.length < start + text.length) return false
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[start + index] !== text.charCodeAt(index)) return false
  }
  return true
}

function matchesMagic(mediaType, bytes) {
  switch (mediaType) {
    case 'image/png':
      return bytes.length >= 8
        && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
        && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    case 'image/jpeg':
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    case 'image/gif':
      return asciiAt(bytes, 0, 'GIF87a') || asciiAt(bytes, 0, 'GIF89a')
    case 'image/webp':
      return bytes.length >= 12 && asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WEBP')
    case 'image/avif':
      return bytes.length >= 12 && asciiAt(bytes, 4, 'ftyp')
        && (asciiAt(bytes, 8, 'avif') || asciiAt(bytes, 8, 'avis'))
    default:
      return false
  }
}

/** Pixel size from the image header, or null when the format is not read here. */
function imageDimensions(mediaType, bytes) {
  switch (mediaType) {
    case 'image/png':
      return bytes.length >= 24
        ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
        : null
    case 'image/gif':
      return bytes.length >= 10
        ? { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) }
        : null
    case 'image/webp':
      return webpDimensions(bytes)
    case 'image/jpeg':
      return jpegDimensions(bytes)
    case 'image/avif': {
      const marker = bytes.indexOf('ispe', 0, 'latin1')
      if (marker === -1 || bytes.length < marker + 16) return null
      return { width: bytes.readUInt32BE(marker + 8), height: bytes.readUInt32BE(marker + 12) }
    }
    default:
      return null
  }
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

/** A plain file name: no path separators, no leading dot, no control characters. */
function plainFileName(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return false
  if (raw.includes('/') || raw.includes('\\') || raw.startsWith('.')) return false
  if (raw.includes('\uFFFD')) return false
  if (/[\u0000-\u001f\u007f]/.test(raw)) return false
  return true
}

/** A plain, bounded file name; `null` means invalid and an `error` code means unsupported. */
function uploadName(raw) {
  if (!plainFileName(raw)) return null
  if (raw.length > MAX_PHOTO_NAME_LENGTH) return null
  const extension = extname(raw).toLowerCase().slice(1)
  const mediaType = MEDIA_TYPES_BY_EXTENSION.get(extension)
  if (mediaType === undefined) {
    return { error: HEIC_EXTENSIONS.has(extension) ? 'heic' : 'unsupported-media-type' }
  }
  return { name: raw, mediaType }
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

async function fileExists(path) {
  try {
    await stat(path)
    return true
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

/** Temp file in the photo folder, then rename into place; failures leave nothing behind. */
async function writePhotoAtomically(dir, name, bytes) {
  await mkdir(dir, { recursive: true })
  const storedName = await uniquePhotoName(dir, name)
  const temp = join(dir, `.upload-${randomUUID()}.tmp`)
  try {
    await writeFile(temp, bytes, { flag: 'wx' })
    await rename(temp, join(dir, storedName))
    return storedName
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
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
  if (parsed === null) {
    return manageError(400, 'invalid-name', 'Photo names must be plain file names without path separators, a leading dot, control characters, or more than 120 characters.')
  }
  if (parsed.error !== undefined) {
    return parsed.error === 'heic'
      ? manageError(415, 'heic', 'HEIC/HEIF photos are not supported yet. Convert the photo to JPG or PNG first.')
      : manageError(415, 'unsupported-media-type', 'Unsupported photo type. Use JPG, PNG, WebP, GIF, or AVIF.')
  }
  if (normalizedContentType(request.headers.get('content-type')) !== parsed.mediaType) {
    return manageError(415, 'unsupported-media-type', `This photo must be sent as ${parsed.mediaType}.`)
  }
  const limited = await readLimitedBody(request, MAX_PHOTO_BYTES)
  if (limited.tooLarge) return manageError(413, 'too-large', 'Photo is larger than 25MB.')
  const { bytes } = limited
  if (!matchesMagic(parsed.mediaType, bytes)) {
    return manageError(400, 'magic-mismatch', 'File contents do not match the declared image type.')
  }
  const size = imageDimensions(parsed.mediaType, bytes)
  if (size !== null && size.width * size.height > MAX_PHOTO_PIXELS) {
    return manageError(413, 'too-many-pixels', 'Photo is larger than 64 megapixels.')
  }
  try {
    const storedName = await writePhotoAtomically(dir, parsed.name, bytes)
    return jsonResponse({ ok: true, name: storedName })
  } catch {
    return manageError(500, 'write-failed', 'Could not save the photo.')
  }
}

async function photoExists(dir, name) {
  try {
    return (await stat(join(dir, name))).isFile()
  } catch {
    return false
  }
}

/** A display copy is written for one supported photo name that already exists in the folder. */
function existingPhotoName(raw) {
  if (!plainFileName(raw)) return null
  return MEDIA_TYPES.has(extname(raw).toLowerCase()) ? raw : null
}

/** Temp file in `.display/`, then rename into place; re-writing a copy is allowed. */
async function writeDisplayAtomically(dir, name, bytes) {
  const displayDir = join(dir, '.display')
  await mkdir(displayDir, { recursive: true })
  const target = join(displayDir, displayFileName(name))
  const temp = join(displayDir, `.upload-${randomUUID()}.tmp`)
  try {
    await writeFile(temp, bytes, { flag: 'wx' })
    try {
      await rename(temp, target)
    } catch (error) {
      /* Windows refuses rename onto an existing file; replacing the copy is intended. */
      if (error.code !== 'EEXIST' && error.code !== 'EPERM') throw error
      await unlink(target).catch(() => {})
      await rename(temp, target)
    }
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}

async function addDisplayCopy(dir, request, searchParams) {
  const name = existingPhotoName(searchParams.get('name'))
  if (name === null) {
    return manageError(400, 'invalid-name', 'The display copy must name a plain photo file without path separators, a leading dot, or control characters.')
  }
  if (!(await photoExists(dir, name))) {
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
 * Fetch-shaped write resource for `POST <route>/manage`: `add` takes the raw
 * original image bytes, `display` takes a browser-made JPEG display copy. Both
 * name the photo in the query string and answer `{ ok: true, name }`. `getOrigin`
 * is called per request because the web server cannot report its origin before
 * the listener binds.
 */
export function createManageResource(dir, getOrigin, route = ROUTE) {
  const managePath = `${route}/manage`
  return async (request) => {
    let url
    try {
      url = new URL(request.url)
    } catch {
      return manageError(400, 'invalid-request', 'Malformed request URL.')
    }
    if (url.pathname !== managePath) return notFound()
    if (request.method !== 'POST') {
      return manageError(405, 'method-not-allowed', 'Only POST can change photos.', { allow: 'POST' })
    }
    if (!writeIsSameOrigin(request, getOrigin)) {
      return manageError(403, 'forbidden', 'Cross-origin photo writes are refused.')
    }
    const action = url.searchParams.get('action')
    if (action === 'add') return addPhoto(dir, request, url.searchParams)
    if (action === 'display') return addDisplayCopy(dir, request, url.searchParams)
    return manageError(400, 'unknown-action', 'Unknown photo manager action.')
  }
}
