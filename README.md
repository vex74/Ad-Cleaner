# Ad Cleaner

一个轻量、可控、支持中英双语的 Chrome 广告清理扩展。

Ad Cleaner 使用 Manifest V3，结合网络级拦截、页面元素识别、自定义站点规则和过滤订阅，帮助用户减少常见广告与推广内容干扰，同时保留误杀恢复能力。

## 主要功能

- 网络级广告请求拦截
- 页面广告候选识别、标记与一键隐藏
- 当前站点白名单 / 黑名单
- 点选元素并添加自定义 CSS 选择器
- 误杀恢复面板，可单独恢复页面元素
- 支持粘贴过滤规则文本或添加远程订阅
- 中英文一键切换
- 主题模式：跟随浏览器系统、暗夜、白天
- 规则导入、导出与清空
- 动态规则同步状态与失败订阅诊断

## 安装

### 加载未打包扩展

1. 打开 Chrome 的 `chrome://extensions/`。
2. 开启右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择项目目录，或选择解压后的发布目录。

### 使用发布包

GitHub Releases 页面提供 `v0.9.27` 发布附件：

- `Ad-Cleaner-v0.9.27-中英切换版.zip`
- `Ad-Cleaner-v0.9.27-中英切换版.crx`

如果 Chrome 不允许直接安装 CRX，请先解压 ZIP，再通过“加载已解压的扩展程序”安装。

## 使用说明

- 弹窗右上角主题按钮会按“跟随系统 → 暗夜 → 白天”循环切换。
- 浏览器处于浅色系统主题时，跟随系统会使用白天模式；处于深色系统主题时会使用暗夜模式。
- 设置页可管理站点规则、元素选择器、过滤订阅和规则备份。
- 关闭全局开关后，默认页面不会扫描或清理；黑名单站点仍可强制启用清理。

## 开发与测试

项目无需构建步骤，扩展源码可直接加载。

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

当前版本：`0.9.27`

## 隐私说明

- 站点规则、语言和主题偏好保存在浏览器本地存储中。
- 远程订阅仅在用户主动添加后加载。
- 项目不内置账号系统，也不要求上传浏览历史。

## License

当前仓库未附带独立许可证声明。使用、修改和再分发前，请先确认项目维护者的授权范围。

---

## English

Ad Cleaner is a lightweight, controllable Chrome extension with bilingual UI support.

It uses Manifest V3, network-level blocking, page element detection, custom site rules, and optional filter subscriptions to reduce common ads and promoted content while preserving recovery controls for false positives.

### Highlights

- Network-level ad request blocking
- Candidate detection, marking, and one-click hiding
- Per-site allowlist and blocklist
- Element picker with custom CSS selectors
- Recovery panel for restoring hidden elements
- Text-based and remote filter subscriptions
- One-click Chinese / English switching
- Theme modes: System, Dark, and Light
- Rule import, export, and cleanup
- Dynamic rule synchronization diagnostics

### Version

`0.9.27`
