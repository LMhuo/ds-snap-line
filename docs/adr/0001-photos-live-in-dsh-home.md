# 照片存放在用户数据目录，而不是插件包目录

从 1.4.0 起 SnapLine 的照片存放在 `$DSH_HOME/dsh-snap-line/photos`（默认 `~/.dsh/dsh-snap-line/photos`），不再读取插件包内的 `photos/`。原因是照片管理器要往这个目录写文件，而插件包目录在 npm / GitHub 安装下位于 `node_modules`，升级时会被整包替换，写进去的照片会随更新丢失。旧位置的照片不做自动迁移。

## Considered Options

- **插件包内 `photos/`（1.3.1 及以前）**：不需要迁移，但安装产物被当成数据目录，升级即丢；npm 包本身也不带这个目录。
- **每个 profile 一套（`~/.dsh/profiles/<profile>/.dsh-snap-line/photos`）**：数据跟着 profile 走，但换 profile 后照片消失不合直觉，还要依赖 profile 的内部目录约定。
- **`$DSH_HOME/dsh-snap-line/photos`（选中）**：与 `dsh-attachment-local` 等官方插件共用同一个数据根，跨版本、跨 profile 稳定；解析方式与 `dsh-home-paths` 一致（`DSH_HOME` 优先，否则 `~/.dsh`）。

## Consequences

- 从 1.3.x 升级后旧照片不会自动出现，README 与 CHANGELOG 必须写明"请在详情页重新添加"。
- 照片目录里同时有原图、`.display/` 显示版和 `.order.json` 顺序，全部由插件自己维护；DSH 没有清理这类数据的服务，卸载插件不会删除照片目录。
- 手工把文件放进照片目录的老用法保留，文档里一并说明。
- 浏览器生成的显示版让"默认显示几百 KB、点击看原图"成立，代价是照片目录占用大约翻倍。
