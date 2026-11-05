import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPhotoResource, listPhotos, ROUTE, servePhoto } from '../lib/photos.js'
import { apply } from '../index.js'

/* Magic bytes only; the route never looks inside the image. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])

async function makeFixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'snap-line-'))
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

test('listPhotos lists supported images in natural name order', async (t) => {
  const dir = await makeFixture(t)
  const listing = await listPhotos(dir)
  assert.deepEqual(
    listing.photos.map((photo) => photo.name),
    ['a.jpg', 'b.png', 'photo 10.webp'],
  )
  for (const photo of listing.photos) {
    assert.match(photo.url, new RegExp(`^${ROUTE}/photos/.+\\?v=\\d+$`))
  }
  assert.match(listing.revision, /^[0-9a-f]{12}$/)
})

test('listPhotos treats a missing folder as empty', async () => {
  const listing = await listPhotos(join(tmpdir(), `snap-line-missing-${process.pid}-${Date.now()}`))
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

test('servePhoto returns bytes with the media type and no-sniff header', async (t) => {
  const dir = await makeFixture(t)
  const response = await servePhoto(dir, encodeURIComponent('photo 10.webp'))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/webp')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('cache-control'), 'private, max-age=60')
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

test('apply registers the prefix route for the photo folder', async () => {
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
  apply(ctx)
  assert.equal(registered.length, 1)
  const [route] = registered
  assert.equal(route.kind, 'prefix')
  assert.equal(route.path, ROUTE)

  const response = await route.resource(new Request(`http://127.0.0.1:57370${ROUTE}/photos.json`))
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.ok(Array.isArray(payload.photos))
})
