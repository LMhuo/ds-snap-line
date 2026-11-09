/**
 * Photo folder helpers for SnapLine.
 *
 * These functions are plain Node.js (no Cordis, no DOM) so they can be tested
 * on their own: the Host half only has to wire them to a route.
 */
import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'

/** Browser-facing base path for the photo manifest and the images. */
export const ROUTE = '/dsh-snap-line'

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

/** One photo entry's browser URL, versioned by mtime so replacements are not cached. */
export function photoUrl(name, mtimeMs) {
  return `${ROUTE}/photos/${encodeURIComponent(name)}?v=${Math.round(mtimeMs)}`
}

/**
 * Current photo folder contents as `{ photos: [{ name, url }], revision }`.
 * Missing folder counts as empty; each photo's mtime feeds the revision.
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
      photos.push({ name: entry.name, mtimeMs: info.mtimeMs })
    } catch {
      // Removed while listing.
    }
  }
  photos.sort((left, right) => left.name.localeCompare(right.name, 'en', { numeric: true }))
  const revision = createHash('sha1')
    .update(photos.map((photo) => `${photo.name}\u0000${photo.mtimeMs}`).join('\n'))
    .digest('hex')
    .slice(0, 12)
  return {
    photos: photos.map(({ name, mtimeMs }) => ({ name, url: photoUrl(name, mtimeMs) })),
    revision,
  }
}

/**
 * One image from the photo folder.
 * Path traversal, hidden names, and unknown media types answer 404.
 */
export async function servePhoto(dir, encodedName) {
  let name
  try {
    name = decodeURIComponent(encodedName)
  } catch {
    return new Response(null, { status: 400 })
  }
  if (name.includes('/') || name.includes('\\') || name.startsWith('.')) return notFound()
  const mediaType = MEDIA_TYPES.get(extname(name).toLowerCase())
  if (mediaType === undefined) return notFound()
  try {
    const body = await readFile(join(dir, name))
    return new Response(body, {
      headers: {
        'content-type': mediaType,
        'content-length': String(body.byteLength),
        'cache-control': 'private, max-age=60',
        'x-content-type-options': 'nosniff',
      },
    })
  } catch {
    return notFound()
  }
}

/**
 * Route resource for a `kind: 'prefix'` webServer registration:
 * `GET <route>/photos.json` and `GET <route>/photos/<name>`.
 */
export function createPhotoResource(dir, route = ROUTE) {
  const photosPrefix = `${route}/photos/`
  return async (request) => {
    const { pathname } = new URL(request.url)
    if (pathname === `${route}/photos.json`) {
      const listing = await listPhotos(dir)
      return new Response(JSON.stringify(listing), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      })
    }
    if (pathname.startsWith(photosPrefix)) return servePhoto(dir, pathname.slice(photosPrefix.length))
    return notFound()
  }
}
