# 写入路由接受“没有 Origin”的请求，因为 Desktop 会剥掉它

照片管理器的写入路由（`POST /dsh-snap-line/manage`）需要挡住网页的跨站写入。最初的做法是“要求 `Origin` 与 webServer 的 origin 完全一致，缺少 `Origin` 直接拒绝”。这在浏览器里正确，但在 Desktop 应用里让**所有**写入都 403：Desktop 应用从自己的 `dsh-app://app` 源加载页面，再由壳把请求转发给 Host，转发函数 `forwardWebRequest()` 会删掉 `host`、`origin`、`cookie`、`sec-fetch-site` 四个头，插件永远看不到 `Origin`。

改成只拒绝**互相矛盾**的信号：`Sec-Fetch-Site: cross-site`，以及存在但与 webServer origin 不一致的 `Origin`（含字面量 `Origin: null`，那是沙箱/不透明源的形状）。缺少 `Origin` 视为可信。

## Considered Options

- **保持“缺 `Origin` 即拒绝”（原实现）**：浏览器语义上更严格，但 Desktop 应用里照片管理器完全不可用，且刷新、重装都无法绕过——这是平台转发行为，不是缓存问题。
- **接受 `Origin: dsh-app://app`**：壳在转发前就把这个头删掉了，插件根本收不到，改不了任何东西。
- **接受 `Origin: *` 或不检查同源**：会真正打开网页跨站写入的洞。
- **只拒绝矛盾信号（选中）**：浏览器对所有 POST 都带 `Origin`（跨站页面、沙箱 iframe 的 `Origin: null`、DNS rebinding 页面也都有），能产生“无 `Origin`”写入的只有非浏览器客户端或壳的转发；而后者的能力等价于本机进程，本机进程本来就能直接写照片目录。

## Consequences

- Web GUI（`http://127.0.0.1:<port>` 浏览器访问）的同源策略不变：不一致的 `Origin` 与跨站请求仍然 403。
- 本机任意进程可以不带 `Origin` 直接写照片目录——这与它直接写文件等价，可接受；服务端只监听环回地址，不暴露给网络。
- “缺少 `Origin` 就拒绝”这条加固不能再加回来；`test/photos.test.js` 的 `manage accepts writes the Desktop shell forwards without an Origin header` 会挡住这个回归。
- Desktop 壳的 `forwardWebRequest()` 是 DSH 的代码，不归本插件维护。如果它以后改成**保留** `Origin`（例如转发 `Origin: dsh-app://app`），写入会重新 403：`Origin` 存在就必须匹配 webServer 的 origin，而 `new URL('dsh-app://app').origin` 在 Node 里是 `'null'`，同样被拒。到那时需要在检查里显式接受 `dsh-app://app` 这个 App 源——浏览器无法伪造自己的 `Origin`，接受它是安全的。
