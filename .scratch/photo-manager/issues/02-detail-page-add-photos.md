# 02: 详情页照片管理器：写入路由与多选添加

**What to build:** 在已安装插件的详情页（Plugins → Installed plugins → dsh-snap-line）出现照片区，列出全部照片并标出哪 6 张在绳上；用户可以多选文件或把照片拖进该区域来添加，添加后列表与晾衣绳立即更新。超大、格式不支持、HEIC 等错误就地说明；同名文件不覆盖。写入必须只接受同源请求，并按单张上限、媒体类型和 magic bytes 校验后原子落盘。

**Blocked by:** 01

**Status:** resolved

- [x] 打开插件详情页能看到照片区：全部照片、缩略图、「在绳」标记与照片数量摘要
- [x] 多选文件或拖入照片区可以添加；添加后列表和晾衣绳立即更新，无需刷新页面或重启 Harness
- [x] 同名文件不覆盖，自动追加后缀得到新名字
- [x] 单张超过 25MB 或 64MP 被拒绝（413），不支持的媒体类型被拒绝（415），HEIC 给出可操作提示
- [x] 扩展名 / `Content-Type` 在允许集合内且 magic bytes 复核不符时被拒绝（400）
- [x] 名字含路径分隔符、以点开头或过长的文件被拒绝
- [x] 跨站写请求被拒绝：`Origin` 与 webServer 的 origin 不一致或 `Sec-Fetch-Site: cross-site` 时返回 403
- [x] 写入先写临时文件再 rename，失败时照片目录里不留下半个文件
- [x] 写路由测试覆盖：添加成功、同名改名、413、415、magic bytes 不符 400、穿越/隐藏名被拒、跨站 403
- [x] 入口测试断言读 resource 与写 handler 两条路由都已注册（路径、kind、resource/handler 类型）
- [x] 管理器可用键盘操作，按钮与照片有中英双语可读名称

## Comments

- 2026-11-10: implemented and merged into `integration/photo-manager` (merge commit `034db3f`); `npm run check` passes (67 tests). Two-axis code review (`/code-review`) followed; its findings were fixed on the same integration branch (merge `79e2a1a`).
- 2026-11-10: 复核发现本票的写入路径在 Desktop 应用里实测全部 403（壳转发请求时剥掉 `Origin`，写入路由把「缺少 Origin」当跨站拒绝），验收项当时只在浏览器 Web GUI 下成立；根因、修复与回归测试见 [06](06-desktop-app-write-403.md)；修复已提交到 `integration/photo-manager`（commit `0f2c248`，68 tests），本票保持 resolved。

- 2026-11-10: 验收项按实现完成情况勾选（自动化测试与两轴评审覆盖）；Desktop 实机在 [06](06-desktop-app-write-403.md) 修复提交后复测。
