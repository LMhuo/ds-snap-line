# Changelog

All notable changes to SnapLine are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Photo manager in the installed plugin's detail page (the `plugins.bundle.config`
  slot, keyed by package name): multi-select add, delete, and drag-to-reorder.
  The order decides which six photos hang on the rope.
- Original and display copy: adding a photo generates a display copy in the
  browser (1280px longest edge, JPEG, usually a few hundred KB); the clothesline
  and list thumbnails use it, while the lightbox loads the original.
- The order is persisted in the photo folder's `.order.json`, display copies in
  `.display/`.
- A write route at `/dsh-snap-line/manage` for adding, deleting, reordering and
  display-copy writes: same-origin request policy, 25MB / 64MP per photo,
  magic-byte validation, temp file + rename.
- Hand-placed files are still picked up by the five-second poll; after a write
  the clothesline refreshes immediately via a window event.
- `docs/adr/0001-photos-live-in-dsh-home.md` and `GLOSSARY.md`.

### Changed

- Photos now live in `$DSH_HOME/dsh-snap-line/photos` (default
  `~/.dsh/dsh-snap-line/photos`) instead of the package's `photos/` folder, so
  installing an update no longer loses them.
- The clothesline shows the first six photos in order; the previous even
  sampling is gone. README, README.en and `photos/README.md` describe the new
  location and workflow.

### Removed

- The package's `photos/` folder is no longer read. Photos left there when
  upgrading from 1.3.x are not migrated; re-add them from the detail page.

## [1.3.1] - 2026-11-09

### Added

- Storefront assets for the plugin market: `docs/images/hero.png`,
  `docs/images/lightbox.png` and a `screenshots.json` beside `package.json`,
  plus `docs/icon.png` as the market tile.
- Photos are keyboard-operable: each frame is a focusable button, Enter or
  Space opens the lightbox, Tab stays on the close button while it is open,
  focus returns to the photo that opened it, and the page behind does not
  scroll.
- The clothesline, photos, lightbox and close button carry bilingual
  Chinese/English accessible names.
- `prepublishOnly` runs the full check suite before an npm publish.

### Changed

- Photo responses also send `Content-Length`, alongside the existing
  `X-Content-Type-Options` header.
- README leads with the npm install, documents creating the missing `photos/`
  folder for package installs, and adds the new screenshots, keyboard notes
  and upgrade instructions.
- Published to npm as `dsh-snap-line@1.3.1`.

## [1.3.0] - 2026-11-09

### Added

- Published to npm as [`dsh-snap-line`](https://www.npmjs.com/package/dsh-snap-line):
  `install_bundle` can install it by package name, and the plugin market can
  map the published package back to this repository.

### Changed

- Renamed the project to `dsh-snap-line`. The npm package name, the bundle
  patch row, the client module id, the photo route (`/dsh-snap-line`), the
  slot ids, the DOM attributes and the repository URLs all follow the new
  name; the user-facing brand stays **SnapLine**. Profiles that installed the
  plugin under the old name must reinstall it (`remove_bundle`, then
  `install_bundle`) because the profile dependency key changes.

## [1.2.0] - 2026-11-06

### Added

- Hovering a photo nudges it: a short CSS `:hover` animation layered on top of
  the ambient sway, ending back at rest. The nudge is transform-only (no layout,
  no JS listeners, no React re-renders) and stays limited to hover-capable,
  motion-friendly devices.
- Clicking a photo opens a lightbox: user photos render at their full aspect
  ratio, built-in illustrations as an enlarged polaroid. It closes on `Esc`, a
  backdrop click or the × button, mounts only while open, and is portaled to
  `document.body` so the dock/hero layout cannot clip it. `prefers-reduced-
  motion` skips the fade/pop.
- The photo frames now always accept pointer events (for click-to-enlarge);
  the wrapper still stays `pointer-events: none`, so only the pictures react.

### Changed

- Reworked the documentation for the public GitHub release: this README is now
  the Chinese primary document with a full English version in `README.en.md`,
  plus a preview image, install options and an FAQ.
- Added GitHub Actions CI (Node 20 / 22 / 24), issue and pull-request templates,
  and filled in the GitHub repository/homepage/issue URLs in `package.json`.
- Declared `engines.dsh: ^0.2.0` (and `dsh.manifestVersion: 1`) so Harness skips
  the bundle on incompatible releases instead of loading it half-working.
- Added a rendered preview image (`docs/images/preview.png`) and included
  `docs/images` in the npm package so the README image also resolves there.


## [1.1.0] - 2026-11-05

### Added

- The clothesline now appears on the New Session home page (blank Hero). The
  Host only renders `conversation.composer.dock` for an active Session, so the
  Client half registers a `shell.overlay` entry that portals the same artwork
  into `[data-content-phase="hero"] [data-composer-dock]`, and steps aside as
  soon as the normal dock entry mounts. The Hero copy renders at twice the dock
  size (explicit 600px, clamped to the measured composer card width); the
  conversation dock is unchanged.

## [1.0.0] - 2026-11-05

### Added

- Clothesline of polaroid photos hanging under the message composer
  (`conversation.composer.dock`, order 2).
- Five hand-drawn placeholder photos used while the `photos/` folder is empty.
- `photos/` folder support: `.jpg` `.jpeg` `.png` `.webp` `.gif` `.avif`, natural
  sort, up to six photos evenly sampled, live refresh within five seconds.
- Host half serving `/snap-line/photos.json` and `/snap-line/photos/<name>`
  with traversal and media-type guards.
- English and Chinese display metadata, plugin icon, tests and documentation.
