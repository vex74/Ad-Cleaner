# 广告清理工具-Ad-Cleaner

> **中文：** 广告清理工具-Ad-Cleaner 是一个轻量、可控、支持中英双语的 Chrome 广告清理扩展。
>
> **English:** Ad Cleaner Tool-Ad-Cleaner is a lightweight, controllable Chrome ad-cleaning extension with bilingual UI support.

## 项目简介 / Overview

**中文**：广告清理工具-Ad-Cleaner 使用 Manifest V3，结合网络级拦截、页面元素识别、自定义站点规则和过滤订阅，帮助用户减少常见广告与推广内容干扰，同时保留误杀恢复能力。

**English:** Ad Cleaner Tool-Ad-Cleaner uses Manifest V3, network-level blocking, page element detection, custom site rules, and optional filter subscriptions to reduce common ads and promoted content while preserving recovery controls for false positives.

## 主要功能 / Features

- **中文：** 网络级广告请求拦截。

  **English:** Network-level ad request blocking.
- **中文：** 页面广告候选识别、标记与一键隐藏。

  **English:** Candidate detection, marking, and one-click hiding.
- **中文：** 当前站点白名单 / 黑名单。

  **English:** Per-site allowlist and blocklist.
- **中文：** 点选元素并添加自定义 CSS 选择器。

  **English:** Element picker with custom CSS selectors.
- **中文：** 误杀恢复面板，可单独恢复页面元素。

  **English:** Recovery panel for restoring hidden elements.
- **中文：** 支持粘贴过滤规则文本或添加远程订阅。

  **English:** Text-based and remote filter subscriptions.
- **中文：** 中英文一键切换。

  **English:** One-click Chinese / English switching.
- **中文：** 主题模式支持跟随浏览器系统、暗夜和白天。

  **English:** System-following, Dark, and Light theme modes.
- **中文：** 规则导入、导出、清空与同步诊断。

  **English:** Rule import, export, cleanup, and synchronization diagnostics.

## 安装 / Installation

### 加载未打包扩展 / Load the unpacked extension

1. **中文：** 打开 Chrome 的 `chrome://extensions/`。

   **English:** Open `chrome://extensions/` in Chrome.
2. **中文：** 开启右上角的“开发者模式”。

   **English:** Enable Developer mode.
3. **中文：** 点击“加载已解压的扩展程序”。

   **English:** Click “Load unpacked”.
4. **中文：** 选择项目目录。

   **English:** Select the project directory.

### 使用发布包 / Use the release package

**中文：** ZIP 发布文件位于 GitHub [Releases](https://github.com/vex74/Ad-Cleaner/releases/tag/v0.9.29) 页面。CRX 只有在签名私钥可用时才会生成。

**English:** The ZIP package is available on the GitHub [Releases](https://github.com/vex74/Ad-Cleaner/releases/tag/v0.9.29) page. A CRX is generated only when the signing key is available.

**中文：** 如果 Chrome 不允许直接安装 CRX，请先解压 ZIP，再通过“加载已解压的扩展程序”安装。

**English:** If Chrome blocks direct CRX installation, extract the ZIP and load the extracted folder instead.

## 使用说明 / Usage

- **中文：** 弹窗右上角主题按钮按“跟随系统 → 暗夜 → 白天”循环切换。

  **English:** The theme button cycles through “System → Dark → Light”.
- **中文：** 跟随系统模式会根据浏览器的浅色 / 深色主题自动变化。

  **English:** System mode follows the browser’s light or dark appearance automatically.
- **中文：** 设置页可管理站点规则、元素选择器、过滤订阅和规则备份。

  **English:** Settings manages site rules, element selectors, filter subscriptions, and backups.
- **中文：** 关闭全局开关后，默认页面不会扫描或清理；黑名单站点仍可强制启用清理。

  **English:** When the global switch is off, pages are not scanned or cleaned by default; blocklisted sites can still force filtering.

## 开发与测试 / Development and Testing

**中文：** 项目无需构建步骤，扩展源码可直接加载。

**English:** No build step is required; the extension source can be loaded directly.

```bash
node --test tests/*.test.js
node --check theme.js
node --check i18n.js
node --check options.js
node --check popup.js
node --check content.js
node --check background.js
git diff --check
```

**中文版本：** `0.9.29`

**English version:** `0.9.29`

## 隐私说明 / Privacy

- **中文：** 站点规则、语言和主题偏好保存在浏览器本地存储中。

  **English:** Site rules, language, and theme preferences are stored locally in the browser.
- **中文：** 远程订阅仅在用户主动添加后加载。

  **English:** Remote subscriptions are loaded only after the user adds them.
- **中文：** 项目不内置账号系统，也不要求上传浏览历史。

  **English:** The project has no built-in account system and does not require browsing-history uploads.

## License / 许可证

**中文：** 当前仓库未附带独立许可证声明。使用、修改和再分发前，请先确认项目维护者的授权范围。

**English:** This repository does not currently include a separate license statement. Confirm the maintainer’s authorization before using, modifying, or redistributing the project.
