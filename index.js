/**
 * SnapLine — Host half.
 *
 * Serves the package's `photos/` folder to the Client half, which hangs the
 * images on a clothesline under the message composer. Everything is served
 * from this machine over the Harness web server; no external requests.
 */
import { fileURLToPath } from 'node:url'
import { createPhotoResource, ROUTE } from './lib/photos.js'

export const inject = ['webServer']

const PHOTOS_DIR = fileURLToPath(new URL('./photos/', import.meta.url))

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    resource: createPhotoResource(PHOTOS_DIR),
  }), 'snap-line: photo files')
}
