import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (name) => readFile(join(root, name), 'utf8')

test('manifest declares a web bundle with both halves', async () => {
  const pkg = JSON.parse(await read('package.json'))
  assert.equal(pkg.name, 'dsh-snap-line')
  assert.equal(pkg.type, 'module')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.icon, 'icon.svg')
  assert.equal(pkg.scripts.prepublishOnly, 'npm run check')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.equal(pkg.dsh.client.immediately, true)
  assert.deepEqual(pkg.dsh.client.inject, ['@deepseek-ai/dsh-client-ui-conversation'])

  for (const file of ['index.js', 'lib', 'client.js', 'cordis.patch.yml', 'locale/*.json', 'icon.svg', 'docs/icon.png']) {
    assert.ok(pkg.files.includes(file), `files should include ${file}`)
  }
  assert.ok(pkg.files.every((entry) => !entry.includes('photos')), 'personal photos must stay out of the package')
})

test('bundle patch inserts a row whose name matches the package', async () => {
  const pkg = JSON.parse(await read('package.json'))
  const patch = await read('cordis.patch.yml')
  assert.match(patch, /- insert:/)
  assert.match(patch, /id: dsh-snap-line/)
  assert.match(patch, new RegExp(`name: '${pkg.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`))
})

test('client half uses the package name as module id and photo route', async () => {
  const pkg = JSON.parse(await read('package.json'))
  const client = await read('client.js')
  assert.match(client, new RegExp(`id: '${pkg.name}'`))
  assert.match(client, /PHOTO_ENDPOINT = '\/dsh-snap-line\/photos\.json'/)
  assert.match(client, /name: 'conversation\.composer\.dock'/)
  assert.match(client, /order: 2/)
  assert.doesNotMatch(client, /photo-clothesline/)
})

test('client renders only on-rope photos and opens originals', async () => {
  const client = await read('client.js')
  assert.doesNotMatch(client, /samplePhotos/)
  assert.match(client, /entry\.onRope === true/)
  assert.match(client, /userPhotoImage\(item\.displayUrl\)/)
  assert.match(client, /url: item\.originalUrl/)
})

test('new-session hero hangs the clothesline through the shell overlay', async () => {
  const client = await read('client.js')
  assert.match(client, /name: 'shell\.overlay'/)
  assert.match(client, /id: 'dsh-snap-line-hero'/)
  assert.match(client, /\[data-content-phase="hero"\] \[data-composer-dock\]/)
  assert.match(client, /require\('react-dom'\)/)
  assert.match(client, /createPortal/)
  assert.match(client, /HERO_SVG_WIDTH = 600/)
  assert.match(client, /h\(Clothesline, \{ source: 'hero', width \}\)/)
  assert.match(client, /data-composer-card/)
})

test('hover nudge is CSS-only and gated on pointer and motion preferences', async () => {
  const client = await read('client.js')
  assert.match(client, /className: 'sl-photo'/)
  assert.match(client, /className: 'sl-wobble'/)
  assert.match(client, /@keyframes sl-wobble/)
  assert.match(client, /\.sl-photo:hover \.sl-wobble \{/)
  assert.match(client, /@media \(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\)/)
  assert.match(client, /\.sl-photo \{[^}]*pointer-events: auto;/)
  assert.doesNotMatch(client, /addEventListener\('(?:mouse|pointer)|onMouseEnter|onMouseMove/)
})

test('clicking a photo opens a dismissible lightbox', async () => {
  const client = await read('client.js')
  assert.match(client, /className: 'sl-lightbox'/)
  assert.match(client, /role: 'dialog'/)
  assert.match(client, /'aria-modal': 'true'/)
  assert.match(client, /关闭预览/)
  assert.match(client, /addEventListener\('keydown'/)
  assert.match(client, /className: 'sl-lightbox-photo'/)
  assert.match(client, /className: 'sl-lightbox-polaroid'/)
  assert.match(client, /onClick: onOpen/)
  assert.match(client, /createPortal\(overlay, document\.body\)/)
  assert.match(client, /role: 'button'/)
  assert.match(client, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(client, /event\.key !== 'Tab'/)
})

test('locales expose non-empty display metadata', async () => {
  for (const locale of ['en', 'zh']) {
    const data = JSON.parse(await read(`locale/${locale}.json`))
    assert.ok(typeof data.meta.title === 'string' && data.meta.title.length > 0, `${locale} title`)
    assert.ok(typeof data.meta.description === 'string' && data.meta.description.length > 20, `${locale} description`)
  }
})

test('icon is a small standalone SVG', async () => {
  const icon = await read('icon.svg')
  assert.match(icon, /^<svg[\s>]/)
  assert.match(icon, /<\/svg>\s*$/)
  assert.ok(Buffer.byteLength(icon) <= 256 * 1024)
})

test('photos folder keeps a tracked placeholder', async () => {
  const note = await read('photos/README.md')
  assert.match(note, /照片/)
  assert.match(note, /不再读取/)
  assert.match(note, /dsh-snap-line\/photos/)
})

test('package metadata points at the public GitHub repository', async () => {
  const pkg = JSON.parse(await read('package.json'))
  assert.equal(pkg.engines.dsh, '^0.2.0')
  assert.equal(pkg.repository.url, 'git+https://github.com/LMhuo/dsh-snap-line.git')
  assert.equal(pkg.homepage, 'https://github.com/LMhuo/dsh-snap-line#readme')
  assert.equal(pkg.bugs.url, 'https://github.com/LMhuo/dsh-snap-line/issues')
  assert.ok(pkg.files.includes('docs/images'), 'README preview must ship in the package')
})

test('documentation ships a Chinese primary README and an English one', async () => {
  const zh = await read('README.md')
  const en = await read('README.en.md')
  assert.match(zh, /docs\/images\/preview\.png/)
  assert.match(en, /docs\/images\/preview\.png/)
  assert.match(zh, /README\.en\.md/)
  assert.match(en, /README\.md/)
  const png = await readFile(join(root, 'docs/images/preview.png'))
  assert.equal(png.subarray(1, 4).toString('latin1'), 'PNG')
})

test('market screenshots are declared and shipped', async () => {
  const list = JSON.parse(await read('screenshots.json'))
  assert.ok(Array.isArray(list))
  assert.ok(list.length >= 1 && list.length <= 8)
  for (const relative of list) {
    assert.match(relative, /^docs\/images\/[^/]+\.(png|jpe?g|webp)$/)
    const bytes = await readFile(join(root, relative))
    assert.equal(bytes.subarray(1, 4).toString('latin1'), 'PNG', `${relative} should be a PNG`)
  }
  const zh = await read('README.md')
  const en = await read('README.en.md')
  for (const name of ['hero.png', 'lightbox.png']) {
    assert.match(zh, new RegExp(`docs/images/${name}`))
    assert.match(en, new RegExp(`docs/images/${name}`))
  }
  const icon = await readFile(join(root, 'docs/icon.png'))
  assert.equal(icon.subarray(1, 4).toString('latin1'), 'PNG')
})

test('GitHub Actions runs the same check as a local build', async () => {
  const ci = await read('.github/workflows/ci.yml')
  assert.match(ci, /npm run check/)
  assert.match(ci, /node-version:/)
})
