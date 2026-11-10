import test from 'node:test'
import assert from 'node:assert/strict'
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import {
  createManageResource,
  createPhotoResource,
  displayFileName,
  listPhotos,
  MANAGE_PATH,
  MAX_PHOTO_BYTES,
  photoFolder,
  ROUTE,
  servePhoto,
} from '../lib/photos.js'
import { apply } from '../index.js'

/* Magic bytes only; the read route never looks inside the image. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
/* A complete-enough JPEG: SOI, one APP0 segment and EOI. */
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  Buffer.from('JFIF\u0000', 'latin1'),
  Buffer.from([0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
  Buffer.from([0xff, 0xd9]),
])
const JPEG_EOI = Buffer.from([0xff, 0xd9])

async function makeFixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-snap-line-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await writeFile(join(dir, 'b.png'), PNG)
  await writeFile(join(dir, 'a.jpg'), JPEG)
  await writeFile(join(dir, 'photo 10.webp'), PNG)
  await writeFile(join(dir, 'notes.txt'), 'not an image')
  await writeFile(join(dir, '._a.jpg'), JPEG) // macOS resource fork
  await mkdir(join(dir, 'nested'))
  await writeFile(join(dir, 'nested', 'c.png'), PNG)
  return dir
}

async function makeOrderedFixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-snap-line-order-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const names = Array.from({ length: 8 }, (_, index) => `photo ${index + 1}.png`)
  for (const name of names) await writeFile(join(dir, name), PNG)
  await mkdir(join(dir, '.display'))
  await writeFile(join(dir, '.display', displayFileName('photo 2.png')), JPEG)
  await writeFile(join(dir, '.order.json'), JSON.stringify(names))
  return { dir, names }
}

async function makePhotoDir(t, names) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-snap-line-listing-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  for (const name of names) await writeFile(join(dir, name), PNG)
  return dir
}

test('listPhotos puts photos recorded in .order.json first and appends the rest naturally', async (t) => {
  const dir = await makePhotoDir(t, ['a.jpg', 'b.png', 'c.webp', 'd.gif'])
  await writeFile(join(dir, '.order.json'), JSON.stringify(['c.webp', 'a.jpg']))

  const listing = await listPhotos(dir)
  assert.deepEqual(listing.photos.map((photo) => photo.name), ['c.webp', 'a.jpg', 'b.png', 'd.gif'])
})

test('listPhotos skips order entries that no longer exist and collapses duplicates', async (t) => {
  const dir = await makePhotoDir(t, ['a.jpg', 'b.png', 'c.webp'])
  await writeFile(
    join(dir, '.order.json'),
    JSON.stringify(['missing.png', 'c.webp', 'c.webp', 'a.jpg']),
  )

  const listing = await listPhotos(dir)
  assert.deepEqual(listing.photos.map((photo) => photo.name), ['c.webp', 'a.jpg', 'b.png'])
})

test('listPhotos marks the first six photos of the recorded order as on the rope', async (t) => {
  const { dir, names } = await makeOrderedFixture(t)
  const reversed = [...names].reverse()
  await writeFile(join(dir, '.order.json'), JSON.stringify(reversed))

  const listing = await listPhotos(dir)
  assert.deepEqual(listing.photos.map((photo) => photo.name), reversed)
  assert.deepEqual(
    listing.photos.filter((photo) => photo.onRope).map((photo) => photo.name),
    reversed.slice(0, 6),
  )
})

test('listPhotos falls back to natural order when .order.json is corrupt or not a name array', async (t) => {
  const naturals = ['a.jpg', 'b.png', 'c.webp']
  for (const content of ['{not json', 'null', '"b.png"', JSON.stringify({ names: ['b.png'] })]) {
    const dir = await makePhotoDir(t, naturals)
    await writeFile(join(dir, '.order.json'), content)
    const listing = await listPhotos(dir)
    assert.deepEqual(
      listing.photos.map((photo) => photo.name),
      naturals,
      `content: ${content}`,
    )
  }
})

test('listPhotos revision follows the recorded order', async (t) => {
  const dir = await makePhotoDir(t, ['a.jpg', 'b.png', 'c.webp'])
  const first = await listPhotos(dir)
  await writeFile(join(dir, '.order.json'), JSON.stringify(['c.webp', 'b.png', 'a.jpg']))
  const second = await listPhotos(dir)
  assert.notEqual(second.revision, first.revision)
  assert.deepEqual(second.photos.map((photo) => photo.name), ['c.webp', 'b.png', 'a.jpg'])
})

test('photoFolder uses $DSH_HOME/dsh-snap-line/photos when DSH_HOME is set', () => {
  const folder = photoFolder({ DSH_HOME: '/tmp/snap-home' }, '/home/tester')
  assert.equal(folder, join('/tmp/snap-home', 'dsh-snap-line', 'photos'))
})

test('photoFolder falls back to ~/.dsh when DSH_HOME is missing, blank or padded', () => {
  const expected = join('/home/tester', '.dsh', 'dsh-snap-line', 'photos')
  for (const env of [{}, { DSH_HOME: '' }, { DSH_HOME: '   ' }, { DSH_HOME: '/tmp/snap-home ' }]) {
    assert.equal(photoFolder(env, '/home/tester'), expected, `env: ${JSON.stringify(env)}`)
  }
})

test('photoFolder expands ~ and resolves the result to an absolute path', () => {
  assert.equal(
    photoFolder({ DSH_HOME: '~' }, '/home/tester'),
    join('/home/tester', 'dsh-snap-line', 'photos'),
  )
  assert.equal(
    photoFolder({ DSH_HOME: '~/pictures' }, '/home/tester'),
    join('/home/tester', 'pictures', 'dsh-snap-line', 'photos'),
  )
  assert.equal(
    photoFolder({ DSH_HOME: join('/home/tester', 'pictures') }, '/home/tester'),
    join('/home/tester', 'pictures', 'dsh-snap-line', 'photos'),
  )
  const relative = photoFolder({ DSH_HOME: 'relative-home' }, '/home/tester')
  assert.equal(relative, resolve('relative-home', 'dsh-snap-line', 'photos'))
  assert.equal(isAbsolute(relative), true)
})

