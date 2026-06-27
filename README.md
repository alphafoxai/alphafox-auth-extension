# AlphaFox Auth Extension

AlphaFox Auth Sync 是用于浏览器的交易所登录凭证同步插件。插件会在你打开交易所网页并完成登录后读取必要 Cookie / Token，并通过 AlphaFox Web API 保存到 AlphaFox。

## 当前支持

- Binance：`p20t` Cookie + CSRF 请求头（`cookie_csrf`）
- OKX：`token` Cookie（`authorization`）
- Bitget：`bt_newsessionid` Cookie（`session`）
- Bybit：`secure-token` Cookie（`secure_token`）
- Gate.io：`token` Cookie（`token`）

> 说明：当前 Binance 只走 `cookie_csrf`，插件不会读取或提交 Binance `x_token`。

## 登录方式

插件复用 AlphaFox 网页登录态：

1. 如果你已经在 `https://alphafox.app` 登录，打开插件会自动进入同步界面。
2. 如果尚未登录，点击「打开 AlphaFox 登录」完成网页端邮箱验证码登录。
3. 回到插件点击「重新检测登录态」。

插件不保存 AlphaFox 密码。

## 使用流程

1. 打开目标交易所网页并登录。
2. 打开插件，点击「立即刷新」确认已读取凭证。
3. 首次接入该交易所时点击「首次创建」。
4. 后续 Cookie 过期或重新登录交易所后点击「同步最新」。

创建和同步在界面上明确分开，避免把首次创建误当作日常更新。

## 本地构建

```bash
pnpm install
pnpm build
```

构建产物在 `dist/`。如需打包：

```bash
pnpm zip
```

## 安装未打包版本

1. 打开 Chrome 的 `chrome://extensions`。
2. 打开「开发者模式」。
3. 点击「加载已解压的扩展程序」。
4. 选择本项目构建后的 `dist/` 目录。

## 免责声明

This extension is not affiliated with or endorsed by Binance, OKX, Bitget, Bybit, Gate.io, or any cryptocurrency exchange. Use it at your own risk.
