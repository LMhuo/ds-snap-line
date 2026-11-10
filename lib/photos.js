/**
 * Photo folder helpers for SnapLine.
 *
 * These functions are plain Node.js (no Cordis, no DOM) so they can be tested
 * on their own: the Host half only has to wire them to a route.
 */
import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { extname, join } from 'node:path'

/** Browser-facing base path for the photo manifest and the images. */
export const ROUTE = '/dsh-snap-line'

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

/** A display copy may be missing or unreadable; both count as absent. */
async function displayCopyMtime(dir, name) {
  try {
    const info = await stat(join(dir, '.display', displayFileName(name)))
    return info.isFile() ? info.mtimeMs : null
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
