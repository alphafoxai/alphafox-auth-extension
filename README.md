# AlphaFox Auth Extension

AlphaFox Auth Sync 是用于浏览器的交易所网页登录信息同步插件。插件会在你打开交易所网页并完成登录后读取 AlphaFox 需要的登录信息，并通过 AlphaFox Web API 保存到 AlphaFox。

## 当前支持

- Binance
- OKX
- Bitget
- Bybit
- Gate.io

> 说明：Binance 只同步网页登录所需信息，插件不会读取或提交 Binance `x_token`。

## 登录方式

插件复用 AlphaFox 网页登录态：

1. 如果你已经在 `https://alphafox.app` 登录，打开插件会自动进入同步界面。
2. 如果尚未登录，点击「打开 AlphaFox 登录」完成网页端邮箱验证码登录。
3. 回到插件点击「重新检测登录状态」。

插件不保存 AlphaFox 密码。

## 使用流程

1. 打开目标交易所网页并登录。
2. 打开插件，点击「立即刷新」确认已读取网页登录信息。
3. 首次接入该交易所时点击「创建」，在弹窗里创建一条 AlphaFox 记录。
4. Bitget 首次手动绑定后，插件会监听 `bt_newsessionid` 与 `bt_rtoken` 的变化，并自动 PUT 更新当前浏览器已绑定的记录；不会自动创建新记录。
5. 其它交易所重新登录后，点击「同步」更新当前浏览器已绑定的记录。
6. 如果这个浏览器需要改用另一条 AlphaFox 记录，点击「切换」并在弹窗里选择。

Bitget 必须同时读取到 `bt_newsessionid` 和 `bt_rtoken`。缺少任一 Cookie 时，插件会显示“不完整凭证”并禁止提交。自动同步失败会保存在插件本地状态并显示在 popup 中。

多浏览器 Profile 使用时，每个 Profile 可以绑定同一个交易所的不同记录，适合在同一个 AlphaFox 账号下管理多个交易所账号。

## Fomo 本地会话同步

Fomo 同步是独立于交易所记录的本地流程，不会把 Fomo 加入通用交易所配置。先在本机启动 `alphafox-fomo-query`，使用与查询服务不同的密钥：

- `SYNC_API_KEY`：仅用于插件向 `http://127.0.0.1:3000/v1/session` 写入或清除内存中的 Fomo 会话。
- `QUERY_API_KEY`：仅用于查询服务的 profile/history 接口，不能写入 Fomo 会话。

在当前 Chrome 标签页打开 `https://fomo.family` 后，在插件的「Fomo 本地会话同步」区域输入 `SYNC_API_KEY` 并点击同步。插件只会在点击后对这个标签页开启一次、最长 60 秒的监听，读取一次 Fomo `Authorization: Bearer` 请求并直接上传到固定本机地址；不会自动监听、读取 Cookie、收集刷新令牌或把 Fomo 令牌写入 Chrome storage、日志或 popup。同步或清除操作完成后，输入框会清空。

「清除本地服务会话」只清除查询服务内存中的会话，不会撤销 Fomo 浏览器登录。查询服务重启后需要重新同步。不要在聊天、文件或日志中保存真实 Fomo 令牌。

本地验证：TypeScript 检查、旧 popup 回归、Fomo 同步行为测试及构建通过。Fomo 请求已与通用交易所 CSRF/凭据存储管线隔离，并有回归断言。浏览器 host permission 使用 `http://127.0.0.1/*`，代码中的上传地址仍固定为 `http://127.0.0.1:3000/v1/session`。

2026-09-05 经授权的内存采集测试中，真实 token 上传到本地服务返回 200，但服务端直接查询 Fomo 返回 502 `FOMO_UNAVAILABLE`；测试后已清除 token。该结果不代表查询端到端通过，也不代表本次构建已安装到用户浏览器验证。加载 `dist` 后仍需通过插件可见操作验证；上传成功与查询成功须分别判断。

## 下载最新打包文件

每次推送到 `main`（或手动触发 CI）会自动构建 Chrome 扩展包，并发布到 GitHub Releases。

- **发布页**：[Latest build](https://github.com/alphafoxai/alphafox-auth-extension/releases/latest)
- **直接下载 ZIP**：[alphafox-auth-extension.zip](https://github.com/alphafoxai/alphafox-auth-extension/releases/latest/download/alphafox-auth-extension.zip)

该 ZIP 可在 Chrome 中作为本地扩展加载（见下方安装步骤）。

## 在 Chrome 中安装

1. 下载并解压 `alphafox-auth-extension.zip`（解压后的目录里应有 `manifest.json`）。
2. 打开 Chrome 地址栏输入 `chrome://extensions`。
3. 打开右上角「开发者模式」。
4. 点击「加载已解压的扩展程序」。
5. 选择上一步解压后的文件夹。

之后若 CI 产出了新版本，重新下载 ZIP、解压覆盖（或换新目录），再在扩展页点击「重新加载」即可。

## 本地构建

```bash
pnpm install
pnpm build
```

构建产物在 `dist/`。如需打包：

```bash
pnpm zip
```

本地安装时，在 `chrome://extensions` 中加载 `dist/` 目录即可（步骤同上）。

## 免责声明

This extension is not affiliated with or endorsed by Binance, OKX, Bitget, Bybit, Gate.io, or any cryptocurrency exchange. Use it at your own risk.
