import test from 'node:test'
import assert from 'node:assert/strict'
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
  const url = `${ORIGIN}${MANAGE_PATH}?action=add&name=${encodeURIComponent(name)}`
  return new Request(url, {
    method: 'POST',
    headers,
    body,
  })
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
  const first = Buffer.concat([PNG, Buffer.from('first')])
  const second = Buffer.concat([PNG, Buffer.from('second')])
  const third = Buffer.concat([PNG, Buffer.from('third')])

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

test('manage add refuses a photo over 64MP with 413 and writes nothing', async (t) => {
  const dir = await makeWritableDir(t)
  const response = await manageResource(dir)(addRequest('huge.png', pngOfSize(10_000, 10_000)))

  assert.equal(response.status, 413)
  assert.equal((await response.json()).error, 'too-many-pixels')
  assert.deepEqual(await readdir(dir), [])
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

test('manage add refuses cross-origin, cross-site and origin-less requests with 403', async (t) => {
  const dir = await makeWritableDir(t)
  const resource = manageResource(dir)

  const cases = [
    addRequest('a.png', PNG, { origin: 'http://evil.example' }),
    addRequest('b.png', PNG, { origin: null }),
    addRequest('c.png', PNG, { secFetchSite: 'cross-site' }),
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

test('manage add leaves no partial file when the write fails', async (t) => {
  const dir = await makeWritableDir(t)
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    t.skip('running as root: a read-only directory does not refuse writes')
    return
  }
  await chmod(dir, 0o500)
  try {
    const response = await manageResource(dir)(addRequest('a.png', PNG))
    assert.equal(response.status, 500)
    assert.equal((await response.json()).error, 'write-failed')
    assert.deepEqual(await readdir(dir), [])
  } finally {
    await chmod(dir, 0o700)
  }
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

test('manage delete refuses cross-origin and cross-site requests with 403', async (t) => {
  const dir = await makeWritableDir(t)
  await writeFile(join(dir, 'a.png'), PNG)

  const cases = [
    deleteRequest('a.png', { origin: 'http://evil.example' }),
    deleteRequest('a.png', { origin: null }),
    deleteRequest('a.png', { secFetchSite: 'cross-site' }),
  ]
  for (const request of cases) {
    const response = await manageResource(dir)(request)
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'forbidden')
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
