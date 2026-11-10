# 04: 拖动/键盘排序决定哪 6 张上绳

**What to build:** 在详情页的照片列表里拖动缩略图调整顺序，或用上移/下移按钮调整；顺序变化后晾衣绳上的选片和先后立即跟着变，刷新页面或重启 Harness 后保持。顺序写入照片目录的顺序文件；没有进顺序的手工照片按文件名自然排序排在已排照片之后。

**Blocked by:** 02

**Status:** resolved

- [x] 拖动缩略图可以调整顺序，松手后晾衣绳的选片与先后立即更新
- [x] 另有上移/下移按钮，只用键盘也能调整顺序
- [x] 刷新页面、重启 Harness 后顺序保持不变
- [x] 没有进顺序的手工照片按文件名自然排序排在已排照片之后
- [x] 清单里的「在绳」标记随顺序更新，前 6 张始终是顺序最前的 6 张
- [x] 顺序文件缺失或内容损坏时回退到自然排序，不中断列表与晾衣绳
- [x] 顺序写入只能通过同源的写路由完成，跨站请求被拒

## Comments

- 2026-11-10: implemented and merged into `integration/photo-manager` (merge commit `de25c05`); `npm run check` passes (67 tests). Two-axis code review (`/code-review`) followed; its findings were fixed on the same integration branch (merge `79e2a1a`).
- 2026-11-10: 复核发现本票的写入路径在 Desktop 应用里实测全部 403（壳转发请求时剥掉 `Origin`，写入路由把「缺少 Origin」当跨站拒绝），验收项当时只在浏览器 Web GUI 下成立；根因、修复与回归测试见 [06](06-desktop-app-write-403.md)；修复已提交到 `integration/photo-manager`（commit `0f2c248`，68 tests），本票保持 resolved。

- 2026-11-10: 验收项按实现完成情况勾选（自动化测试与两轴评审覆盖）；Desktop 实机在 [06](06-desktop-app-write-403.md) 修复提交后复测。
