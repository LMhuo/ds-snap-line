# 05: 原图与显示版分离

**What to build:** 添加照片时在浏览器里从原图生成显示版（长边 1280、JPEG 质量约 0.82）并上传，原图按原字节保存。晾衣绳与列表缩略图加载显示版，点开灯箱仍加载原图。打开详情页时，为缺少显示版的手工照片自动补生成（重复打开不重复工作）；动图的显示版取首帧，原图保留动画。

**Blocked by:** 02

**Status:** resolved

- [x] 添加一张大尺寸照片后，晾衣绳与列表加载的是几百 KB 的显示版，灯箱加载原图
- [x] 显示版按「长边 1280、JPEG 质量约 0.82」生成，原图字节原样保存
- [x] 打开详情页时为缺显示版的手工照片自动补生成；再次打开不会重复生成
- [x] GIF / AVIF 的显示版取首帧，原图保留动画并在灯箱中播放
- [x] 显示版缺失或损坏时清单回退到原图地址，晾衣绳不报错
- [x] 显示版写入走同一写路由，受同样的同源、大小与媒体类型校验
- [x] 显示版文件与顺序文件、原图一起受隐藏名规则保护，不出现在清单与读取路由中

## Comments

- 2026-11-10: implemented and merged into `integration/photo-manager` (merge commit `b249193`); `npm run check` passes (67 tests). Two-axis code review (`/code-review`) followed; its findings were fixed on the same integration branch (merge `79e2a1a`).
- 2026-11-10: 复核发现本票的写入路径在 Desktop 应用里实测全部 403（壳转发请求时剥掉 `Origin`，写入路由把「缺少 Origin」当跨站拒绝），验收项当时只在浏览器 Web GUI 下成立；根因、修复与回归测试见 [06](06-desktop-app-write-403.md)；修复已提交到 `integration/photo-manager`（commit `0f2c248`，68 tests），本票保持 resolved。

- 2026-11-10: 验收项按实现完成情况勾选（自动化测试与两轴评审覆盖）；Desktop 实机在 [06](06-desktop-app-write-403.md) 修复提交后复测。
