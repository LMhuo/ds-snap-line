/**
 * SnapLine — Host half.
 *
 * Serves the user's photo folder (`$DSH_HOME/dsh-snap-line/photos`) to the
 * Client half, which hangs the images on a clothesline under the message
 * composer. Everything is served from this machine over the Harness web
 * server; no external requests.
 */
import { createPhotoResource, photoFolder, ROUTE } from './lib/photos.js'

export const inject = ['webServer']

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    resource: createPhotoResource(photoFolder()),
  }), 'dsh-snap-line: photo files')
}
