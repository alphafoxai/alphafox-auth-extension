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
4. 后续重新登录交易所后，点击「同步」更新当前浏览器已绑定的记录。
5. 如果这个浏览器需要改用另一条 AlphaFox 记录，点击「切换」并在弹窗里选择。

多浏览器 Profile 使用时，每个 Profile 可以绑定同一个交易所的不同记录，适合在同一个 AlphaFox 账号下管理多个交易所账号。

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
