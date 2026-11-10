# 01: 照片目录迁到用户数据目录，清单给出原图/显示版地址与「上绳」标记

**What to build:** 手工把图片放进 `~/.dsh/dsh-snap-line/photos/`（`DSH_HOME` 优先，否则 `~/.dsh`），晾衣绳上 5 秒内出现；插件包内的 `photos/` 目录不再被读取，升级插件不再让照片消失。清单同时给出每张照片的显示版地址（缺显示版时回退原图）与原图地址，并由 Host 按顺序标出前 6 张「在绳上」；晾衣绳只渲染这些，Client 不再做均匀抽样，灯箱始终用原图。

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] 往 `$DSH_HOME/dsh-snap-line/photos` 放一张支持的图片，5 秒内上绳；手工放置仍然有效
- [x] 把图片放进插件包内的 `photos/` 不再产生任何效果
- [x] 清单按顺序返回全部照片，每项带显示版地址、原图地址与「在绳」标记；显示版缺失时地址回退到原图
- [x] 手工放 8 张时绳上只出现顺序里的前 6 张，位置与顺序一致；Client 不再等距抽样
- [x] 点开灯箱加载的是原图地址
- [x] 照片目录为空时回到内置插画；隐藏文件、不支持的类型、子目录仍被忽略
- [x] `DSH_HOME` 缺失、空白或末尾带空白时回退到 `~/.dsh`，有单测覆盖
- [x] 读路由拒绝目录穿越、隐藏名、未知媒体类型、坏 percent-encoding 的现有行为保持不变
- [x] README 与 CHANGELOG 中已写的照片目录、原图/显示版、前 6 张上绳的描述与实现一致

## Comments

- 2026-11-10: implemented and merged into `integration/photo-manager` (merge commit `7c0f394`); `npm run check` passes (67 tests). Two-axis code review (`/code-review`) followed; its findings were fixed on the same integration branch (merge `79e2a1a`).

- 2026-11-10: 验收项按实现完成情况勾选（自动化测试与两轴评审覆盖）；Desktop 实机在 [06](06-desktop-app-write-403.md) 修复提交后复测。
