/**
 * SnapLine — Host half.
 *
 * Serves the user's photo folder (`$DSH_HOME/dsh-snap-line/photos`) to the
 * Client half, which hangs the images on a clothesline under the message
 * composer, and accepts photo-manager writes from the plugin's detail page:
 * same-origin ones over the web GUI, and the Desktop application's forwarded
 * requests, which arrive without an `Origin` header. Everything is served from
 * this machine over the Harness web server; no external requests.
 */
import { Readable } from 'node:stream'
import { createManageResource, createPhotoResource, MANAGE_PATH, photoFolder, ROUTE } from './lib/photos.js'

export const inject = ['webServer']

/** Adapt one raw Node request into the Fetch-shaped request the write resource expects. */
function toFetchRequest(req) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) for (const item of value) headers.append(name, item)
    else headers.set(name, value)
  }
  const method = (req.method ?? 'GET').toUpperCase()
  const body = method === 'GET' || method === 'HEAD' ? undefined : Readable.toWeb(req)
  return new Request(new URL(req.url ?? '/', 'http://127.0.0.1'), {
    method,
    headers,
    ...(body === undefined ? {} : { body, duplex: 'half' }),
  })
}

/** Write one Fetch-shaped response back through the raw Node response. */
async function serveManage(resource, req, res) {
  try {
    const response = await resource(toFetchRequest(req))
    const headers = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })
    res.writeHead(response.status, headers)
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch {
    if (!res.headersSent) {
      res.writeHead(500, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      })
      res.end(JSON.stringify({ error: 'server-error', message: 'Could not handle the photo request.' }))
    } else {
      res.destroy()
    }
  } finally {
    /* Refused writes may answer before the browser finished uploading. */
    if (!req.readableEnded && !req.destroyed) req.resume()
  }
}

export function apply(ctx) {
  const dir = photoFolder()
  const manage = createManageResource(dir, () => ctx.webServer.getOrigin())

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    resource: createPhotoResource(dir),
  }), 'dsh-snap-line: photo files')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: MANAGE_PATH,
    handler: (req, res) => serveManage(manage, req, res),
  }), 'dsh-snap-line: photo manager')
}