test('listPhotos lists supported images in natural name order', async (t) => {
  const dir = await makeFixture(t)
  const listing = await listPhotos(dir)
  assert.deepEqual(
    listing.photos.map((photo) => photo.name),
    ['a.jpg', 'b.png', 'photo 10.webp'],
  )
  for (const photo of listing.photos) {
    assert.match(photo.originalUrl, new RegExp(`^${ROUTE}/photos/.+\\?v=\\d+$`))
    assert.equal(photo.displayUrl, photo.originalUrl)
    assert.equal(photo.onRope, true)
  }
  assert.match(listing.revision, /^[0-9a-f]{12}$/)
})

test('listPhotos returns all photos in order with display fallback and on-rope flags', async (t) => {
  const { dir, names } = await makeOrderedFixture(t)
  const listing = await listPhotos(dir)
  assert.deepEqual(listing.photos.map((photo) => photo.name), names)
  assert.equal(listing.photos.length, 8)
  for (const [index, photo] of listing.photos.entries()) {
    assert.deepEqual(Object.keys(photo).sort(), ['displayUrl', 'name', 'onRope', 'originalUrl'])
    assert.ok(
      photo.originalUrl.startsWith(`${ROUTE}/photos/${encodeURIComponent(photo.name)}?v=`),
      `originalUrl for ${photo.name}`,
    )
    assert.equal(photo.onRope, index < 6, `onRope for ${photo.name}`)
    if (photo.name === 'photo 2.png') {
      assert.ok(
        photo.displayUrl.startsWith(`${ROUTE}/display/${encodeURIComponent(photo.name)}?v=`),
        'the existing display copy is used',
      )
    } else {
      assert.equal(photo.displayUrl, photo.originalUrl, `fallback for ${photo.name}`)
    }
  }
  assert.equal(listing.photos.filter((photo) => photo.onRope).length, 6)
})

test('listPhotos treats a missing folder as empty', async () => {
  const listing = await listPhotos(join(tmpdir(), `dsh-snap-line-missing-${process.pid}-${Date.now()}`))
  assert.deepEqual(listing, { photos: [], revision: 'empty' })
})

test('listPhotos revision follows file replacement', async (t) => {
  const dir = await makeFixture(t)
  const first = await listPhotos(dir)
  await writeFile(join(dir, 'a.jpg'), Buffer.concat([JPEG, Buffer.from([1, 2, 3, 4])]))
  const future = new Date(Date.now() + 2_000)
  await utimes(join(dir, 'a.jpg'), future, future)
  const second = await listPhotos(dir)
  assert.notEqual(second.revision, first.revision)
})

test('listPhotos revision follows display-copy creation', async (t) => {
  const dir = await makeFixture(t)
  const first = await listPhotos(dir)
  await mkdir(join(dir, '.display'))
  await writeFile(join(dir, '.display', displayFileName('a.jpg')), JPEG)
  const second = await listPhotos(dir)
  assert.notEqual(second.revision, first.revision)
  const photo = second.photos.find((entry) => entry.name === 'a.jpg')
  assert.notEqual(photo.displayUrl, photo.originalUrl)
})

test('listPhotos falls back to the original when a display copy is corrupted', async (t) => {
  const { dir } = await makeOrderedFixture(t)
  const copy = join(dir, '.display', displayFileName('photo 2.png'))

  for (const corrupted of [Buffer.from('not a jpeg'), Buffer.alloc(0)]) {
    await writeFile(copy, corrupted)
    const listing = await listPhotos(dir)
    const photo = listing.photos.find((entry) => entry.name === 'photo 2.png')
    assert.equal(photo.displayUrl, photo.originalUrl, `fallback for ${corrupted.length} bytes`)
  }
})

test('listPhotos falls back to the original when a display copy is truncated or has no EOI', async (t) => {
  const { dir } = await makeOrderedFixture(t)
  const copy = join(dir, '.display', displayFileName('photo 2.png'))
  const older = new Date(Date.now() - 60_000)
  await utimes(join(dir, 'photo 2.png'), older, older)

  for (const corrupted of [
    /* Starts with a JPEG SOI, so the old three-byte check accepted it. */
    Buffer.concat([JPEG.subarray(0, 3), Buffer.from('truncated')]),
    JPEG.subarray(0, JPEG.length - 2),
  ]) {
    await writeFile(copy, corrupted)
    const newer = new Date()
    await utimes(copy, newer, newer)
    const listing = await listPhotos(dir)
    const photo = listing.photos.find((entry) => entry.name === 'photo 2.png')
    assert.equal(photo.displayUrl, photo.originalUrl, `fallback for ${corrupted.length} bytes`)
  }
})

test('listPhotos accepts a display copy that is exactly as new as the original', async (t) => {
  const dir = await makePhotoDir(t, ['a.png'])
  await mkdir(join(dir, '.display'))
  const stamp = new Date(Date.now() - 5_000)
  await utimes(join(dir, 'a.png'), stamp, stamp)
  const copy = join(dir, '.display', displayFileName('a.png'))
  await writeFile(copy, JPEG)
  await utimes(copy, stamp, stamp)

  const listing = await listPhotos(dir)
  const photo = listing.photos.find((entry) => entry.name === 'a.png')
  assert.notEqual(photo.displayUrl, photo.originalUrl)
})

test('listPhotos falls back to the original when a display copy is older than the original', async (t) => {
  const dir = await makePhotoDir(t, ['a.png'])
  await mkdir(join(dir, '.display'))
  const original = join(dir, 'a.png')
  const copy = join(dir, '.display', displayFileName('a.png'))
  const base = Date.now() - 60_000
  await utimes(original, new Date(base), new Date(base))
  await writeFile(copy, JPEG)
  await utimes(copy, new Date(base + 1_000), new Date(base + 1_000))

  const before = await listPhotos(dir)
  const beforePhoto = before.photos.find((entry) => entry.name === 'a.png')
  assert.notEqual(beforePhoto.displayUrl, beforePhoto.originalUrl, 'a fresh display copy is used')

  /* The user replaces the original by hand, leaving the old display copy behind. */
  await writeFile(original, Buffer.concat([PNG, Buffer.from('replaced')]))
  const replaced = new Date(base + 5_000)
  await utimes(original, replaced, replaced)

  const after = await listPhotos(dir)
  const afterPhoto = after.photos.find((entry) => entry.name === 'a.png')
  assert.equal(afterPhoto.displayUrl, afterPhoto.originalUrl, 'the stale display copy is ignored')
  assert.notEqual(after.revision, before.revision)
})

test('servePhoto returns bytes with the media type and no-sniff header', async (t) => {
  const dir = await makeFixture(t)
  const response = await servePhoto(dir, encodeURIComponent('photo 10.webp'))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/webp')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('cache-control'), 'private, max-age=60')
  assert.equal(response.headers.get('content-length'), String(PNG.length))
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), PNG)
})

