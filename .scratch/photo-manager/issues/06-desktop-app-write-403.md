# 06: Desktop 应用里照片管理器的写入全部被 403 拒绝

**What to fix:** 在 Desktop 应用（Electron）里打开插件详情页的照片管理器时，添加照片报「微信图片_….jpg：请求被拒绝，请刷新页面后重试。」；排序、删除、显示版上传同样失败。列表与晾衣绳的读取正常。在浏览器里打开 `http://127.0.0.1:<port>` 的 Web GUI 时一切正常。

**Blocked by:** —

**Status:** resolved

- [x] 定位到 403 只来自写入路由的同源检查，且只在 Desktop 应用里触发
- [x] 用截图里的那张真实照片复现：Desktop 转发的请求形状 → 403，补上 `Origin` → 200
- [x] 修复后 add / display / order / delete 四种写入在“无 Origin”形状下都成功
- [x] 跨站信号仍然拒绝（不一致的 `Origin`、字面量 `Origin: null`、`Sec-Fetch-Site: cross-site`）
- [x] 回归测试覆盖四种写入，`npm run check` 通过

## Root cause

Desktop 应用的页面不是从 `http://127.0.0.1:<port>` 加载的，而是壳自己的 `dsh-app://app` 源。壳在 `protocol.handle('dsh-app', …)` 里把非静态请求交给 `forwardWebRequest()` 转发给 Host，而 `forwardWebRequest()` 会先删掉 `host`、`origin`、`cookie`、`sec-fetch-site` 四个头，再换成壳自己的 Host 认证 cookie：

```js
// /Applications/DeepSeek Harness.app/Contents/Resources/app.asar → lib/main.js
const origin = request.headers.get("origin");
if (origin !== null && origin !== "dsh-app://app") return new Response(null, { status: 403 });
const headers = new Headers(request.headers);
for (const name of ["host", "origin", "cookie", "sec-fetch-site"]) headers.delete(name);
headers.set("cookie", cookie);
```

于是插件收到的写入请求既没有 `Origin` 也没有 `Sec-Fetch-Site`。`lib/photos.js` 的 `writeIsSameOrigin()` 当时把“缺少 `Origin`”当成跨站，直接返回 403 `{"error":"forbidden"}`；`client.js` 把这个错误码映射到 `errorForbidden`，也就是用户看到的那句「请求被拒绝，请刷新页面后重试」。读取路由（`/dsh-snap-line/photos.json`、`/photos/*`）不检查 Origin，所以列表和晾衣绳一直正常——这正是“只坏写入”的原因。

这不是缓存或时序问题，刷新页面不会恢复；Desktop 应用里每一次写入都必然命中。

## Fix

`writeIsSameOrigin()` 只拒绝**互相矛盾**的信号：`Sec-Fetch-Site: cross-site`，以及存在但与 webServer origin 不一致的 `Origin`（包括 `Origin: null`）。**缺少** `Origin` 不再视为跨站，因为浏览器对所有 POST 都会带 `Origin`，跨站页面、沙箱 iframe（`Origin: null`）和 DNS rebinding 页面也都会带，所以能产生“无 Origin”写入的只有非浏览器客户端或壳的转发；而它能写的东西本机进程本来就能直接写照片目录。Web GUI 的同源策略保持不变。

## Comments

- 2026-11-10: 用户报告 Desktop 应用详情页添加照片 403。根因是壳转发时剥掉 `Origin`，与插件的同源检查冲突；改动集中在 `lib/photos.js` 一个函数，回归测试 `manage accepts writes the Desktop shell forwards without an Origin header` 覆盖 add/display/order/delete 四种写入。已在本地跑 `npm run check`（68 tests）通过。Desktop 里的 Host 半需要重启应用（或重载插件）才会加载新代码。
- 2026-11-10: 已在 02–05 的 Comments 补上交叉引用：这四张票的写入路径（add/delete/order/display）都受本缺陷影响，01 只有读清单不受影响。复核六张票的 `**Status:**` 均为 `resolved`。

- 2026-11-10: 修复已提交到 `integration/photo-manager`：commit `0f2c248`（`npm run check` 68 tests 通过），ADR 0002 一并提交。Desktop 应用需要重启（或重载插件行）才会加载 Host 新代码，之后重试添加照片。
