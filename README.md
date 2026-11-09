# SnapLine

> 一条挂在 DeepSeek Harness 消息输入框下方的照片晾衣绳。

**中文** · [English](README.en.md)

[![CI](https://github.com/LMhuo/dsh-snap-line/actions/workflows/ci.yml/badge.svg)](https://github.com/LMhuo/dsh-snap-line/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](package.json)
[![npm](https://img.shields.io/npm/v/dsh-snap-line?logo=npm)](https://www.npmjs.com/package/dsh-snap-line)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-0.2.x-4d6bfe)](https://github.com/deepseek-ai)

SnapLine 是 [DeepSeek Harness](https://github.com/deepseek-ai) 的界面插件（bundle）。它在聊天输入框下方画一条微微下垂的晾衣绳，夹上一排拍立得照片，照片随风轻轻摆动。默认是五张手绘小画；把照片放进 `photos/` 文件夹，就会换成你自己的照片，几秒内自动刷新，无需重启。

![SnapLine 预览](docs/images/preview.png)

## 目录

- [特性](#特性)
- [截图](#截图)
- [安装](#安装)
- [使用自己的照片](#使用自己的照片)
- [工作原理](#工作原理)
- [开发](#开发)
- [兼容性](#兼容性)
- [常见问题](#常见问题)
- [贡献](#贡献)
- [更新日志](#更新日志)
- [License](#license)

## 特性

- **两个位置都会出现**：既挂在会话页的 `conversation.composer.dock` 插槽里（紧贴输入框下方、不遮挡操作），也出现在新会话首页的空白 Hero 里；
- **自带五张手绘插画**：`photos/` 为空时使用内置插画，不会出现空荡荡的绳子；
- **换成自己的照片**：支持 `.jpg` `.jpeg` `.png` `.webp` `.gif` `.avif`，按文件名自然排序，增删后 5 秒内自动刷新；
- **排版自适应**：最多显示 6 张，超过时均匀抽样；照片越多排得越密，每张有自己的倾斜角度与摆动节奏；
- **交互克制**：悬停只靠 CSS `:hover` 与 `transform` 让照片轻轻晃一下再回正，点击打开灯箱预览，没有鼠标监听、没有多余重渲染；
- **键盘友好**：照片可以用 Tab 聚焦，Enter / 空格打开灯箱；灯箱打开后 Tab 被约束在关闭按钮上，Esc、点击背景或关闭按钮都能退出，关闭后焦点回到打开它的照片；
- **读屏器可读**：晾衣绳、每张照片、灯箱与关闭按钮都有中英双语的无障碍名称；
- **尊重系统偏好**：`prefers-reduced-motion` 开启时不做摆动动画；
- **零运行时依赖**：纯 ESM、无构建步骤，`react` / `react-dom` 复用 Harness 内置模块；
- **照片不出本机**：Host 半通过 Harness web server 的同源路由提供图片，插件不发起任何外部请求。

## 截图

| 新会话首页 | 灯箱预览 |
| --- | --- |
| ![新会话首页：晾衣绳会自动放大](docs/images/hero.png) | ![灯箱预览：点击照片放大](docs/images/lightbox.png) |

## 安装

SnapLine 是 Harness 的 bundle 插件，可以走 npm、GitHub 或本地目录；安装由 Harness 里的 Agent 通过 `plugin_manager` 完成。

### 方式一：npm（推荐）

已发布到 npm：[`dsh-snap-line`](https://www.npmjs.com/package/dsh-snap-line)。

- 让 Harness Agent 用 `plugin_manager` 的 `install_bundle` 安装 `dsh-snap-line`；
- 或在终端运行：

```bash
dsh plugin --profile <profile> add dsh-snap-line
```

DSH 会从 npm 装好，并按 `dsh.bundle.patch` 组合 Host 半、按 `dsh.client` 加载 Client 半。收录到社区插件市场（awesome-dsh-plugin）后，也可以直接在 Harness 的插件市场里搜索安装。

### 方式二：从 GitHub 安装

把仓库地址发给 Harness Agent，并让它用 `install_bundle` 安装：

```text
https://github.com/LMhuo/dsh-snap-line.git
```

也支持 `github:LMhuo/dsh-snap-line` 简写。DSH 会先用 pnpm 把它装进当前 profile，再按 `dsh.bundle.patch` 组合 Host 半、按 `dsh.client` 加载 Client 半。

安装成功后，插件会出现在 Harness 的插件列表（`~/.dsh/profiles/<profile>/package.json` 的 bundle 列表）里，并自动在输入框下方生效。

### 方式三：本地克隆后安装（开发 / 调试推荐）

```bash
git clone https://github.com/LMhuo/dsh-snap-line.git
```

然后让 Harness Agent 用 `plugin_manager` 的 `install_bundle` 安装这个目录的**绝对路径**。`install_bundle` 会在当前 profile 的 `package.json` 中写入 `link:` 依赖并加入 bundle 列表，无需手动改 profile 文件。

### 停用与卸载

- 在 Harness 的插件设置里停用；
- 或让 Agent 调用 `plugin_manager` 的 `set_bundle`（停用 / 启用）与 `remove_bundle`（移除）。

## 使用自己的照片

照片目录是**插件包目录下的 `photos/`**：

| 安装方式 | 照片目录 |
| --- | --- |
| 本地目录 / `link:` 安装 | 本仓库的 `photos/` |
| npm / GitHub 安装 | `~/.dsh/profiles/<profile>/node_modules/dsh-snap-line/photos/` |

> npm 与 GitHub 安装的包默认不带 `photos/` 目录（私人照片不会被打进包），需要自己新建这个文件夹。

把图片放进去即可：

- 按文件名自然排序（`1.jpg`、`2.jpg`、`10.jpg` 顺序正确），中文文件名同样支持；
- 最多显示 6 张，更多照片会均匀抽取 6 张；
- 增删或替换后 5 秒内自动刷新，无需重启 Harness；
- 清空文件夹会恢复插件内置的插画照片。

> **隐私**：`photos/` 中的照片不会进入 Git，也不会被打进 npm 包（见 `.gitignore` 与 `package.json` 的 `files`），可以放心放私人照片。照片只由本机 Harness 端口提供，插件不会上传；但能访问该端口的本机进程可以看到这些图片。

## 工作原理

```text
photos/ ──Host 半 (index.js)── GET /dsh-snap-line/photos.json ──┐
                                                                ├── Client 半 (client.js)
photos/<name> ── GET /dsh-snap-line/photos/<name> ──────────────┘    └── SVG 晾衣绳 + 拍立得相框
```

- **Host 半**（`index.js`）：用 `webServer.register({ kind: 'prefix', path: '/dsh-snap-line' })` 提供照片清单与图片。`lib/photos.js` 是纯 Node 实现，拒绝目录穿越、隐藏文件名和未知媒体类型，可独立测试；
- **Client 半**（`client.js`）：注册到 `conversation.composer.dock` 插槽（`order: 2`），每 5 秒轮询一次清单，按清单渲染照片或内置插画；
- **灯箱**：点击照片（或 Tab 聚焦后按 Enter / 空格）打开；Esc、点击背景或关闭按钮退出，关闭后焦点回到打开它的照片，灯箱打开期间背景不滚动。
- **新会话首页**：Host 只在有 Session 时渲染 `conversation.composer.dock`，空白 Hero 里只有一个空的 `[data-composer-dock]` 容器。Client 半额外向 `shell.overlay` 注册 `HeroClothesline`，每 250ms 检查页面里是否存在 `[data-content-phase="hero"] [data-composer-dock]`，若有则通过 `react-dom` 的 `createPortal` 把同一条晾衣绳画进该容器，并按量到的输入框宽度放大到 2 倍（600px 封顶）。进入正常会话、dock 版出现后自动让位，不会重复显示；拿不到 `react-dom` 或 `shell.overlay` 时静默跳过，不影响 dock 渲染；
- dock 插槽本身是 fit-content 的 flex 行，SVG 的 `width: 100%` 会退回固有 300px，所以会话页晾衣绳一直是 300px 左右；Hero 版因此使用显式像素宽度，而不是改 `max-width`。

## 开发

```bash
npm test       # node --test：照片清单、静态文件路由、清单一致性等全部用例
npm run check  # 语法检查 + 全部测试
```

没有构建步骤，也没有运行时依赖。修改 `client.js` 会通过 HMR 自动刷新浏览器半；修改 `index.js` 后需要在插件设置里停用再启用一次。

本地调试时推荐用上面的「方式三」以 `link:` 方式安装本仓库，这样改代码即时生效。

### 目录结构

```text
dsh-snap-line/
├── index.js            # Host 半：注册 /dsh-snap-line 前缀路由
├── lib/photos.js       # 照片清单 / 读取 / 路由资源（纯 Node，可单独测试）
├── client.js           # Client 半：晾衣绳 SVG、插槽注册、灯箱
├── cordis.patch.yml    # bundle 插入的 Host 插件行
├── locale/             # 插件管理器中显示的中英文标题与描述
├── icon.svg            # 插件列表里显示的矢量图标
├── screenshots.json    # 插件市场卡片用的截图清单（指向 docs/images）
├── photos/             # 你自己的照片（默认不提交）
├── docs/               # README 预览图、市场截图与 PNG 图标
├── test/               # node:test 测试
└── .github/workflows/  # GitHub Actions CI
```

## 兼容性

| 项目 | 要求 |
| --- | --- |
| DeepSeek Harness | 0.2.x（Web 平台；开发验证于 0.2.2） |
| Node.js | ≥ 20（仅开发与测试需要，运行时使用 Harness 内置 Node） |
| 插件形态 | bundle（`package.json` 的 `dsh` 字段 + `cordis.patch.yml`） |

插件在 `package.json` 的 `engines.dsh` 中声明 `^0.2.0`：Harness 低于该范围时会跳过加载，避免在不兼容的版本上出错。需要更宽的兼容性时，可以用 profile 的 `compatibility.json` 做版本豁免。

## 常见问题

**放了照片但晾衣绳上没有变化？**
先确认照片放进了上表对应的 `photos/` 目录，再等 5 秒（轮询间隔）。检查扩展名是否在支持列表内、文件名是否以 `.` 开头（隐藏文件会被忽略）。超过 6 张时只会均匀显示 6 张。

**照片会被上传或公开吗？**
不会。Photo 由本机 Harness web server 的同源路由提供，插件不发外部请求，也不会把照片写进 Git 或 npm 包。

**会挡住消息输入框的点击吗？**
不会。外层容器是 `pointer-events: none`，只有照片本身恢复指针事件，用于悬停与点击灯箱。

**可以改照片数量或尺寸吗？**
可以，在 `client.js` 中调整 `MAX_PHOTOS`（数量）、`HERO_SVG_WIDTH`（Hero 版宽度）、`TILTS` / `DELAYS` / `DURATIONS`（倾斜与摆动节奏）。

**支持深色主题吗？**
目前使用固定的暖色纸张配色，不随 Harness 主题切换；欢迎提交 PR。

**怎么升级到新版本？**
npm 安装：在插件市场里检查更新，或让 Agent 重新用 `install_bundle` 安装；Git 安装：让 Agent 重新安装最新提交，或先 `remove_bundle` 再安装。每个版本的变更见 [CHANGELOG.md](CHANGELOG.md)。

**可以用键盘操作吗？**
可以。照片可以用 Tab 聚焦，Enter / 空格打开灯箱；灯箱打开后 Tab 被约束在关闭按钮上，Esc 关闭，关闭后焦点回到照片。

**可以商用吗？**
可以，MIT 协议。

## 贡献

- 发现 bug、想要新功能：欢迎开 issue，尽量附上 Harness 版本、安装方式与复现步骤；
- 提交代码：先 `npm run check` 保证全部测试通过，再发起 PR；
- 本项目同时镜像在 [Gitee](https://gitee.com/Lhuo/dsh-snap-line)，两边都可以提 issue。

## 更新日志

见 [CHANGELOG.md](CHANGELOG.md)。

## License

[MIT](LICENSE) © 2026 Lhuo