test('servePhoto refuses traversal, hidden names, unknown types and missing files', async (t) => {
  const dir = await makeFixture(t)
  const names = [
    '..%2F..%2Fetc%2Fpasswd',
    '..%2Fnested%2Fc.png',
    '%2E%2E%2Fa.jpg',
    '..%5Ca.jpg',
    '.hidden.png',
    '._a.jpg',
    'notes.txt',
    'missing.png',
  ]
  for (const name of names) {
    const response = await servePhoto(dir, name)
    assert.equal(response.status, 404, `expected 404 for ${name}`)
  }
})

test('servePhoto answers 400 for malformed percent-encoding', async () => {
  const response = await servePhoto('/tmp', '%E0%A4%A')
  assert.equal(response.status, 400)
})

test('createPhotoResource serves the manifest, the image and 404s elsewhere', async (t) => {
  const dir = await makeFixture(t)
  const resource = createPhotoResource(dir)
  const base = 'http://127.0.0.1:57370'

  const manifestResponse = await resource(new Request(`${base}${ROUTE}/photos.json`))
  assert.equal(manifestResponse.status, 200)
  assert.equal(manifestResponse.headers.get('content-type'), 'application/json; charset=utf-8')
  assert.equal(manifestResponse.headers.get('cache-control'), 'no-store')
  const manifest = await manifestResponse.json()
  assert.deepEqual(manifest.photos.map((photo) => photo.name), ['a.jpg', 'b.png', 'photo 10.webp'])

  const imageResponse = await resource(new Request(`${base}${ROUTE}/photos/b.png`))
  assert.equal(imageResponse.status, 200)
  assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), PNG)

  assert.equal((await resource(new Request(`${base}${ROUTE}/elsewhere`))).status, 404)
  assert.equal((await resource(new Request(`${base}${ROUTE}`))).status, 404)
})

test('createPhotoResource serves a display copy and refuses unsafe display names', async (t) => {
  const { dir } = await makeOrderedFixture(t)
  const resource = createPhotoResource(dir)
  const base = 'http://127.0.0.1:57370'

  const response = await resource(new Request(`${base}${ROUTE}/display/${encodeURIComponent('photo 2.png')}`))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/jpeg')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('cache-control'), 'private, max-age=60')
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), JPEG)

  for (const name of ['..%2F..%2Fetc%2Fpasswd', '..%5Cphoto%202.png', '.hidden.png', 'notes.txt', encodeURIComponent('photo 3.png')]) {
    const missing = await resource(new Request(`${base}${ROUTE}/display/${name}`))
    assert.equal(missing.status, 404, `expected 404 for ${name}`)
  }
  const malformed = await resource(new Request(`${base}${ROUTE}/display/%E0%A4%A`))
  assert.equal(malformed.status, 400)
})

