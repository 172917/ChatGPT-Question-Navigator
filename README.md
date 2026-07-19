# ChatGPT Question Navigator / ChatGPT 问题导航

[![Version](https://img.shields.io/badge/version-1.2.1-10a37f)](manifest.json)
[![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4)](#安装教程)
[![Edge](https://img.shields.io/badge/Edge-supported-0AA0F5)](#安装教程)
[![License](https://img.shields.io/badge/license-GPL--3.0-black)](LICENSE)

一个本地优先的 Chrome / Edge 扩展，把 ChatGPT 长对话中的问题整理成可搜索、可收藏、可分类、可贴标签并能一键跳回的工作索引。

ChatGPT Question Navigator is a local-first Chrome / Edge extension that turns questions in long ChatGPT conversations into a searchable, organized working index.

![ChatGPT Question Navigator poster](marketing/chatgpt-question-navigator-poster.png)

## 宣传视频 / Product video

[▶ 播放 37 秒宣传视频 / Watch the 37-second product video](marketing/video/exports/question-navigator-demo-github.mp4?raw=1)

视频规格：1920×1080、30 fps、约 17.9 MB。视频演示了自动分类、搜索、收藏、自定义标签、批量标记、语言切换和一键跳回。

Video: 1920×1080, 30 fps, approximately 17.9 MB. It demonstrates automatic categories, search, favorites, custom labels, batch labeling, language switching, and instant jump-back.

## 中文

### v1.2.1 更新内容

- 新增全局“自动分类”开关；关闭后按原始提问顺序平铺显示。
- 新增可跨对话复用的自定义标签，一个问题可以拥有多个标签。
- 新增单题标签编辑、批量选择、全选可见结果以及批量添加/移除标签。
- 支持简体中文和 English，并可跟随浏览器语言或手动切换。
- 修复历史问题延迟加载后的顺序、引用文字裁切和标签菜单层级遮挡。
- 保留搜索、收藏、人工分类修正、跳转高亮、拖动、缩放和折叠功能。

### 核心功能

- 自动读取当前 ChatGPT 对话中已经加载的用户问题。
- 本地归入“代码、方案、资料、待办、其他”五个固定分类。
- 支持关闭自动分类并按提问时间顺序浏览。
- 搜索问题正文和引用片段，支持中英文及大小写不敏感匹配。
- 收藏重要问题，并在刷新或重新打开同一对话后恢复。
- 手动修改问题分类，或者恢复为自动判断。
- 创建、重命名和删除最多 30 个全局自定义标签。
- 为单个问题添加多个标签，或者批量处理当前可见结果。
- 点击问题即可跳回 ChatGPT 原消息，并短暂高亮。
- 支持动态追加新问题及历史消息延迟加载。
- 面板可拖动、缩放、折叠，并自动记住位置与尺寸。
- 所有分类和整理逻辑均在本地运行，不调用 OpenAI API。

## 安装教程

### 第一步：获取项目文件

任选一种方式：

1. 在 GitHub 页面点击 `Code` → `Download ZIP`，下载后完整解压。
2. 或使用 Git：

```powershell
git clone https://github.com/172917/ChatGPT-Question-Navigator.git
```

解压或克隆后，确认所选文件夹根目录中能够直接看到 `manifest.json`、`content.js` 和 `popup.html`。不要选择只包含项目文件夹的上一级目录。

### 第二步：安装到 Chrome

1. 在地址栏打开 `chrome://extensions/`。
2. 打开页面右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择包含 `manifest.json` 的项目根目录。
5. 安装成功后，可在浏览器工具栏的扩展菜单中固定“问题导航”。

### 第三步：安装到 Edge

1. 在地址栏打开 `edge://extensions/`。
2. 打开左侧或页面中的“开发人员模式”。
3. 点击“加载解压缩的扩展”。
4. 选择包含 `manifest.json` 的项目根目录。
5. 安装成功后，可在扩展菜单中将“问题导航”显示在工具栏。

### 第四步：首次运行

1. 打开 `https://chatgpt.com/` 中的任意对话。
2. 如果页面在安装扩展前已经打开，请刷新一次。
3. 页面中会出现“问题导航”浮动面板。
4. 点击扩展图标可以查看连接状态、刷新问题列表、切换自动分类和界面语言。

## 详细使用教程

### 1. 浏览和跳转问题

- “全部”视图会按照固定分类分区显示问题，并保留原始提问编号。
- 点击任意问题正文，页面会滚动到对应的 ChatGPT 消息并短暂高亮。
- 如果旧问题尚未出现，可向上滚动 ChatGPT 对话使历史消息加载，再点击面板刷新按钮。

### 2. 开启或关闭自动分类

- 在导航面板或扩展弹窗中切换“自动分类”。
- 开启时，问题按代码、方案、资料、待办和其他分组。
- 关闭时，固定分类筛选和分类选择器会隐藏，问题按照原始提问顺序平铺。
- 关闭不会删除收藏、人工分类或标签；重新开启后会恢复。

### 3. 搜索问题和引用

- 在顶部搜索框输入关键词。
- 搜索同时匹配问题正文和问题引用的 ChatGPT 回复片段。
- 搜索可以和收藏、固定分类或自定义标签筛选叠加使用。
- 清空搜索框即可恢复当前筛选下的全部结果。

### 4. 收藏问题

- 点击问题卡片右侧的星标即可收藏或取消收藏。
- 点击顶部“收藏”筛选，只查看已收藏问题。
- 收藏按对话隔离，并在重新打开同一稳定会话时恢复。

### 5. 修正自动分类

- 自动分类开启时，每个问题卡片会显示分类选择器。
- 可手动改为代码、方案、资料、待办或其他。
- 选择“恢复自动”即可重新使用本地分类结果。

### 6. 创建和管理自定义标签

1. 点击“管理标签”。
2. 输入 1–20 个字符的标签名称并创建，例如“工作”“论文”或“本周处理”。
3. 可在管理器中重命名或删除标签。
4. 标签名称不区分大小写判重，最多创建 30 个。
5. 标签定义可跨对话复用，但问题与标签的关联仍按对话隔离。

### 7. 给单个问题添加标签

1. 点击问题卡片右侧的 `#` 按钮。
2. 在多选菜单中勾选一个或多个标签。
3. 问题卡片最多直接显示两个标签，多余标签显示为 `+N`。
4. 当前对话已经使用的标签会出现在顶部，点击即可筛选。

### 8. 批量添加或移除标签

1. 点击“批量标记”。
2. 勾选需要处理的问题，或点击“全选可见结果”。
3. 选择目标标签。
4. 点击“添加”或“移除”。
5. 搜索和筛选可以先缩小范围，再批量处理当前可见问题。

### 9. 切换界面语言

- 在面板语言菜单或扩展弹窗中选择“自动、简体中文、English”。
- “自动”会根据浏览器 UI 语言选择中文或英文，无法匹配时使用英文。
- 语言偏好对所有 ChatGPT 对话生效，并在面板与弹窗之间实时同步。

### 10. 调整面板

- 按住标题区域拖动面板。
- 拖动右下角手柄调整宽度和高度。
- 点击右上角箭头折叠；折叠后点击圆形图标或箭头重新展开。
- 点击刷新按钮重新扫描当前页面已经加载的问题。

## 常见问题

### 面板没有出现

- 确认页面地址是 `chatgpt.com` 或旧版 `chat.openai.com`。
- 在扩展管理页确认插件处于启用状态且没有错误。
- 刷新 ChatGPT 页面；安装扩展前已经打开的标签页不会自动注入。
- 如果更新了本地代码，请在扩展管理页点击“重新加载”，然后刷新 ChatGPT。

### 问题数量或顺序不完整

ChatGPT 会按需加载长对话中的历史消息。先向上滚动对话，让旧消息进入页面，再点击刷新。扩展会根据稳定消息 ID 和页面顺序重新关联，不会把后加载的历史问题简单追加到末尾。

### 收藏或标签没有恢复

- 新建但尚未获得稳定会话 ID 的页面只使用当前页面状态。
- 稳定对话会按会话 ID 保存整理元数据。
- 清除浏览器扩展存储会同时清除收藏、人工分类、标签关联和界面偏好。

### ChatGPT 页面更新后失效

ChatGPT 的网页结构可能变化。请先重新加载扩展和页面；如果仍有问题，请在 GitHub Issues 中附上浏览器版本、复现步骤和不包含隐私内容的截图。

## 隐私与本地存储

扩展只读取当前 ChatGPT 页面中已经加载的内容，用于生成页面内导航。它不请求外部接口、不上传聊天内容、不远程保存问题文本，也不需要 API Key。

本地保存内容包括：

- 面板位置、尺寸、语言和自动分类开关。
- 全局自定义标签的 `{id, name, color}`。
- 按稳定会话保存的消息标识、收藏布尔值、固定分类 ID 和标签 ID。

不会持久化问题正文、引用片段、搜索词或其他聊天文本。自动分类完全由本地中英文关键词、代码块、文件名和报错信号等确定性规则完成。

## English

### Installation

1. Download and extract the repository, or run:

```powershell
git clone https://github.com/172917/ChatGPT-Question-Navigator.git
```

2. Open `chrome://extensions/` or `edge://extensions/`.
3. Enable Developer mode.
4. Click **Load unpacked**.
5. Select the folder that directly contains `manifest.json`.
6. Open or refresh a conversation on `https://chatgpt.com/`.

### Usage guide

1. **Browse and jump:** click a question in the panel to return to its original ChatGPT message.
2. **Automatic categories:** enable grouping into Code, Solutions, Research, To-dos, and Other, or disable it for a chronological flat list.
3. **Search:** match both question text and quoted assistant snippets. Search combines with favorites, categories, and labels.
4. **Favorites:** click the star and use the Favorites filter to revisit important questions.
5. **Category correction:** choose a fixed category or restore automatic classification from the card menu.
6. **Custom labels:** use Manage labels to create, rename, or delete reusable labels. A question can have multiple labels.
7. **Single-question labeling:** click the `#` button and select labels from the checklist.
8. **Batch labeling:** select several visible questions, choose a label, then add or remove it in one operation.
9. **Language:** choose Auto, Simplified Chinese, or English from the panel or popup.
10. **Panel controls:** drag the header, resize from the bottom-right handle, collapse with the arrow, or refresh the current question list.

### Troubleshooting

- Refresh ChatGPT after installing or reloading the extension.
- Confirm the extension is enabled and the page is on `chatgpt.com` or `chat.openai.com`.
- For incomplete long conversations, scroll upward to load older messages, then refresh the navigator.
- New chats without a stable conversation ID use page-only organizer state until the ID becomes available.
- If a ChatGPT page update breaks detection, open a GitHub issue with reproduction steps and a privacy-safe screenshot.

### Privacy

The extension reads only content already loaded in the current ChatGPT page. It does not call an external API, upload chat content, remotely store question text, or require an API key.

It locally stores panel preferences, automatic-classification and language settings, global label definitions, and conversation-scoped organizer metadata. Persisted organizer metadata contains stable identifiers, favorite flags, fixed category IDs, and label IDs—never question text, quoted snippets, or search terms.

## Development and validation

Important files:

- `manifest.json`: Manifest V3 configuration and supported ChatGPT URLs.
- `i18n.js`: Simplified Chinese/English dictionaries and locale preference.
- `organizer.js`: local classification and search rules.
- `settings.js`: automatic-classification and global-label settings.
- `content.js`: ChatGPT page integration, navigator UI, persistence, and jump behavior.
- `popup.html`, `popup.css`, `popup.js`: extension popup.
- `marketing/video/`: product-film source, renderer, script, and GitHub video.

Run the JavaScript tests:

```powershell
node --test .\tests\*.test.cjs
```

Validate the exported videos:

```powershell
node marketing/video/render-video.cjs --validate-only --profile all
```

The extension has no network permission or external runtime dependency. Raw ChatGPT recordings used for the product film are not stored in this repository.

## License

Copyright (c) 2026 Xu ZiHan.

This project is licensed under the [GNU General Public License v3.0](LICENSE). You may use, study, modify, and distribute it under the GPL-3.0 terms while preserving the license and original attribution.
