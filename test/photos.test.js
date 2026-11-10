import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPhotoResource, displayFileName, listPhotos, photoFolder, ROUTE, servePhoto } from '../lib/photos.js'
import { apply } from '../index.js'

/* Magic bytes only; the route never looks inside the image. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])

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
  assert.equal(registered.length, 1)
  const [route] = registered
  assert.equal(route.kind, 'prefix')
  assert.equal(route.path, ROUTE)

  const response = await route.resource(new Request(`http://127.0.0.1:57370${ROUTE}/photos.json`))
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.deepEqual(payload.photos.map((photo) => photo.name), ['from-home.png'])
})