test('apply registers the prefix route and serves the $DSH_HOME photo folder', async (t) => {
  const home = await mkdtemp(join(tmpdir(), 'dsh-snap-line-home-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  const photos = join(home, 'dsh-snap-line', 'photos')
  await mkdir(photos, { recursive: true })
  await writeFile(join(photos, 'from-home.png'), PNG)

  const registered = []
  const ctx = {
    effect: (callback) => callback(),
    webServer: {
      register: (options) => {
        registered.push(options)
        return () => {}
      },
    },
  }
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  try {
    apply(ctx)
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  }
  assert.equal(registered.length, 2)
  const route = registered.find((entry) => entry.resource !== undefined)
  assert.equal(route.kind, 'prefix')
  assert.equal(route.path, ROUTE)

  const response = await route.resource(new Request(`http://127.0.0.1:57370${ROUTE}/photos.json`))
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.deepEqual(payload.photos.map((photo) => photo.name), ['from-home.png'])

  const manage = registered.find((entry) => entry.handler !== undefined)
  assert.equal(manage.kind, 'exact')
  assert.equal(manage.path, MANAGE_PATH)
  assert.equal(typeof manage.handler, 'function')
  assert.equal(manage.resource, undefined)
})

/* --- Photo manager write resource ---------------------------------------- */

const ORIGIN = 'http://127.0.0.1:57370'

async function makeWritableDir(t) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-snap-line-manage-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

function manageResource(dir, origin = ORIGIN) {
  return createManageResource(dir, typeof origin === 'function' ? origin : () => origin)
}

function addRequest(name, body, options = {}) {
  const headers = {
    'content-type': options.contentType === undefined ? 'image/png' : options.contentType,
  }
  const origin = options.origin === undefined ? ORIGIN : options.origin
  if (origin !== null) headers.origin = origin
  if (options.secFetchSite !== undefined) headers['sec-fetch-site'] = options.secFetchSite
  if (options.cookie !== undefined) headers.cookie = options.cookie
  const url = `${ORIGIN}${MANAGE_PATH}?action=add&name=${encodeURIComponent(name)}`
  return new Request(url, {
    method: 'POST',
    headers,
    body,
  })
}

function orderRequest(names, options = {}) {
  const headers = {
    'content-type': options.contentType === undefined ? 'application/json' : options.contentType,
  }
  const origin = options.origin === undefined ? ORIGIN : options.origin
  if (origin !== null) headers.origin = origin
  if (options.secFetchSite !== undefined) headers['sec-fetch-site'] = options.secFetchSite
  return new Request(`${ORIGIN}${MANAGE_PATH}?action=order`, {
    method: 'POST',
    headers,
    body: options.body === undefined ? JSON.stringify({ names }) : options.body,
  })
}

function displayRequest(name, body, options = {}) {
  const headers = {}
  const contentType = options.contentType === undefined ? 'image/jpeg' : options.contentType
  if (contentType !== null) headers['content-type'] = contentType
  const origin = options.origin === undefined ? ORIGIN : options.origin
  if (origin !== null) headers.origin = origin
  if (options.secFetchSite !== undefined) headers['sec-fetch-site'] = options.secFetchSite
  const url = `${ORIGIN}${MANAGE_PATH}?action=display&name=${encodeURIComponent(name)}`
  return new Request(url, { method: 'POST', headers, body })
}

function deleteRequest(name, options = {}) {
  const headers = { 'content-type': 'application/json' }
  const origin = options.origin === undefined ? ORIGIN : options.origin
  if (origin !== null) headers.origin = origin
  if (options.secFetchSite !== undefined) headers['sec-fetch-site'] = options.secFetchSite
  return new Request(`${ORIGIN}${MANAGE_PATH}?action=delete`, {
    method: 'POST',
    headers,
    body: options.body === undefined ? JSON.stringify({ name }) : options.body,
  })
}

/** A PNG signature plus an IHDR that declares the requested pixel size. */
function pngOfSize(width, height) {
  const header = Buffer.alloc(24)
  PNG.copy(header, 0)
  header.writeUInt32BE(13, 8)
  header.write('IHDR', 12, 'latin1')
  header.writeUInt32BE(width, 16)
  header.writeUInt32BE(height, 20)
  return header
}

/** A JPEG with an APP0 segment and a SOF0 that declares the requested pixel size. */
function jpegOfSize(width, height) {
  const bytes = Buffer.alloc(30)
  bytes.writeUInt16BE(0xffd8, 0) // SOI
  bytes.writeUInt16BE(0xffe0, 2) // APP0
  bytes.writeUInt16BE(0x0010, 4) // segment length
  bytes.writeUInt16BE(0xffc0, 20) // SOF0
  bytes.writeUInt16BE(0x0011, 22) // segment length
  bytes[24] = 8 // sample precision
  bytes.writeUInt16BE(height, 25)
  bytes.writeUInt16BE(width, 27)
  return bytes
}

/** A GIF header that declares the requested logical-screen size. */
function gifOfSize(width, height) {
  const header = Buffer.alloc(10)
  header.write('GIF89a', 0, 'latin1')
  header.writeUInt16LE(width, 6)
  header.writeUInt16LE(height, 8)
  return header
}

/** A RIFF/WebP VP8 key-frame header with the requested encoded size. */
function webpOfSize(width, height) {
  const bytes = Buffer.alloc(30)
  bytes.write('RIFF', 0, 'latin1')
  bytes.writeUInt32LE(22, 4)
  bytes.write('WEBP', 8, 'latin1')
  bytes.write('VP8 ', 12, 'latin1')
  bytes.writeUInt32LE(10, 16)
  bytes[23] = 0x9d
  bytes[24] = 0x01
  bytes[25] = 0x2a
  bytes.writeUInt16LE(width & 0x3fff, 26)
  bytes.writeUInt16LE(height & 0x3fff, 28)
  return bytes
}

/** An AVIF `ftyp` box followed by an `ispe` box declaring the requested size. */
function avifOfSize(width, height) {
  const bytes = Buffer.alloc(36)
  bytes.writeUInt32BE(16, 0)
  bytes.write('ftyp', 4, 'latin1')
  bytes.write('avif', 8, 'latin1')
  bytes.writeUInt32BE(20, 16)
  bytes.write('ispe', 20, 'latin1')
  bytes.writeUInt32BE(0, 24) // version and flags
  bytes.writeUInt32BE(width, 28)
  bytes.writeUInt32BE(height, 32)
  return bytes
}

const SIZED_IMAGE_CASES = [
  ['photo.jpg', 'image/jpeg', jpegOfSize],
  ['photo.png', 'image/png', pngOfSize],
  ['photo.gif', 'image/gif', gifOfSize],
  ['photo.webp', 'image/webp', webpOfSize],
  ['photo.avif', 'image/avif', avifOfSize],
]

test('manage add stores the original bytes and the manifest lists the photo on the rope', async (t) => {
  const dir = await makeWritableDir(t)
  const bytes = Buffer.concat([pngOfSize(2, 2), Buffer.from('original-photo-bytes')])
  const response = await manageResource(dir)(addRequest('my photo.png', bytes))

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), { ok: true, name: 'my photo.png' })
  assert.deepEqual(await readFile(join(dir, 'my photo.png')), bytes)

  const manifestResponse = await createPhotoResource(dir)(new Request(`${ORIGIN}${ROUTE}/photos.json`))
  const manifest = await manifestResponse.json()
  assert.deepEqual(manifest.photos.map((photo) => photo.name), ['my photo.png'])
  assert.equal(manifest.photos[0].onRope, true)
})

test('manage add renames a duplicate instead of overwriting it', async (t) => {
  const dir = await makeWritableDir(t)
  const resource = manageResource(dir)
  const first = Buffer.concat([pngOfSize(2, 2), Buffer.from('first')])
  const second = Buffer.concat([pngOfSize(2, 2), Buffer.from('second')])
  const third = Buffer.concat([pngOfSize(2, 2), Buffer.from('third')])

  assert.deepEqual(await (await resource(addRequest('a.png', first))).json(), { ok: true, name: 'a.png' })
  assert.deepEqual(await (await resource(addRequest('a.png', second))).json(), { ok: true, name: 'a-2.png' })
  assert.deepEqual(await (await resource(addRequest('a.png', third))).json(), { ok: true, name: 'a-3.png' })

  assert.deepEqual(await readFile(join(dir, 'a.png')), first)
  assert.deepEqual(await readFile(join(dir, 'a-2.png')), second)
  assert.deepEqual(await readFile(join(dir, 'a-3.png')), third)
})

test('manage add refuses a body over 25MB with 413 and writes nothing', async (t) => {
  const dir = await makeWritableDir(t)
  const oversized = Buffer.alloc(MAX_PHOTO_BYTES + 1)
  PNG.copy(oversized, 0)

  const response = await manageResource(dir)(addRequest('big.png', oversized))
  assert.equal(response.status, 413)
  assert.equal((await response.json()).error, 'too-large')
  assert.deepEqual(await readdir(dir), [])
})

test('manage add accepts every supported format whose dimensions parse', async (t) => {
  const dir = await makeWritableDir(t)
  const resource = manageResource(dir)

  for (const [name, contentType, make] of SIZED_IMAGE_CASES) {
    const response = await resource(addRequest(name, make(2, 2), { contentType }))
    assert.equal(response.status, 200, `accepted ${contentType}`)
    assert.deepEqual(await response.json(), { ok: true, name })
  }
  assert.deepEqual((await readdir(dir)).sort(), SIZED_IMAGE_CASES.map(([name]) => name).sort())
})

test('manage add refuses a photo over 64MP in every supported format with 413 and writes nothing', async (t) => {
  const dir = await makeWritableDir(t)
  const resource = manageResource(dir)

  for (const [name, contentType, make] of SIZED_IMAGE_CASES) {
    const response = await resource(addRequest(name, make(10_000, 10_000), { contentType }))
    assert.equal(response.status, 413, `rejected ${contentType}`)
    assert.equal((await response.json()).error, 'too-many-pixels', `error for ${contentType}`)
  }
  assert.deepEqual(await readdir(dir), [])
})

