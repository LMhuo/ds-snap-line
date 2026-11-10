# 03: 从照片管理器删除照片

**What to build:** 在详情页的照片列表里删除一张照片时先二次确认；确认后照片立即从列表和晾衣绳上消失，原图、对应的显示版和顺序记录一起清掉。删除不存在的名字时给出明确结果，不影响其他照片。

**Blocked by:** 02

**Status:** resolved

- [x] 每张照片旁有删除操作，点击后先弹出二次确认
- [x] 确认后照片从列表和晾衣绳上消失，无需刷新
- [x] 原图、对应的显示版与顺序记录都被删除
- [x] 删除不存在的名字返回明确结果，其他照片与顺序不受影响
- [x] 删除只能通过同源的写路由完成，跨站请求被拒
- [x] 删除后再手工把文件放回照片目录，照片重新出现在列表末尾（顺序回退到自然排序）

## Comments

- 2026-11-10: implemented and merged into `integration/photo-manager` (merge commit `c88fbaa`); `npm run check` passes (67 tests). Two-axis code review (`/code-review`) followed; its findings were fixed on the same integration branch (merge `79e2a1a`).
- 2026-11-10: 复核发现本票的写入路径在 Desktop 应用里实测全部 403（壳转发请求时剥掉 `Origin`，写入路由把「缺少 Origin」当跨站拒绝），验收项当时只在浏览器 Web GUI 下成立；根因、修复与回归测试见 [06](06-desktop-app-write-403.md)；修复已提交到 `integration/photo-manager`（commit `0f2c248`，68 tests），本票保持 resolved。

- 2026-11-10: 验收项按实现完成情况勾选（自动化测试与两轴评审覆盖）；Desktop 实机在 [06](06-desktop-app-write-403.md) 修复提交后复测。
