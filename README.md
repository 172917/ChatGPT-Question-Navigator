# ChatGPT Question Navigator / ChatGPT 问题导航

![ChatGPT Question Navigator poster](marketing/chatgpt-question-navigator-poster.png)

## 中文

ChatGPT Question Navigator 是一个本地运行的 Chrome / Edge Manifest V3 浏览器扩展。它会在 ChatGPT 网页端当前对话里生成“问题导航”侧边栏，自动列出你发出的每个问题，并支持点击后直接跳回原提问位置。

### 解决的痛点

ChatGPT 网页端的长对话目录并不是每次都会稳定出现。即使对话很长，也可能因为页面结构、窗口宽度、旧聊天加载状态、模型/功能灰度等原因看不到目录。

这个扩展补上一个固定、可控的“我的问题”目录：长聊天复盘、查资料、论文学习、代码讨论、方案修改时，不用反复向上滚动找自己之前问过什么。

## 实际效果

![ChatGPT Question Navigator usage screenshot](docs/images/usage-screenshot.png)

## 功能

- 只在 `chatgpt.com` 和 `chat.openai.com` 页面注入脚本。
- 自动列出当前对话中用户发送的问题。
- 如果问题引用了 ChatGPT 回答中的文字，导航项会一起显示对应引用片段。
- 对“引用文字 + 我不明白 / 什么意思 / 解释一下”这类行内引用问题也会自动拆分显示。
- 点击问题即可跳转到原消息位置，并短暂高亮。
- 支持 ChatGPT 页面动态加载；捕获到新问题后增量追加。
- 右侧悬浮导航栏可拖动、可缩放、可折叠。
- 自动记住导航栏的位置和尺寸，不上传对话内容。
- GPL-3.0 开源，安装后即可本地使用。

## 安装方式

1. 打开 Chrome 或 Edge。
2. 进入 `chrome://extensions/` 或 `edge://extensions/`。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择本项目目录。
6. 打开或刷新 ChatGPT 页面。

## 使用方式

- 打开任意 ChatGPT 对话后，页面右侧会出现“问题导航”。
- 点击导航栏中的问题即可回到该问题所在位置。
- 按住导航栏标题区域可以拖动位置。
- 拖动右下角斜线手柄可以缩放导航栏大小。
- 点击右上角箭头可以折叠导航栏；折叠后点击圆形“问”按钮或小箭头可以展开。
- 点击扩展图标可以查看连接状态，也可以手动刷新问题列表。

## 隐私说明

扩展只读取当前 ChatGPT 页面中已经加载出来的对话内容，用于生成页面内导航。它不请求任何外部接口，不上传你的对话，也不把聊天内容保存到远程服务器。

扩展会在 ChatGPT 页面本地保存导航栏的位置和尺寸，方便下次打开时沿用布局设置；保存内容不包含任何聊天文本。

## 开发与工具

- `manifest.json`：扩展配置和 ChatGPT 页面匹配规则。
- `background.js`：扩展后台消息入口。
- `content.js`：注入 ChatGPT 页面，生成问题导航栏并处理跳转。
- `popup.html` / `popup.css` / `popup.js`：扩展弹窗界面。
- `marketing/`：项目展示用页面和素材。
- `tools/license-generator/`：旧授权码格式的开源参考实现，仅用于审计和学习，不包含任何生产签名材料。

## 版权与许可证

Copyright (c) 2026 Xu ZiHan.

本项目采用 GNU General Public License v3.0 授权。你可以按 GPL-3.0 的条款使用、学习、修改和分发本项目。

请保留原作者署名和许可证信息。公开仓库不代表允许他人删除作者信息、冒充原创，或把本项目伪装成自己的独立原创作品。

---

## English

ChatGPT Question Navigator is a local Chrome / Edge Manifest V3 extension. It adds a question navigator panel to the current ChatGPT conversation, lists your user questions, and lets you jump back to the original question with one click.

### Pain Point

ChatGPT's built-in long-conversation table of contents is not always visible or stable on the web app. A long chat may still have no visible outline because of page structure, viewport width, old conversation loading state, or gradual feature rollout.

This extension adds a consistent local "my questions" navigator for review, research, study, coding discussions, and multi-step planning. You can return to earlier questions without repeatedly scrolling through a long conversation.

### Demo

![ChatGPT Question Navigator usage screenshot](docs/images/usage-screenshot.png)

### Features

- Runs only on `chatgpt.com` and `chat.openai.com`.
- Lists user questions in the current conversation.
- Shows quoted snippets when a question references previous assistant text.
- Handles inline quote-and-question patterns.
- Jumps to the original message and highlights it briefly.
- Works with dynamically loaded ChatGPT conversations.
- Supports dragging, resizing, and collapsing the floating panel.
- Persists panel position and size locally.
- Does not upload or remotely store your chat content.
- GPL-3.0 open source and usable locally after installation.

### Install

1. Open Chrome or Edge.
2. Go to `chrome://extensions/` or `edge://extensions/`.
3. Enable Developer mode.
4. Click "Load unpacked".
5. Select this project folder.
6. Open or refresh ChatGPT.

### Usage

- Open any ChatGPT conversation and the "Question Navigator" panel appears on the page.
- Click a question to jump back to its original position.
- Drag the panel header to move it.
- Drag the bottom-right handle to resize it.
- Use the arrow button to collapse or expand the panel.
- Click the extension icon to check connection status or refresh the list manually.

### Privacy

The extension only reads the already loaded content in the current ChatGPT page to build an in-page navigator. It does not call an external API, upload your conversations, or save chat text to a remote server.

The extension stores panel layout settings locally in the page so your preferred position and size can be reused. Those settings do not include chat text.

### Development

- `manifest.json`: extension manifest and ChatGPT match rules.
- `background.js`: background message entrypoint.
- `content.js`: injected page script for the navigator and jump behavior.
- `popup.html` / `popup.css` / `popup.js`: extension popup UI.
- `marketing/`: project poster and marketing assets.
- `tools/license-generator/`: open reference implementation for the legacy license-token format. It is kept for auditability and does not contain production signing material.

### License

Copyright (c) 2026 Xu ZiHan.

This project is licensed under the GNU General Public License v3.0. You may use, study, modify, and distribute it under the GPL-3.0 terms.

Please keep the original author attribution and license notice. A public repository does not permit removing attribution, impersonating the original author, or presenting this project as someone else's independent original work.