test('manage add refuses an accepted image whose dimensions cannot be read with 400', async (t) => {
  const dir = await makeWritableDir(t)
  const resource = manageResource(dir)

  const cases = [
    /* PNG signature only: no IHDR. */
    ['broken.png', 'image/png', PNG],
    /* SOI plus APP0, but no SOF0. */
    ['broken.jpg', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x00, 0x00])],
    /* AVIF ftyp without the ispe box. */
    ['broken.avif', 'image/avif', Buffer.from([
      0x00, 0x00, 0x00, 0x10, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
      0x00, 0x00, 0x00, 0x00,
    ])],
  ]
  for (const [name, contentType, bytes] of cases) {
    const response = await resource(addRequest(name, bytes, { contentType }))
    assert.equal(response.status, 400, `expected 400 for ${name}`)
    assert.equal((await response.json()).error, 'invalid-image', `error for ${name}`)
  }
  assert.deepEqual(await readdir(dir), [])
})

test('manage add accepts the media-type aliases browsers use', async (t) => {
  const dir = await makeWritableDir(t)
  const resource = manageResource(dir)
  const cases = [
    ['alias-jpg.jpg', 'image/jpg'],
    ['alias-pjpeg.jpg', 'image/pjpeg'],
    ['alias-x-jpeg.jpeg', 'image/x-jpeg'],
    ['alias-params.jpg', 'IMAGE/JPEG; charset=binary'],
    ['alias-x-png.png', 'image/x-png'],
  ]
  for (const [name, contentType] of cases) {
    const bytes = name.endsWith('.png') ? pngOfSize(2, 2) : jpegOfSize(2, 2)
    const response = await resource(addRequest(name, bytes, { contentType }))
    assert.equal(response.status, 200, `accepted ${contentType}`)
    assert.deepEqual(await response.json(), { ok: true, name }, `response for ${contentType}`)
  }
  assert.deepEqual((await readdir(dir)).sort(), cases.map(([name]) => name).sort())
})

test('manage add refuses unsupported media types with 415', async (t) => {
  const dir = await makeWritableDir(t)
  const resource = manageResource(dir)

  const text = await resource(addRequest('notes.txt', Buffer.from('hello'), { contentType: 'text/plain' }))
  assert.equal(text.status, 415)
  assert.equal((await text.json()).error, 'unsupported-media-type')

  const mismatched = await resource(addRequest('a.png', PNG, { contentType: 'image/gif' }))
  assert.equal(mismatched.status, 415)
  assert.equal((await mismatched.json()).error, 'unsupported-media-type')

  const heic = await resource(addRequest('IMG_0001.HEIC', Buffer.from('heic'), { contentType: 'image/heic' }))
  assert.equal(heic.status, 415)
  const heicBody = await heic.json()
  assert.equal(heicBody.error, 'heic')
  assert.match(heicBody.message, /HEIC|heic/)
  assert.deepEqual(await readdir(dir), [])
})

test('manage add refuses bytes that do not match the image format with 400', async (t) => {
  const dir = await makeWritableDir(t)
  const response = await manageResource(dir)(addRequest('fake.png', JPEG))

  assert.equal(response.status, 400)
  assert.equal((await response.json()).error, 'magic-mismatch')
  assert.deepEqual(await readdir(dir), [])
})

test('manage add refuses traversal, hidden, malformed and over-long names with 400', async (t) => {
  const dir = await makeWritableDir(t)
  const resource = manageResource(dir)
  const names = [
    '../evil.png',
    '..\\evil.png',
    'sub/dir.png',
    '.hidden.png',
    'bad\u0000.png',
    `${'x'.repeat(121)}.png`,
  ]
  for (const name of names) {
    const response = await resource(addRequest(name, PNG))
    assert.equal(response.status, 400, `expected 400 for ${name}`)
    assert.equal((await response.json()).error, 'invalid-name', `error for ${name}`)
  }
  assert.deepEqual(await readdir(dir), [])
})

test('manage add refuses cross-origin and cross-site requests with 403', async (t) => {
  const dir = await makeWritableDir(t)
  const resource = manageResource(dir)

  const cases = [
    addRequest('a.png', PNG, { origin: 'http://evil.example' }),
    /* A sandboxed or opaque frame sends the literal string, not an absent header. */
    addRequest('f.png', PNG, { origin: 'null' }),
    addRequest('c.png', PNG, { secFetchSite: 'cross-site' }),
    /* A contradictory signal is refused even when no Origin accompanies it. */
    addRequest('e.png', PNG, { origin: null, secFetchSite: 'cross-site' }),
  ]
  for (const request of cases) {
    const response = await resource(request)
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'forbidden')
  }
  assert.deepEqual(await readdir(dir), [])

  const unbound = createManageResource(dir, () => {
    throw new Error('webserver: origin read before the listener bound a port')
  })
  const response = await unbound(addRequest('d.png', PNG))
  assert.equal(response.status, 403)
})

/*
 * The Desktop application renders the page at `dsh-app://app` and forwards its
 * requests to the Host through the shell's `forwardWebRequest`, which deletes
 * `host`, `origin`, `cookie` and `sec-fetch-site` before the Host ever sees them.
 * A photo-manager write from the plugin detail page therefore arrives with no
 * Origin at all; refusing that answered every action with 403
 * "请求被拒绝，请刷新页面后重试". This test sends exactly that forwarded shape:
 * no Origin, no Sec-Fetch-Site, and the Host's own cookie put in place.
 */
test('manage accepts writes the Desktop shell forwards without an Origin header', async (t) => {
  const dir = await makeWritableDir(t)
  await writeFile(join(dir, 'a.png'), PNG)
  await writeFile(join(dir, 'b.png'), PNG)
  const resource = manageResource(dir)
  const desktop = { origin: null }

  const added = await resource(addRequest(
    'c.png',
    Buffer.concat([pngOfSize(2, 2), Buffer.from('desktop-add')]),
    { ...desktop, cookie: 'dsh_web_session=forwarded-by-desktop' },
  ))
  assert.equal(added.status, 200)
  assert.deepEqual(await added.json(), { ok: true, name: 'c.png' })

  const displayed = await resource(displayRequest('a.png', JPEG, desktop))
  assert.equal(displayed.status, 200)
  assert.deepEqual(await displayed.json(), { ok: true, name: 'a.png' })

  const ordered = await resource(orderRequest(['b.png', 'a.png'], desktop))
  assert.equal(ordered.status, 200)
  assert.deepEqual(await ordered.json(), { ok: true, names: ['b.png', 'a.png'] })

  const deleted = await resource(deleteRequest('b.png', desktop))
  assert.equal(deleted.status, 200)
  assert.deepEqual(await deleted.json(), { ok: true, name: 'b.png' })

  /* The display copy lives under `.display/` and the order in `.order.json`. */
  assert.deepEqual(
    (await readdir(dir)).filter((name) => !name.startsWith('.')).sort(),
    ['a.png', 'c.png'],
  )
})

