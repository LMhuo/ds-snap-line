# SnapLine

> 一条挂在消息输入框下方的照片晾衣绳。

SnapLine 是 [DeepSeek Harness](https://github.com/deepseek-ai) 的界面插件（bundle）。它会在聊天输入框下方画一条微微下垂的晾衣绳，夹上一排拍立得照片，照片随风轻轻摆动。

默认是五张手绘小画；把照片放进 `photos/` 文件夹，就会换成你自己的照片，几秒内自动刷新，无需重启。

## 特性

- 挂在 `conversation.composer.dock` 插槽里，紧贴消息输入框下方，不遮挡任何操作；
- 新会话首页（空白 Hero）同样生效：Host 在该状态下不渲染 composer dock，Client 半改用 `shell.overlay` 加 `react-dom` portal，把同一条晾衣绳挂进 Hero 输入框下方的空位；Hero 版比会话页大一倍（600px），并按输入框实际宽度封顶，会话页 dock 版尺寸不变；
- 支持 `.jpg` `.jpeg` `.png` `.webp` `.gif` `.avif`，按文件名自然排序；
- 最多显示 6 张，超过时均匀抽样，照片越多排得越密；
- 每张照片有独立的倾斜角度和摆动节奏，并尊重 `prefers-reduced-motion`；
- 鼠标悬停到照片上时轻轻晃一下再回正；交互只用 CSS `:hover` 和 `transform`，没有 JS 监听、没有 React 重渲染，也不触发重排；
- 点击照片打开灯箱：用户照片按原始比例完整放大，内置插画放大成一张拍立得；按 `Esc`、点背景或点右上角都可以关闭；灯箱经 `react-dom` portal 挂到 `body`，不受 dock/hero 布局裁剪，关闭时不产生任何残留；
- 零运行时依赖、纯 ESM、无构建步骤；
- 照片只在本机由 Host 半读取，经 Harness web server 的同源路由提供，不出本机。

## 安装

### 让 Harness 安装（推荐）

把这个仓库的地址交给 Harness Agent，让它用 `plugin_manager` 的 `install_bundle` 安装：

- Git 仓库：`https://gitee.com/Lhuo/ds-snap-line.git`
- npm（发布后）：`snap-line`

安装完成后，插件会出现在 Harness 的插件列表里，并自动在输入框下方生效。

### 从本地目录安装（开发用）

```bash
git clone https://gitee.com/Lhuo/ds-snap-line.git
# 然后让 Harness 安装这个目录的绝对路径：
# plugin_manager install_bundle，target = /path/to/ds-snap-line
```

`install_bundle` 会在当前 profile 的 `package.json` 中写入 `link:` 依赖并把它加入 bundle 列表，无需手动改 profile 文件。

### 停用与卸载

在 Harness 的插件设置里停用即可；也可以在 Agent 中调用 `plugin_manager` 的 `set_bundle`（停用/启用）或 `remove_bundle`（移除）。

## 使用自己的照片

照片目录是**插件包目录下的 `photos/`**：

| 安装方式 | 照片目录 |
| --- | --- |
| 本地目录 / `link:` 安装 | 本仓库的 `photos/` |
| npm / git 安装 | `~/.dsh/profiles/<profile>/node_modules/snap-line/photos/` |

把图片放进去即可：

- 按文件名自然排序（`1.jpg`、`2.jpg`、`10.jpg` 顺序正确）；
- 最多显示 6 张，更多照片会均匀抽取 6 张；
- 增删或替换后 5 秒内自动刷新，无需重启 Harness；
- 清空文件夹会恢复插件内置的插画照片。

> `photos/` 中的照片不会进入 Git，也不会被打进 npm 包（见 `.gitignore` 和 `package.json` 的 `files`），可以放心放私人照片；但请注意，照片会由本机 Harness 端口提供，能访问该端口的本机进程可以看到它们。

## 工作原理

```
photos/  ──Host 半 (index.js)──GET /snap-line/photos.json──┐
                                                           ├──Client 半 (client.js)
photos/<name> ──GET /snap-line/photos/<name>───────────────┘    └── SVG 晾衣绳 + 拍立得相框
```

- **Host 半**（`index.js`）：用 `webServer.register({ kind: 'prefix', path: '/snap-line' })` 提供照片清单与图片；拒绝目录穿越、隐藏文件名和未知媒体类型。
- **Client 半**（`client.js`）：注册到 `conversation.composer.dock` 插槽（`order: 2`），每 5 秒轮询一次清单；有照片时用 `<image>` 渲染，没有照片时画 5 张内置插画。
- **新会话首页**：Host 只在有 Session 时渲染 `conversation.composer.dock`，空白 Hero 里只有一个空的 `[data-composer-dock]` 容器。Client 半额外向 `shell.overlay` 注册一个 `HeroClothesline`：它每 250ms 检查页面里是否存在 `[data-content-phase="hero"] [data-composer-dock]` 且其中还没有 dock 版晾衣绳，若有则通过 `react-dom` 的 `createPortal` 把同一条晾衣绳画进这个容器，并按量到的输入框宽度把它放大到 2 倍（600px 封顶）；一旦进入正常会话、dock 版出现，它就自动让位，不会重复显示。`react-dom` 属于 Harness 的基础模块表，无需额外声明依赖；拿不到 `react-dom` 或 `shell.overlay` 时该兜底会静默跳过，不影响正常的 dock 渲染。
- dock 插槽本身是 fit-content 的 flex 行，SVG 的 `width: 100%` 会退回固有 300px，所以会话页晾衣绳一直是 300px 左右；Hero 版因此改用显式像素宽度，而不是改 `max-width`。
- 只有本机 Harness 端口能访问这个路由，插件不发任何外部请求。

## 开发

```bash
npm test       # node --test，覆盖照片清单、静态文件路由、清单一致性
npm run check  # 语法检查 + 全部测试
```

没有构建步骤，也没有运行时依赖。修改 `client.js` 会通过 HMR 自动刷新浏览器半；修改 `index.js` 后需要重启插件条目（停用再启用）。

### 目录结构

```
snap-line/
├── index.js            # Host 半：注册 /snap-line 前缀路由
├── lib/photos.js       # 照片清单 / 读取 / 路由资源（纯 Node，可单独测试）
├── client.js           # Client 半：晾衣绳 SVG 与插槽注册
├── cordis.patch.yml    # bundle 插入的 Host 插件行
├── locale/             # 插件管理器中显示的标题与描述
├── icon.svg            # 插件图标
├── photos/             # 你自己的照片（默认不提交）
└── test/               # node:test 测试
```

## 发布

```bash
npm pack --dry-run   # 先确认打包内容（photos/ 不应出现在列表里）
npm publish          # 发布到 npm，包名 snap-line
git push origin master
```

## 兼容性

- DeepSeek Harness 0.2.x（Web 平台）
- Node.js ≥ 20

## License

MIT © 2026 Lhuo

## English

SnapLine is a DeepSeek Harness UI bundle that hangs a sagging clothesline of polaroid photos under the message composer. It ships five hand-drawn placeholder photos; drop your own images (`.jpg` `.jpeg` `.png` `.webp` `.gif` `.avif`) into `photos/` and they replace the illustrations within seconds. Up to six photos are shown, evenly sampled, each with its own tilt and sway. Hovering a photo gives it a small, transform-only nudge that settles back into the ambient sway — no JS listeners or re-renders. Clicking a photo opens a portal lightbox with the full-size image (built-in illustrations open as an enlarged polaroid); close it with `Esc`, a backdrop click or the × button. The clothesline also appears on the New Session home page: because the Host does not render `conversation.composer.dock` in the blank Hero, the Client half portals the same artwork through `shell.overlay` into the Hero composer's empty dock container. Install by pointing `plugin_manager`'s `install_bundle` at this repository; photos never leave the local machine and are served by the Host half over the Harness web server at `/snap-line/photos/…`.