test('manage add leaves no partial file when the write fails', async (t) => {
  const dir = await makeWritableDir(t)
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    t.skip('running as root: a read-only directory does not refuse writes')
    return
  }
  await chmod(dir, 0o500)
  try {
    const response = await manageResource(dir)(addRequest('a.png', pngOfSize(2, 2)))
    assert.equal(response.status, 500)
    assert.equal((await response.json()).error, 'write-failed')
    assert.deepEqual(await readdir(dir), [])
  } finally {
    await chmod(dir, 0o700)
  }
})

test('manage display stores a hidden display copy that the manifest and read route serve', async (t) => {
  const dir = await makeWritableDir(t)
  await writeFile(join(dir, 'a.png'), PNG)
  const display = Buffer.concat([JPEG.subarray(0, JPEG.length - 2), Buffer.from('display-copy'), JPEG_EOI])

  const response = await manageResource(dir)(displayRequest('a.png', display))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8')
  assert.deepEqual(await response.json(), { ok: true, name: 'a.png' })
  assert.deepEqual(await readFile(join(dir, '.display', displayFileName('a.png'))), display)
  assert.deepEqual(await readdir(join(dir, '.display')), [displayFileName('a.png')])
  assert.deepEqual((await readdir(dir)).sort(), ['.display', 'a.png'])
  assert.deepEqual(await readFile(join(dir, 'a.png')), PNG, 'the original bytes are untouched')

  const resource = createPhotoResource(dir)
  const manifest = await (await resource(new Request(`${ORIGIN}${ROUTE}/photos.json`))).json()
  assert.deepEqual(manifest.photos.map((entry) => entry.name), ['a.png'])
  const photo = manifest.photos.find((entry) => entry.name === 'a.png')
  assert.match(photo.displayUrl, new RegExp(`^${ROUTE}/display/a\\.png\\?v=\\d+$`))
  assert.notEqual(photo.displayUrl, photo.originalUrl)

  const served = await resource(new Request(`${ORIGIN}${photo.displayUrl}`))
  assert.equal(served.status, 200)
  assert.equal(served.headers.get('content-type'), 'image/jpeg')
  assert.deepEqual(Buffer.from(await served.arrayBuffer()), display)
})

test('manage display rejects an unknown original name without writing a copy', async (t) => {
  const dir = await makeWritableDir(t)
  await writeFile(join(dir, 'notes.txt'), 'not an image')
  const resource = manageResource(dir)

  for (const name of ['missing.png', 'missing.jpg', 'missing.avif']) {
    const response = await resource(displayRequest(name, JPEG))
    assert.equal(response.status, 404, `expected 404 for ${name}`)
    assert.equal((await response.json()).error, 'not-found', `error for ${name}`)
  }
  assert.deepEqual(await readdir(dir), ['notes.txt'])
})

test('manage delete removes the original, its display copy and the manifest entry', async (t) => {
  const dir = await makeWritableDir(t)
  await writeFile(join(dir, 'a.png'), PNG)
  await writeFile(join(dir, 'b.png'), PNG)
  await mkdir(join(dir, '.display'))
  await writeFile(join(dir, '.display', displayFileName('a.png')), JPEG)
  await writeFile(join(dir, '.display', displayFileName('b.png')), JPEG)

  const response = await manageResource(dir)(deleteRequest('a.png'))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8')
  assert.deepEqual(await response.json(), { ok: true, name: 'a.png' })

  assert.deepEqual((await readdir(dir)).sort(), ['.display', 'b.png'])
  assert.deepEqual(await readdir(join(dir, '.display')), [displayFileName('b.png')])

  const manifestResponse = await createPhotoResource(dir)(new Request(`${ORIGIN}${ROUTE}/photos.json`))
  const manifest = await manifestResponse.json()
  assert.deepEqual(manifest.photos.map((photo) => photo.name), ['b.png'])
})

test('manage delete removes the name from .order.json and keeps the remaining order', async (t) => {
  const dir = await makeWritableDir(t)
  for (const name of ['a.png', 'b.png', 'c.png']) await writeFile(join(dir, name), PNG)
  await writeFile(join(dir, '.order.json'), JSON.stringify(['c.png', 'a.png', 'b.png']))

  const response = await manageResource(dir)(deleteRequest('a.png'))
  assert.equal(response.status, 200)
  assert.deepEqual(JSON.parse(await readFile(join(dir, '.order.json'), 'utf8')), ['c.png', 'b.png'])
  assert.deepEqual((await readdir(dir)).sort(), ['.order.json', 'b.png', 'c.png'])
})

test('manage delete leaves other photos and an unrelated order file untouched', async (t) => {
  const dir = await makeWritableDir(t)
  for (const name of ['a.png', 'b.png']) await writeFile(join(dir, name), PNG)
  await writeFile(join(dir, '.order.json'), JSON.stringify(['b.png']))

  const response = await manageResource(dir)(deleteRequest('a.png'))
  assert.equal(response.status, 200)
  assert.deepEqual(await readdir(join(dir)), ['.order.json', 'b.png'])
  assert.deepEqual(JSON.parse(await readFile(join(dir, '.order.json'), 'utf8')), ['b.png'])
})

test('manage delete tolerates a missing or corrupt .order.json', async (t) => {
  const dir = await makeWritableDir(t)
  await writeFile(join(dir, 'a.png'), PNG)
  await writeFile(join(dir, 'b.png'), PNG)

  const noOrder = await manageResource(dir)(deleteRequest('a.png'))
  assert.equal(noOrder.status, 200)
  assert.equal((await readdir(dir)).includes('.order.json'), false)

  await writeFile(join(dir, '.order.json'), 'not json at all')
  const corruptOrder = await manageResource(dir)(deleteRequest('b.png'))
  assert.equal(corruptOrder.status, 200)
  assert.equal(await readFile(join(dir, '.order.json'), 'utf8'), 'not json at all')
  assert.deepEqual(await readdir(dir), ['.order.json'])
})

test('manage order then delete keeps the remaining sequence and rope selection coherent', async (t) => {
  const dir = await makeWritableDir(t)
  for (const name of ['a.png', 'b.png', 'c.png']) await writeFile(join(dir, name), PNG)
  const resource = manageResource(dir)

  assert.equal((await resource(orderRequest(['c.png', 'b.png', 'a.png']))).status, 200)
  assert.equal((await resource(deleteRequest('c.png'))).status, 200)
  assert.deepEqual(JSON.parse(await readFile(join(dir, '.order.json'), 'utf8')), ['b.png', 'a.png'])

  const manifest = await (await createPhotoResource(dir)(
    new Request(`${ORIGIN}${ROUTE}/photos.json`),
  )).json()
  assert.deepEqual(manifest.photos.map((photo) => photo.name), ['b.png', 'a.png'])
})

test('manage delete answers 404 for a name that is not in the photo folder', async (t) => {
  const dir = await makeWritableDir(t)
  await writeFile(join(dir, 'a.png'), PNG)

  const response = await manageResource(dir)(deleteRequest('missing.png'))
  assert.equal(response.status, 404)
  assert.equal((await response.json()).error, 'not-found')
  assert.deepEqual(await readdir(dir), ['a.png'])
})

test('manage delete refuses traversal, hidden, malformed and over-long names', async (t) => {
  const dir = await makeWritableDir(t)
  await writeFile(join(dir, 'a.png'), PNG)
  await writeFile(join(dir, 'notes.txt'), 'keep me')
  const resource = manageResource(dir)

  const invalidNames = [
    '../evil.png',
    '..\\evil.png',
    'sub/dir.png',
    '.hidden.png',
    'bad\u0000.png',
    `${'x'.repeat(121)}.png`,
  ]
  for (const name of invalidNames) {
    const response = await resource(deleteRequest(name))
    assert.equal(response.status, 400, `expected 400 for ${name}`)
    assert.equal((await response.json()).error, 'invalid-name', `error for ${name}`)
  }

  const unknownType = await resource(deleteRequest('notes.txt'))
  assert.equal(unknownType.status, 404)
  assert.equal((await unknownType.json()).error, 'not-found')
  assert.deepEqual((await readdir(dir)).sort(), ['a.png', 'notes.txt'])
})

test('manage display accepts the image/jpg alias for its JPEG body', async (t) => {
  const dir = await makeWritableDir(t)
  await writeFile(join(dir, 'a.png'), PNG)

  const response = await manageResource(dir)(displayRequest('a.png', JPEG, { contentType: 'image/jpg' }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, name: 'a.png' })
  assert.deepEqual(await readFile(join(dir, '.display', displayFileName('a.png'))), JPEG)
})

test('manage display only accepts JPEG bytes declared as image/jpeg', async (t) => {
  const dir = await makeWritableDir(t)
  await writeFile(join(dir, 'a.png'), PNG)
  const resource = manageResource(dir)

  const wrongType = await resource(displayRequest('a.png', JPEG, { contentType: 'image/png' }))
  assert.equal(wrongType.status, 415)
  assert.equal((await wrongType.json()).error, 'unsupported-media-type')

  const missingType = await resource(displayRequest('a.png', JPEG, { contentType: null }))
  assert.equal(missingType.status, 415)

  const wrongMagic = await resource(displayRequest('a.png', PNG))
  assert.equal(wrongMagic.status, 400)
  assert.equal((await wrongMagic.json()).error, 'magic-mismatch')

  assert.deepEqual(await readdir(dir), ['a.png'])
})

test('manage display refuses a body over the photo size cap with 413 and writes nothing', async (t) => {
  const dir = await makeWritableDir(t)
  await writeFile(join(dir, 'a.png'), PNG)
  const oversized = Buffer.alloc(MAX_PHOTO_BYTES + 1)
  JPEG.copy(oversized, 0)

  const response = await manageResource(dir)(displayRequest('a.png', oversized))
  assert.equal(response.status, 413)
  assert.equal((await response.json()).error, 'too-large')
  assert.deepEqual(await readdir(dir), ['a.png'])
})

test('manage delete refuses malformed JSON and non-string names with 400', async (t) => {
  const dir = await makeWritableDir(t)
  await writeFile(join(dir, 'a.png'), PNG)
  const resource = manageResource(dir)

  const malformed = await resource(deleteRequest('a.png', { body: '{"name": ' }))
  assert.equal(malformed.status, 400)
  assert.equal((await malformed.json()).error, 'invalid-request')

  for (const body of ['{}', '{"name": 42}', 'null', '["a.png"]']) {
    const response = await resource(deleteRequest('a.png', { body }))
    assert.equal(response.status, 400, `expected 400 for ${body}`)
    assert.equal((await response.json()).error, 'invalid-name', `error for ${body}`)
  }
  assert.deepEqual(await readdir(dir), ['a.png'])
})

test('manage display refuses cross-origin and cross-site writes with 403', async (t) => {
  const dir = await makeWritableDir(t)
  await writeFile(join(dir, 'a.png'), PNG)
  const resource = manageResource(dir)

  const cases = [
    displayRequest('a.png', JPEG, { origin: 'http://evil.example' }),
    displayRequest('a.png', JPEG, { secFetchSite: 'cross-site' }),
  ]
  for (const request of cases) {
    const response = await resource(request)
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'forbidden')
  }
  assert.deepEqual(await readdir(dir), ['a.png'])
})

test('manage delete refuses cross-origin and cross-site writes with 403', async (t) => {
  const dir = await makeWritableDir(t)
  await writeFile(join(dir, 'a.png'), PNG)
  const resource = manageResource(dir)

  const cases = [
    deleteRequest('a.png', { origin: 'http://evil.example' }),
    deleteRequest('a.png', { secFetchSite: 'cross-site' }),
  ]
  for (const request of cases) {
    const response = await resource(request)
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'forbidden')
  }
  assert.deepEqual(await readdir(dir), ['a.png'])
})

test('manage display refuses traversal, hidden and unsupported names with 400', async (t) => {
  const dir = await makeWritableDir(t)
  await writeFile(join(dir, 'a.png'), PNG)
  const resource = manageResource(dir)

  for (const name of ['../evil.png', '..\\evil.png', 'sub/a.png', '.hidden.png', 'bad\u0000.png', 'a.heic', 'a.txt']) {
    const response = await resource(displayRequest(name, JPEG))
    assert.equal(response.status, 400, `expected 400 for ${name}`)
    assert.equal((await response.json()).error, 'invalid-name', `error for ${name}`)
  }
  assert.deepEqual(await readdir(dir), ['a.png'])
})

test('manage resource rejects non-POST methods, unknown actions and unknown paths', async (t) => {
  const dir = await makeWritableDir(t)
  const resource = manageResource(dir)

  const get = await resource(new Request(`${ORIGIN}${MANAGE_PATH}?action=add&name=a.png`))
  assert.equal(get.status, 405)
  assert.equal(get.headers.get('allow'), 'POST')

  const unknownAction = await resource(new Request(`${ORIGIN}${MANAGE_PATH}?action=frobnicate&name=a.png`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: '{}',
  }))
  assert.equal(unknownAction.status, 400)
  assert.equal((await unknownAction.json()).error, 'unknown-action')

  const missingAction = await resource(new Request(`${ORIGIN}${MANAGE_PATH}?name=a.png`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'image/png' },
    body: PNG,
  }))
  assert.equal(missingAction.status, 400)

  const elsewhere = await resource(new Request(`${ORIGIN}${ROUTE}/photos.json`, { method: 'POST' }))
  assert.equal(elsewhere.status, 404)
})

test('manage order writes .order.json and the manifest follows it', async (t) => {
  const dir = await makeWritableDir(t)
  for (const name of ['a.png', 'b.png', 'c.png']) await writeFile(join(dir, name), PNG)

  const response = await manageResource(dir)(orderRequest(['c.png', 'a.png']))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8')
  assert.deepEqual(await response.json(), { ok: true, names: ['c.png', 'a.png'] })
  assert.deepEqual(JSON.parse(await readFile(join(dir, '.order.json'), 'utf8')), ['c.png', 'a.png'])
  assert.deepEqual(
    (await readdir(dir)).filter((name) => name.endsWith('.tmp')),
    [],
    'no temp file is left behind',
  )

  const manifest = await (await createPhotoResource(dir)(
    new Request(`${ORIGIN}${ROUTE}/photos.json`),
  )).json()
  assert.deepEqual(manifest.photos.map((photo) => photo.name), ['c.png', 'a.png', 'b.png'])
  assert.deepEqual(
    manifest.photos.filter((photo) => photo.onRope).map((photo) => photo.name),
    ['c.png', 'a.png', 'b.png'],
  )
})

test('manage order ignores missing names, collapses duplicates and can reset to natural order', async (t) => {
  const dir = await makeWritableDir(t)
  for (const name of ['a.png', 'b.png', 'c.png']) await writeFile(join(dir, name), PNG)

  const resource = manageResource(dir)
  const response = await resource(orderRequest(['missing.png', 'b.png', 'b.png', 'c.png']))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, names: ['b.png', 'c.png'] })

  const manifest = await (await createPhotoResource(dir)(
    new Request(`${ORIGIN}${ROUTE}/photos.json`),
  )).json()
  assert.deepEqual(manifest.photos.map((photo) => photo.name), ['b.png', 'c.png', 'a.png'])

  const reset = await resource(orderRequest([]))
  assert.equal(reset.status, 200)
  assert.deepEqual(await reset.json(), { ok: true, names: [] })
  assert.deepEqual(JSON.parse(await readFile(join(dir, '.order.json'), 'utf8')), [])
  const natural = await (await createPhotoResource(dir)(
    new Request(`${ORIGIN}${ROUTE}/photos.json`),
  )).json()
  assert.deepEqual(natural.photos.map((photo) => photo.name), ['a.png', 'b.png', 'c.png'])
})

test('manage order refuses malformed, mistyped and oversized bodies without writing', async (t) => {
  const dir = await makeWritableDir(t)
  for (const name of ['a.png', 'b.png']) await writeFile(join(dir, name), PNG)
  const resource = manageResource(dir)

  const notJson = await resource(orderRequest(null, { contentType: 'text/plain', body: '{}' }))
  assert.equal(notJson.status, 415)
  const heic = await resource(orderRequest(null, { contentType: 'image/png', body: PNG }))
  assert.equal(heic.status, 415)

  for (const body of ['{not json', '{}', '{"names":"a.png"}', '{"names":[42]}']) {
    const response = await resource(orderRequest(null, { body }))
    assert.equal(response.status, 400, `body: ${body}`)
    const payload = await response.json()
    assert.ok(payload.error === 'invalid-order' || payload.error === 'invalid-name', `body: ${body}`)
  }

  const traversal = await resource(orderRequest(['../evil.png']))
  assert.equal(traversal.status, 400)
  assert.equal((await traversal.json()).error, 'invalid-name')

  const oversized = JSON.stringify({
    names: Array.from({ length: 2000 }, (_, index) => `photo-${index}-${'x'.repeat(32)}.png`),
  })
  const tooLarge = await resource(orderRequest(null, { body: oversized }))
  assert.equal(tooLarge.status, 413)
  assert.equal((await tooLarge.json()).error, 'too-large')

  assert.deepEqual((await readdir(dir)).sort(), ['a.png', 'b.png'])
})

test('manage order refuses cross-origin and cross-site writes with 403', async (t) => {
  const dir = await makeWritableDir(t)
  await writeFile(join(dir, 'a.png'), PNG)
  const resource = manageResource(dir)
  const requests = [
    orderRequest(['a.png'], { origin: 'http://evil.example' }),
    orderRequest(['a.png'], { secFetchSite: 'cross-site' }),
  ]
  for (const request of requests) {
    const response = await resource(request)
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'forbidden')
  }
  assert.deepEqual(await readdir(dir), ['a.png'])
})

test('manage order leaves the previous order intact when the write fails', async (t) => {
  const dir = await makeWritableDir(t)
  for (const name of ['a.png', 'b.png']) await writeFile(join(dir, name), PNG)
  const resource = manageResource(dir)
  assert.equal((await resource(orderRequest(['b.png', 'a.png']))).status, 200)

  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    t.skip('running as root: a read-only directory does not refuse writes')
    return
  }
  await chmod(dir, 0o500)
  try {
    const response = await resource(orderRequest(['a.png']))
    assert.equal(response.status, 500)
    assert.equal((await response.json()).error, 'write-failed')
    assert.deepEqual(JSON.parse(await readFile(join(dir, '.order.json'), 'utf8')), ['b.png', 'a.png'])
    assert.deepEqual((await readdir(dir)).filter((name) => name.endsWith('.tmp')), [])
  } finally {
    await chmod(dir, 0o700)
  }
})
