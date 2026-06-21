(async () => {
  const GLOBAL_KEY = "__chatgptQuestionNavigator";
  const HOST_ID = "chatgpt-question-navigator";
  const HIGHLIGHT_STYLE_ID = "chatgpt-question-navigator-highlight";
  const HIGHLIGHT_CLASS = "chatgpt-question-navigator-target";
  const LAYOUT_STORAGE_KEY = "chatgpt-question-navigator-layout-v1";
  const MAX_LABEL_LENGTH = 120;
  const MAX_QUOTE_LENGTH = 90;
  const PERIODIC_REFRESH_MS = 2000;
  const DEFAULT_WIDTH = 320;
  const DEFAULT_HEIGHT = 460;
  const MIN_WIDTH = 260;
  const MIN_HEIGHT = 260;
  const EDGE_PADDING = 8;
  const COLLAPSED_SIZE = 52;
  const SELECTORS = {
    userMessageRole: "[data-message-author-role='user']",
    assistantMessageRole: "[data-message-author-role='assistant']",
    userTurn: "[data-turn='user']",
    assistantTurn: "[data-turn='assistant']",
    conversationTurn: "[data-testid^='conversation-turn']",
    turnContainer: "[data-turn], [data-testid^='conversation-turn'], article, [data-message-id]",
    chromeControls: [
      "button",
      "nav",
      "svg",
      "[aria-hidden='true']",
      "[role='button']",
      ".sr-only",
      "[class*='sr-only']",
      "[data-testid*='copy' i]",
      "[data-testid*='edit' i]",
      "[data-testid*='share' i]",
      "[data-testid*='save' i]",
      "[data-testid*='project' i]"
    ].join(", "),
    quoteCandidates: [
      "blockquote",
      "[data-testid*='quote' i]",
      "[data-testid*='quoted' i]",
      "[data-testid*='reference' i]",
      "[data-testid*='citation' i]",
      "[class*='quote' i]",
      "[class*='quoted' i]",
      "[class*='reference' i]",
      "[class*='citation' i]",
      "[class*='border-l' i]",
      "[class*='border-s' i]",
      "[class*='line-clamp-3' i]",
      "[aria-label*='quote' i]",
      "[aria-label*='quoted' i]",
      "[aria-label*='引用' i]",
      "[aria-label*='引文' i]"
    ]
  };
  const BLOCK_TEXT_TAGS = new Set([
    "address",
    "article",
    "aside",
    "blockquote",
    "dd",
    "div",
    "dl",
    "dt",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hr",
    "li",
    "main",
    "ol",
    "p",
    "pre",
    "section",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "ul"
  ]);

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  async function getLicenseStatus() {
    try {
      return await chrome.runtime.sendMessage({ type: "CQN_LICENSE_STATUS" });
    } catch {
      return {
        authorized: false
      };
    }
  }

  const licenseStatus = await getLicenseStatus();
  if (!licenseStatus?.authorized) {
    return;
  }

  let entries = [];
  let entryKeys = new Set();
  let collapsed = false;
  let refreshTimer = null;
  let periodicRefreshTimer = null;
  let lastUrl = location.href;
  let lastSignature = "";
  let pendingDomChange = true;
  let warnedEmptyMessageKeys = new Set();
  let layout = loadLayout();

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("aria-live", "polite");
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host {
        --cqn-bg: rgba(255, 255, 255, 0.96);
        --cqn-panel: #ffffff;
        --cqn-text: #17202e;
        --cqn-muted: #687386;
        --cqn-border: rgba(24, 34, 48, 0.13);
        --cqn-accent: #10a37f;
        --cqn-accent-soft: rgba(16, 163, 127, 0.12);
        --cqn-shadow: 0 18px 46px rgba(16, 24, 40, 0.18);
        color-scheme: light;
        font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
      }

      *,
      *::before,
      *::after {
        box-sizing: border-box;
      }

      .navigator {
        position: fixed;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        width: 320px;
        height: 460px;
        min-width: 260px;
        min-height: 260px;
        max-width: calc(100vw - 16px);
        max-height: calc(100vh - 16px);
        border: 1px solid var(--cqn-border);
        border-radius: 8px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.36)),
          var(--cqn-bg);
        box-shadow: var(--cqn-shadow);
        color: var(--cqn-text);
        overflow: hidden;
        backdrop-filter: blur(14px);
        transition: border-color 160ms ease, box-shadow 160ms ease;
      }

      .navigator.is-collapsed {
        min-width: 0;
        min-height: 0;
        border: 0;
        border-radius: 999px;
        background: transparent;
        box-shadow: none;
        overflow: visible;
      }

      .navigator.is-dragging,
      .navigator.is-resizing {
        border-color: rgba(16, 163, 127, 0.42);
        box-shadow: 0 24px 64px rgba(16, 24, 40, 0.24);
        user-select: none;
      }

      .header {
        position: relative;
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 0 0 auto;
        padding: 12px 12px 11px;
        border-bottom: 1px solid var(--cqn-border);
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(244, 251, 248, 0.94) 100%);
        cursor: grab;
        user-select: none;
      }

      .header:active {
        cursor: grabbing;
      }

      .navigator.is-collapsed .header {
        width: 100%;
        height: 100%;
        justify-content: center;
        padding: 0;
        border-bottom: 0;
        background: transparent;
      }

      .mark {
        display: grid;
        flex: 0 0 auto;
        width: 26px;
        height: 26px;
        place-items: center;
        border-radius: 7px;
        background: var(--cqn-accent);
        color: #ffffff;
        font-size: 14px;
        font-weight: 800;
      }

      .navigator.is-collapsed .mark {
        width: 48px;
        height: 48px;
        border: 1px solid rgba(255, 255, 255, 0.42);
        border-radius: 50%;
        background: linear-gradient(145deg, #12b08a 0%, #078064 100%);
        box-shadow:
          0 14px 30px rgba(0, 0, 0, 0.18),
          inset 0 1px 0 rgba(255, 255, 255, 0.3);
        font-size: 17px;
        letter-spacing: 0;
      }

      .collapsed-count {
        display: none;
      }

      .navigator.is-collapsed .collapsed-count {
        position: absolute;
        right: -2px;
        bottom: -2px;
        display: grid;
        min-width: 18px;
        height: 18px;
        place-items: center;
        border: 2px solid #ffffff;
        border-radius: 999px;
        background: #ffffff;
        color: var(--cqn-accent);
        font-size: 9px;
        font-weight: 900;
        line-height: 1;
        padding: 0 4px;
        box-shadow: 0 7px 16px rgba(16, 24, 40, 0.16);
      }

      .title {
        min-width: 0;
        flex: 1;
      }

      .name {
        margin: 0;
        font-size: 13px;
        font-weight: 800;
        line-height: 1.25;
      }

      .count {
        margin: 2px 0 0;
        color: var(--cqn-muted);
        font-size: 11px;
        line-height: 1.25;
      }

      .drag-grip {
        display: block;
        flex: 0 0 auto;
        width: 14px;
        height: 24px;
        opacity: 0.55;
        pointer-events: none;
      }

      .drag-grip::before {
        display: block;
        width: 14px;
        height: 24px;
        content: "";
        background-image: radial-gradient(currentColor 1.2px, transparent 1.2px);
        background-position: 1px 2px;
        background-size: 6px 6px;
        color: var(--cqn-muted);
      }

      .icon-button {
        display: grid;
        flex: 0 0 auto;
        width: 28px;
        height: 28px;
        place-items: center;
        border: 1px solid transparent;
        border-radius: 7px;
        background: transparent;
        color: var(--cqn-muted);
        cursor: pointer;
        font: inherit;
      }

      .icon-button:hover {
        border-color: var(--cqn-border);
        background: rgba(15, 23, 42, 0.04);
        color: var(--cqn-text);
      }

      .navigator.is-collapsed .title,
      .navigator.is-collapsed .body,
      .navigator.is-collapsed .refresh-button,
      .navigator.is-collapsed .drag-grip,
      .navigator.is-collapsed .resize-handle {
        display: none;
      }

      .navigator.is-collapsed .toggle-button {
        position: absolute;
        top: 50%;
        right: 4px;
        width: 16px;
        height: 24px;
        border: 0;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.2);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
        color: #ffffff;
        font-size: 12px;
        font-weight: 900;
        transform: translateY(-50%);
      }

      .navigator.is-collapsed .toggle-button:hover {
        background: rgba(255, 255, 255, 0.28);
        color: #ffffff;
      }

      .body {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 10px;
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
        padding: 10px;
      }

      .tools {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .hint {
        margin: 0;
        color: var(--cqn-muted);
        font-size: 11px;
      }

      .refresh-button {
        border: 1px solid var(--cqn-border);
        border-radius: 7px;
        background: #ffffff;
        color: var(--cqn-text);
        cursor: pointer;
        font: inherit;
        font-size: 11px;
        font-weight: 700;
        padding: 5px 8px;
      }

      .refresh-button:hover {
        border-color: rgba(16, 163, 127, 0.46);
        background: var(--cqn-accent-soft);
      }

      .list {
        display: grid;
        align-content: start;
        grid-auto-rows: max-content;
        gap: 6px;
        min-height: 0;
        overflow: auto;
        padding: 0 2px 14px 0;
        scrollbar-width: thin;
      }

      .item {
        position: relative;
        display: grid;
        grid-template-columns: 30px minmax(0, 1fr);
        gap: 8px;
        width: 100%;
        height: auto;
        min-height: 42px;
        min-width: 0;
        align-items: start;
        border: 1px solid transparent;
        border-radius: 7px;
        background: transparent;
        color: var(--cqn-text);
        cursor: pointer;
        font: inherit;
        line-height: 1;
        margin: 0;
        overflow: visible;
        padding: 8px;
        text-align: left;
      }

      .item:has(.quote) {
        padding-top: 9px;
        padding-bottom: 10px;
      }

      .item:hover,
      .item:focus-visible {
        border-color: rgba(16, 163, 127, 0.36);
        background: var(--cqn-accent-soft);
        outline: none;
      }

      .index {
        display: grid;
        width: 30px;
        height: 24px;
        min-width: 30px;
        place-items: center;
        border-radius: 6px;
        background: #eef3f7;
        color: #405064;
        font-size: 11px;
        font-weight: 800;
        line-height: 1;
      }

      .text {
        display: -webkit-box;
        width: 100%;
        max-height: 35px;
        overflow: hidden;
        color: var(--cqn-text);
        font-size: 12px;
        line-height: 1.45;
        white-space: normal;
        overflow-wrap: anywhere;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        word-break: break-word;
      }

      .item-body {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        min-width: 0;
        width: 100%;
        gap: 6px;
        overflow: hidden;
      }

      .quote {
        display: -webkit-box;
        width: 100%;
        max-height: 42px;
        overflow: hidden;
        border-left: 3px solid var(--cqn-accent);
        border-radius: 5px;
        background: rgba(16, 163, 127, 0.09);
        color: #2d6f5f;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.45;
        padding: 5px 7px;
        white-space: normal;
        overflow-wrap: anywhere;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        word-break: break-word;
      }

      .quote-prefix {
        color: var(--cqn-accent);
        font-weight: 900;
      }

      .empty {
        display: grid;
        min-height: 120px;
        place-items: center;
        border: 1px dashed var(--cqn-border);
        border-radius: 7px;
        color: var(--cqn-muted);
        font-size: 12px;
        line-height: 1.5;
        padding: 16px;
        text-align: center;
      }

      .resize-handle {
        position: absolute;
        right: 0;
        bottom: 0;
        width: 22px;
        height: 22px;
        cursor: nwse-resize;
        opacity: 0.58;
      }

      .resize-handle::before {
        position: absolute;
        right: 5px;
        bottom: 5px;
        width: 11px;
        height: 11px;
        border-right: 2px solid var(--cqn-muted);
        border-bottom: 2px solid var(--cqn-muted);
        content: "";
      }

      .resize-handle::after {
        position: absolute;
        right: 9px;
        bottom: 9px;
        width: 6px;
        height: 6px;
        border-right: 2px solid var(--cqn-muted);
        border-bottom: 2px solid var(--cqn-muted);
        content: "";
      }

      .resize-handle:hover {
        opacity: 0.95;
      }

      @media (prefers-color-scheme: dark) {
        :host {
          --cqn-bg: rgba(31, 31, 31, 0.96);
          --cqn-panel: #242424;
          --cqn-text: #ececf1;
          --cqn-muted: #a8adb7;
          --cqn-border: rgba(255, 255, 255, 0.12);
          --cqn-accent-soft: rgba(16, 163, 127, 0.2);
          --cqn-shadow: 0 18px 46px rgba(0, 0, 0, 0.38);
          color-scheme: dark;
        }

        .header {
          background: linear-gradient(135deg, #2b2b2f 0%, #202522 100%);
        }

        .navigator {
          background:
            linear-gradient(180deg, rgba(55, 55, 59, 0.62), rgba(31, 31, 31, 0.58)),
            var(--cqn-bg);
        }

        .refresh-button {
          background: #242424;
        }

        .index {
          background: #34383f;
          color: #d6dae2;
        }

        .quote {
          background: rgba(16, 163, 127, 0.18);
          color: #bfe8dc;
        }

        .navigator.is-collapsed .collapsed-count {
          border-color: rgba(255, 255, 255, 0.16);
          background: #2b2b2f;
          color: #ececf1;
        }

        .navigator.is-collapsed .toggle-button {
          background: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }
      }
    </style>

    <aside class="navigator" aria-label="ChatGPT 问题导航">
      <header class="header">
        <div class="mark" aria-hidden="true">问</div>
        <span class="collapsed-count" aria-hidden="true">0</span>
        <div class="title">
          <p class="name">问题导航</p>
          <p class="count">正在扫描当前对话...</p>
        </div>
        <span class="drag-grip" title="拖动导航栏" aria-hidden="true"></span>
        <button class="icon-button refresh-button" type="button" title="刷新列表" aria-label="刷新列表">↻</button>
        <button class="icon-button toggle-button" type="button" title="折叠导航" aria-label="折叠导航">›</button>
      </header>
      <section class="body">
        <div class="tools">
          <p class="hint">点击问题跳转到原位置</p>
        </div>
        <div class="list" role="list"></div>
      </section>
      <div class="resize-handle" title="拖动缩放导航栏" aria-hidden="true"></div>
    </aside>
  `;

  const navigatorElement = shadow.querySelector(".navigator");
  const headerElement = shadow.querySelector(".header");
  const countElement = shadow.querySelector(".count");
  const collapsedCountElement = shadow.querySelector(".collapsed-count");
  const listElement = shadow.querySelector(".list");
  const toggleButton = shadow.querySelector(".toggle-button");
  const refreshButton = shadow.querySelector(".refresh-button");
  const resizeHandle = shadow.querySelector(".resize-handle");

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getNumber(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function getDefaultLayout() {
    const width = Math.min(DEFAULT_WIDTH, window.innerWidth - EDGE_PADDING * 2);
    const height = Math.min(DEFAULT_HEIGHT, window.innerHeight - EDGE_PADDING * 2);

    return {
      left: Math.max(EDGE_PADDING, window.innerWidth - width - 18),
      top: Math.min(88, Math.max(EDGE_PADDING, window.innerHeight - height - EDGE_PADDING)),
      width,
      height
    };
  }

  function loadLayout() {
    const defaults = getDefaultLayout();

    try {
      const stored = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) || "null");
      if (!stored || typeof stored !== "object") {
        return clampLayout(defaults, false);
      }

      return clampLayout(
        {
          left: getNumber(stored.left, defaults.left),
          top: getNumber(stored.top, defaults.top),
          width: getNumber(stored.width, defaults.width),
          height: getNumber(stored.height, defaults.height)
        },
        false
      );
    } catch {
      return clampLayout(defaults, false);
    }
  }

  function saveLayout() {
    try {
      localStorage.setItem(
        LAYOUT_STORAGE_KEY,
        JSON.stringify({
          left: Math.round(layout.left),
          top: Math.round(layout.top),
          width: Math.round(layout.width),
          height: Math.round(layout.height)
        })
      );
    } catch {
      // Layout persistence is optional; navigation still works without it.
    }
  }

  function clampLayout(nextLayout, useCollapsed) {
    const maxExpandedWidth = Math.max(MIN_WIDTH, window.innerWidth - EDGE_PADDING * 2);
    const maxExpandedHeight = Math.max(MIN_HEIGHT, window.innerHeight - EDGE_PADDING * 2);
    const width = clamp(getNumber(nextLayout.width, DEFAULT_WIDTH), MIN_WIDTH, maxExpandedWidth);
    const height = clamp(getNumber(nextLayout.height, DEFAULT_HEIGHT), MIN_HEIGHT, maxExpandedHeight);
    const visibleWidth = useCollapsed ? COLLAPSED_SIZE : width;
    const visibleHeight = useCollapsed ? COLLAPSED_SIZE : height;
    const maxLeft = Math.max(EDGE_PADDING, window.innerWidth - visibleWidth - EDGE_PADDING);
    const maxTop = Math.max(EDGE_PADDING, window.innerHeight - visibleHeight - EDGE_PADDING);

    return {
      left: clamp(getNumber(nextLayout.left, EDGE_PADDING), EDGE_PADDING, maxLeft),
      top: clamp(getNumber(nextLayout.top, EDGE_PADDING), EDGE_PADDING, maxTop),
      width,
      height
    };
  }

  function applyLayout(shouldSave = false) {
    layout = clampLayout(layout, collapsed);
    navigatorElement.style.left = `${layout.left}px`;
    navigatorElement.style.top = `${layout.top}px`;
    navigatorElement.style.right = "auto";
    navigatorElement.style.bottom = "auto";
    navigatorElement.style.width = `${collapsed ? COLLAPSED_SIZE : layout.width}px`;
    navigatorElement.style.height = `${collapsed ? COLLAPSED_SIZE : layout.height}px`;

    if (shouldSave) {
      saveLayout();
    }
  }

  function ensureHighlightStyle() {
    if (document.getElementById(HIGHLIGHT_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = HIGHLIGHT_STYLE_ID;
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        outline: 3px solid #10a37f !important;
        outline-offset: 5px !important;
        border-radius: 12px !important;
        box-shadow: 0 0 0 8px rgba(16, 163, 127, 0.16) !important;
        transition: outline-color 180ms ease, box-shadow 180ms ease !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function normalizeInlineText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeMultilineText(text) {
    return String(text || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function normalizeText(text) {
    return normalizeInlineText(text);
  }

  function labelText(text) {
    const cleanText = normalizeInlineText(text);
    if (cleanText.length <= MAX_LABEL_LENGTH) {
      return cleanText;
    }
    return `${cleanText.slice(0, MAX_LABEL_LENGTH - 1)}…`;
  }

  function quoteLabelText(text) {
    const cleanText = normalizeInlineText(text);
    if (cleanText.length <= MAX_QUOTE_LENGTH) {
      return cleanText;
    }
    return `${cleanText.slice(0, MAX_QUOTE_LENGTH - 1)}…`;
  }

  function findMessageContainer(element) {
    return (
      element.closest(SELECTORS.userTurn) ||
      element.closest(SELECTORS.conversationTurn) ||
      element.closest(SELECTORS.turnContainer) ||
      element
    );
  }

  function getCleanTextRoot(element) {
    return (
      (element.matches?.(SELECTORS.userMessageRole) ? element : null) ||
      element.querySelector?.(SELECTORS.userMessageRole) ||
      element
    );
  }

  function getCandidateElements(element, selectors) {
    const candidates = [];
    const seen = new Set();

    selectors.forEach((selector) => {
      try {
        if (element.matches?.(selector) && !seen.has(element)) {
          seen.add(element);
          candidates.push(element);
        }

        element.querySelectorAll(selector).forEach((node) => {
          if (!(node instanceof Element) || seen.has(node)) {
            return;
          }

          seen.add(node);
          candidates.push(node);
        });
      } catch {
        // Unsupported selector variants should not break navigation.
      }
    });

    return candidates;
  }

  function isVisualQuoteNode(node) {
    const text = normalizeQuoteText(node.textContent);
    if (!text || text.length > 500) {
      return false;
    }

    const className = String(node.className || "");
    if (/(^|\s)(border-l|border-s|pl-2|pl-3|pl-4|ps-2|ps-3|ps-4)(\s|$)/i.test(className)) {
      return true;
    }

    try {
      const style = window.getComputedStyle(node);
      const borderLeftWidth = Number.parseFloat(style.borderLeftWidth || "0");
      const borderInlineStartWidth = Number.parseFloat(style.borderInlineStartWidth || "0");
      return (
        (borderLeftWidth >= 2 && style.borderLeftStyle !== "none") ||
        (borderInlineStartWidth >= 2 && style.borderInlineStartStyle !== "none")
      );
    } catch {
      return false;
    }
  }

  function getQuoteNodes(element) {
    const candidates = getCandidateElements(element, SELECTORS.quoteCandidates);

    element.querySelectorAll("div, p, span").forEach((node) => {
      if (node instanceof Element && isVisualQuoteNode(node) && !candidates.includes(node)) {
        candidates.push(node);
      }
    });

    element.querySelectorAll("button").forEach((node) => {
      if (node instanceof Element && isReferenceButton(node) && !candidates.includes(node)) {
        candidates.push(node);
      }
    });

    return candidates.filter((node) => {
      const text = normalizeQuoteText(node.textContent);
      const hasSelectedAncestor = candidates.some(
        (candidate) => candidate !== node && candidate.contains(node)
      );

      return text && !hasSelectedAncestor;
    });
  }

  function isReferenceButton(node) {
    const rawText = normalizeMultilineText(node.textContent);
    const text = normalizeQuoteText(rawText);
    if (text.length < 8 || text.length > 600) {
      return false;
    }

    const testId = node.getAttribute("data-testid") || "";
    const ariaLabel = node.getAttribute("aria-label") || "";
    if (/(copy|edit|share|save|project)/i.test(testId) || /复制|编辑|分享|保存|copy|edit|share|save/i.test(ariaLabel)) {
      return false;
    }

    return rawText.includes("\n") || /^#{1,6}\s/.test(text) || text.length >= 24;
  }

  function normalizeQuoteText(text) {
    return normalizeMultilineText(text)
      .replace(/^(引用|引用内容|引文|quote|quoted text|reference)\s*[:：-]?\s*/i, "")
      .replace(/^["“”']+|["“”']+$/g, "")
      .trim();
  }

  function normalizeInlineQuoteText(text) {
    return normalizeQuoteText(text)
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^[“”"「」『』《》]+|[“”"「」『』《》]+$/g, "")
      .trim();
  }

  function getUniqueQuoteTexts(element) {
    const quoteTexts = [];
    const seen = new Set();

    getQuoteNodes(element).forEach((node) => {
      const text = normalizeQuoteText(node.textContent);
      const key = text.toLowerCase();

      if (!text || seen.has(key)) {
        return;
      }

      seen.add(key);
      quoteTexts.push(text);
    });

    return quoteTexts;
  }

  function removeQuoteNodes(element) {
    getQuoteNodes(element).forEach((node) => node.remove());
  }

  function removeChromeNodes(element) {
    element
      .querySelectorAll(SELECTORS.chromeControls)
      .forEach((node) => node.remove());
  }

  function trimQuoteFromQuestion(questionText, quoteTexts) {
    return quoteTexts.reduce((text, quoteText) => {
      if (!quoteText || quoteText.length < 4) {
        return text;
      }

      const normalizedQuote = quoteText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return normalizeMultilineText(
        text
          .replace(new RegExp(`^(引用|引用内容|引文)\\s*[:：-]?\\s*${normalizedQuote}\\s*`, "i"), "")
          .replace(new RegExp(`^${normalizedQuote}\\s*`, "i"), "")
      );
    }, questionText);
  }

  function splitInlineQuoteQuestion(text) {
    const cleanText = normalizeText(text);
    if (cleanText.length < 10) {
      return null;
    }

    const quotedMatch = cleanText.match(/[“"「『《]([^”"」』》]{4,180})[”"」』》]\s*(.*)$/);
    if (quotedMatch) {
      const quote = normalizeInlineQuoteText(quotedMatch[1]);
      const question = normalizeText(quotedMatch[2] || cleanText.replace(quotedMatch[0], ""));

      if (quote) {
        return {
          quote,
          question: question || "这句话是什么意思"
        };
      }
    }

    const suffixPatterns = [
      /^(.*?)\s*(我不明白(?:这句话|这段话|这一段|这段|这里|这个)?(?:是什么意思|什么意思|怎么理解)?[？?。.]?)$/i,
      /^(.*?)\s*(我没懂(?:这句话|这段话|这一段|这段|这里|这个)?[？?。.]?)$/i,
      /^(.*?)\s*((?:这句话|这段话|这一段|这段|这里|这个)(?:是什么意思|什么意思|怎么理解|在说什么)[？?。.]?)$/i,
      /^(.*?)\s*(是什么意思[？?。.]?)$/i,
      /^(.*?)\s*(什么意思[？?。.]?)$/i,
      /^(.*?)\s*(怎么理解[？?。.]?)$/i,
      /^(.*?)\s*(解释一下[？?。.]?)$/i
    ];

    for (const pattern of suffixPatterns) {
      const match = cleanText.match(pattern);
      if (!match) {
        continue;
      }

      const quote = normalizeInlineQuoteText(match[1]);
      const question = normalizeText(match[2]);

      if (quote.length >= 6 && question.length >= 3) {
        return { quote, question };
      }
    }

    return null;
  }

  function appendTextBreak(parts) {
    if (parts.length === 0 || parts[parts.length - 1] === "\n") {
      return;
    }

    parts.push("\n");
  }

  function extractStructuredText(element) {
    const parts = [];

    const walkNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.nodeValue || "");
        return;
      }

      if (!(node instanceof Element)) {
        return;
      }

      const tagName = node.tagName.toLowerCase();
      if (tagName === "br") {
        appendTextBreak(parts);
        return;
      }

      if (tagName === "pre") {
        appendTextBreak(parts);
        parts.push(node.textContent || "");
        appendTextBreak(parts);
        return;
      }

      const isBlock = BLOCK_TEXT_TAGS.has(tagName);
      if (isBlock) {
        appendTextBreak(parts);
      }

      if (tagName === "li") {
        parts.push("- ");
      }

      node.childNodes.forEach((childNode) => walkNode(childNode));

      if (isBlock) {
        appendTextBreak(parts);
      }
    };

    walkNode(element);
    return normalizeMultilineText(parts.join(""));
  }

  function stripAuthorLabel(text) {
    return normalizeMultilineText(text)
      .replace(/^(你说|你发送|You said|You wrote|User said)\s*[:：]?\s*/i, "")
      .replace(/^(ChatGPT 说|ChatGPT said|Assistant said)\s*[:：]?\s*/i, "")
      .trim();
  }

  function isInsideControl(element) {
    return Boolean(element.closest("button, nav, [role='button'], [aria-hidden='true']"));
  }

  function extractUserBubbleText(textRoot) {
    const candidates = [];
    const selectors = [
      "[class*='user-message-bubble-color']",
      "[class*='whitespace-pre-wrap']",
      "[class*='break-words']"
    ];

    selectors.forEach((selector) => {
      try {
        textRoot.querySelectorAll(selector).forEach((node) => {
          if (!(node instanceof Element) || isInsideControl(node) || candidates.includes(node)) {
            return;
          }

          const text = stripAuthorLabel(extractStructuredText(node));
          if (text) {
            candidates.push(node);
          }
        });
      } catch {
        // Bubble selectors are best-effort; fallback extraction still runs.
      }
    });

    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const clone = candidates[index].cloneNode(true);
      removeChromeNodes(clone);
      const text = stripAuthorLabel(extractStructuredText(clone));
      if (text) {
        return text;
      }
    }

    return "";
  }

  function getUnloadedPlaceholder(index) {
    return `问题 ${index + 1}（内容未加载）`;
  }

  function extractMessageText(messageRoot, index = 0) {
    const textRoot = getCleanTextRoot(messageRoot);
    const clone = textRoot.cloneNode(true);
    const quoteTexts = getUniqueQuoteTexts(messageRoot);
    const bubbleText = extractUserBubbleText(textRoot);

    removeQuoteNodes(clone);
    removeChromeNodes(clone);

    let questionText = trimQuoteFromQuestion(stripAuthorLabel(extractStructuredText(clone)), quoteTexts);
    if (!questionText && bubbleText) {
      questionText = bubbleText;
    }

    const inlineParts = quoteTexts.length === 0 ? splitInlineQuoteQuestion(questionText) : null;

    if (inlineParts) {
      quoteTexts.push(inlineParts.quote);
      questionText = inlineParts.question;
    }

    const quoteText = normalizeMultilineText(quoteTexts.join("\n\n"));
    const fullText = normalizeMultilineText([quoteText, questionText].filter(Boolean).join("\n\n"));
    const placeholder = getUnloadedPlaceholder(index);
    const isPlaceholder = !fullText;

    return {
      fullText,
      displayText: labelText(questionText || quoteText || placeholder),
      isPlaceholder,
      quoteText,
      quoteLabel: quoteLabelText(quoteText),
      questionText,
      label: labelText(questionText || quoteText || placeholder),
      searchText: normalizeInlineText(fullText || placeholder)
    };
  }

  function getMessageParts(messageRoot, index = 0) {
    return extractMessageText(messageRoot, index);
  }

  function isUserMessageContainer(container) {
    if (container.matches?.(SELECTORS.assistantTurn)) {
      return false;
    }

    if (container.matches?.(SELECTORS.userTurn)) {
      return true;
    }

    if (container.querySelector(SELECTORS.userMessageRole)) {
      return true;
    }

    if (container.querySelector(SELECTORS.assistantMessageRole)) {
      return false;
    }

    const authorText = normalizeText(
      Array.from(
        container.querySelectorAll(
          [
            ".sr-only",
            "[class*='sr-only']",
            "[data-testid*='author' i]",
            "[aria-label*='author' i]"
          ].join(", ")
        )
      )
        .map((node) => node.textContent)
        .join(" ")
    );

    return /you said|you wrote|user said|你说|你发送|用户/i.test(authorText);
  }

  function sortByDocumentOrder(left, right) {
    if (left === right) {
      return 0;
    }

    const position = left.compareDocumentPosition(right);
    if (position & Node.DOCUMENT_POSITION_PRECEDING) {
      return 1;
    }

    if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
      return -1;
    }

    return 0;
  }

  function getUserMessageRoots() {
    const roots = [];
    const seen = new Set();

    const addRoot = (node) => {
      if (!(node instanceof Element)) {
        return;
      }

      const root = findMessageContainer(node);
      if (seen.has(root)) {
        return;
      }

      seen.add(root);
      roots.push(root);
    };

    document
      .querySelectorAll(SELECTORS.userMessageRole)
      .forEach((node) => addRoot(node));

    document
      .querySelectorAll([SELECTORS.userTurn, SELECTORS.conversationTurn, "article"].join(", "))
      .forEach((container) => {
        if (isUserMessageContainer(container)) {
          addRoot(container);
        }
      });

    return roots.sort(sortByDocumentOrder);
  }

  function getTurnDebugId(container) {
    return (
      container.getAttribute("data-turn-id") ||
      container.getAttribute("data-turn-id-container") ||
      container.querySelector("[data-message-id]")?.getAttribute("data-message-id") ||
      container.getAttribute("data-message-id") ||
      container.getAttribute("data-testid") ||
      ""
    );
  }

  function getTurnId(container) {
    return (
      container.getAttribute("data-turn-id") ||
      container.getAttribute("data-turn-id-container") ||
      ""
    );
  }

  function getMessageId(container) {
    return (
      container.querySelector("[data-message-id]")?.getAttribute("data-message-id") ||
      container.getAttribute("data-message-id") ||
      ""
    );
  }

  function warnEmptyMessage(container, key, index) {
    if (warnedEmptyMessageKeys.has(key)) {
      return;
    }

    warnedEmptyMessageKeys.add(key);
    console.warn("[ChatGPT Question Navigator] 用户消息容器当前没有可解析文本，已生成可定位占位项。", {
      index: index + 1,
      key,
      turnId: getTurnDebugId(container)
    });
  }

  function scanUserMessages() {
    return getUserMessageRoots()
      .map((container, index) => {
        try {
          const parts = extractMessageText(container, index);
          const key = getMessageKey(container, parts);
          const titleText = parts.fullText || `内容尚未加载。\n定位 ID：${getTurnDebugId(container) || key}`;

          if (parts.isPlaceholder) {
            warnEmptyMessage(container, key, index);
          }

          return {
            key,
            id: key,
            index,
            element: container,
            turnId: getTurnId(container),
            messageId: getMessageId(container),
            testId: container.getAttribute("data-testid") || "",
            fullText: parts.fullText,
            displayText: parts.displayText,
            titleText,
            text: parts.fullText || parts.displayText,
            quote: parts.quoteText,
            quoteLabel: parts.quoteLabel,
            label: parts.displayText,
            searchText: parts.searchText,
            isPlaceholder: parts.isPlaceholder
          };
        } catch (error) {
          console.warn("[ChatGPT Question Navigator] 跳过一个无法解析的用户消息节点。", {
            index: index + 1,
            error
          });
          return null;
        }
      })
      .filter(Boolean);
  }

  function collectUserMessages() {
    return scanUserMessages();
  }

  function getMessageKey(container, parts) {
    const turnId =
      container.getAttribute("data-turn-id") ||
      container.getAttribute("data-turn-id-container");
    const messageId =
      container.querySelector("[data-message-id]")?.getAttribute("data-message-id") ||
      container.getAttribute("data-message-id");
    const testId = container.getAttribute("data-testid");

    if (turnId) {
      return `turn:${turnId}`;
    }

    if (messageId) {
      return `message:${messageId}`;
    }

    if (testId) {
      return `test:${testId}`;
    }

    return `text:${parts.searchText.slice(0, 160)}:${parts.searchText.length}`;
  }

  function updateCounts() {
    countElement.textContent =
      entries.length > 0 ? `${entries.length} 个问题` : "当前对话还没有检测到你的问题";
    collapsedCountElement.textContent =
      entries.length > 99 ? "99+" : String(entries.length);
    collapsedCountElement.title = `${entries.length} 个问题`;
  }

  function ensureEmptyState() {
    if (entries.length > 0) {
      listElement.querySelector(".empty")?.remove();
      return;
    }

    if (listElement.querySelector(".empty")) {
      return;
    }

    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "打开一个 ChatGPT 对话后，这里会列出你发出的每个问题。";
    listElement.appendChild(empty);
  }

  function fillEntryButton(button, entry, index) {
    button.title = entry.titleText || entry.fullText || entry.text || entry.displayText || "";
    button.dataset.index = String(index);
    button.setAttribute("role", "listitem");
    button.replaceChildren();

    const number = document.createElement("span");
    number.className = "index";
    number.textContent = String(index + 1);

    const text = document.createElement("span");
    text.className = "text";
    text.textContent = entry.displayText || entry.label;

    const body = document.createElement("span");
    body.className = "item-body";

    if (entry.quote && !entry.isPlaceholder) {
      const quote = document.createElement("span");
      quote.className = "quote";

      const prefix = document.createElement("span");
      prefix.className = "quote-prefix";
      prefix.textContent = "引用：";

      quote.append(prefix, document.createTextNode(entry.quoteLabel));
      body.appendChild(quote);
    }

    body.appendChild(text);
    button.append(number, body);
  }

  function createEntryButton(entry, index) {
    const button = document.createElement("button");
    button.className = "item";
    button.type = "button";
    fillEntryButton(button, entry, index);
    return button;
  }

  function buildNavItems(messages) {
    const fragment = document.createDocumentFragment();
    messages.forEach((entry, index) => {
      fragment.appendChild(createEntryButton(entry, index));
    });
    return fragment;
  }

  function render() {
    updateCounts();
    listElement.replaceChildren();

    if (entries.length === 0) {
      ensureEmptyState();
      return;
    }

    listElement.appendChild(buildNavItems(entries));
  }

  function computePageSignature(messages) {
    const keyList = messages.map((entry) => entry.key);
    const lastSummaries = messages.slice(-3).map((entry) => {
      const summary = normalizeInlineText(entry.searchText || entry.displayText).slice(0, 120);
      return `${entry.key}:${summary}`;
    });

    return JSON.stringify({
      url: location.href,
      userCount: messages.length,
      keys: keyList,
      lastSummaries,
      turnCount: document.querySelectorAll(SELECTORS.conversationTurn).length
    });
  }

  function replaceEntries(nextEntries, shouldRender) {
    entries = nextEntries.map((entry, index) => ({
      ...entry,
      index
    }));
    entryKeys = new Set(entries.map((entry) => entry.key));

    if (shouldRender) {
      render();
    }
  }

  function mergePersistentPlaceholders(nextEntries, shouldPreservePlaceholders) {
    if (!shouldPreservePlaceholders || entries.length === 0) {
      return nextEntries;
    }

    const pendingEntries = [...nextEntries];
    const mergedEntries = [];

    entries.forEach((currentEntry) => {
      const nextIndex = pendingEntries.findIndex((nextEntry) => areSameMessageEntry(currentEntry, nextEntry));

      if (nextIndex >= 0) {
        const nextEntry = pendingEntries.splice(nextIndex, 1)[0];
        mergedEntries.push(mergeSameMessageEntry(currentEntry, nextEntry));
        return;
      }

      if (currentEntry.isPlaceholder) {
        const hydratedEntry = hydratePlaceholderEntry(currentEntry, mergedEntries.length);
        if (hydratedEntry && !hydratedEntry.isPlaceholder) {
          const hydratedIndex = pendingEntries.findIndex((nextEntry) =>
            areSameMessageEntry(hydratedEntry, nextEntry)
          );
          if (hydratedIndex >= 0) {
            pendingEntries.splice(hydratedIndex, 1);
          }

          mergedEntries.push(hydratedEntry);
          return;
        }

        mergedEntries.push({
          ...currentEntry,
          isStalePlaceholder: !currentEntry.element?.isConnected
        });
        return;
      }

      const currentElement = currentEntry.element?.isConnected
        ? currentEntry.element
        : findCurrentElementForEntry(currentEntry);
      mergedEntries.push({
        ...currentEntry,
        element: currentElement || currentEntry.element,
        isStalePlaceholder: !currentElement
      });
    });

    mergedEntries.push(...pendingEntries);
    return mergedEntries;
  }

  function mergeSameMessageEntry(currentEntry, nextEntry) {
    if (!currentEntry) {
      return nextEntry;
    }

    if (!nextEntry) {
      return currentEntry;
    }

    if (!currentEntry.isPlaceholder && nextEntry.isPlaceholder) {
      return {
        ...currentEntry,
        element: nextEntry.element || currentEntry.element,
        turnId: nextEntry.turnId || currentEntry.turnId || "",
        messageId: nextEntry.messageId || currentEntry.messageId || "",
        testId: nextEntry.testId || currentEntry.testId || "",
        isPlaceholder: false,
        isStalePlaceholder: false
      };
    }

    return nextEntry;
  }

  function getEntryStableIds(entry) {
    if (!entry) {
      return [];
    }

    return [entry.key, entry.turnId, entry.messageId, entry.testId].filter(Boolean);
  }

  function areSameMessageEntry(left, right) {
    const rightIds = new Set(getEntryStableIds(right));
    return getEntryStableIds(left).some((id) => rightIds.has(id));
  }

  function hydratePlaceholderEntry(entry, index) {
    const element = entry.element?.isConnected ? entry.element : findCurrentElementForEntry(entry);
    if (!element) {
      return null;
    }

    try {
      const parts = extractMessageText(element, index);
      if (parts.isPlaceholder) {
        return null;
      }

      const key = getMessageKey(element, parts);
      return {
        ...entry,
        key,
        id: key,
        index,
        element,
        turnId: getTurnId(element) || entry.turnId || "",
        messageId: getMessageId(element) || entry.messageId || "",
        testId: element.getAttribute("data-testid") || entry.testId || "",
        fullText: parts.fullText,
        displayText: parts.displayText,
        titleText: parts.fullText,
        text: parts.fullText,
        quote: parts.quoteText,
        quoteLabel: parts.quoteLabel,
        label: parts.displayText,
        searchText: parts.searchText,
        isPlaceholder: false,
        isStalePlaceholder: false
      };
    } catch (error) {
      console.warn("[ChatGPT Question Navigator] 占位消息已进入 DOM，但提取真实文本失败。", {
        key: entry.key,
        error
      });
      return null;
    }
  }

  function refresh(force = false) {
    const urlChanged = location.href !== lastUrl;
    if (urlChanged) {
      lastUrl = location.href;
      lastSignature = "";
      warnedEmptyMessageKeys = new Set();
    }

    const scannedEntries = scanUserMessages();
    const nextEntries = mergePersistentPlaceholders(scannedEntries, !urlChanged);
    const nextSignature = computePageSignature(nextEntries);
    const shouldRender = force || urlChanged || nextSignature !== lastSignature;

    replaceEntries(nextEntries, shouldRender);

    if (shouldRender) {
      lastSignature = nextSignature;
    }

    pendingDomChange = false;
    return shouldRender;
  }

  function scheduleRefresh(force = false) {
    window.clearTimeout(refreshTimer);
    if (force) {
      refreshTimer = window.setTimeout(() => refresh(true), 0);
      return;
    }

    pendingDomChange = true;
  }

  function runPeriodicRefresh() {
    if (document.visibilityState === "hidden" && !pendingDomChange) {
      return;
    }

    refresh(true);
  }

  function startPeriodicRefresh() {
    window.clearInterval(periodicRefreshTimer);
    periodicRefreshTimer = window.setInterval(runPeriodicRefresh, PERIODIC_REFRESH_MS);
  }

  function escapeAttributeValue(value) {
    if (window.CSS?.escape) {
      return CSS.escape(value);
    }

    return String(value).replace(/["\\]/g, "\\$&");
  }

  function findCurrentElementForEntry(entry) {
    if (!entry?.key) {
      return null;
    }

    const [kind, ...rest] = entry.key.split(":");
    const rawValue = rest.join(":");
    const value = escapeAttributeValue(rawValue);

    if (!rawValue) {
      return null;
    }

    if (kind === "message") {
      const messageNode = document.querySelector(`[data-message-id="${value}"]`);
      return messageNode ? findMessageContainer(messageNode) : null;
    }

    if (kind === "turn") {
      return document.querySelector(
        `[data-turn-id="${value}"], [data-turn-id-container="${value}"]`
      );
    }

    if (kind === "test") {
      return document.querySelector(`[data-testid="${value}"]`);
    }

    return null;
  }

  function jumpToEntry(index) {
    const entry = entries[index];
    if (!entry?.element?.isConnected) {
      const currentElement = findCurrentElementForEntry(entry);
      if (currentElement) {
        entry.element = currentElement;
      } else if (entry?.isPlaceholder) {
        console.warn("[ChatGPT Question Navigator] 占位消息当前不在 DOM 中，已保留导航项等待 ChatGPT 重新渲染。", {
          key: entry.key
        });
        return;
      } else {
        scheduleRefresh(false);
        return;
      }
    }

    if (!entry?.element?.isConnected) {
      return;
    }

    ensureHighlightStyle();
    entry.element.scrollIntoView({ behavior: "smooth", block: "center" });
    scheduleRefresh(false);
    entry.element.classList.add(HIGHLIGHT_CLASS);
    window.setTimeout(() => {
      entry.element.classList.remove(HIGHLIGHT_CLASS);
    }, 1600);
  }

  function setCollapsed(nextCollapsed) {
    collapsed = nextCollapsed;
    navigatorElement.classList.toggle("is-collapsed", collapsed);
    toggleButton.textContent = collapsed ? "‹" : "›";
    toggleButton.title = collapsed ? "展开导航" : "折叠导航";
    toggleButton.setAttribute("aria-label", toggleButton.title);
    applyLayout(false);
  }

  function startDrag(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("button")) {
      return;
    }

    event.preventDefault();

    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = layout.left;
    const startTop = layout.top;
    const wasCollapsedAtStart = collapsed;
    let moved = false;

    navigatorElement.classList.add("is-dragging");
    headerElement.setPointerCapture?.(pointerId);

    const move = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }

      layout = {
        ...layout,
        left: startLeft + moveEvent.clientX - startX,
        top: startTop + moveEvent.clientY - startY
      };
      moved =
        moved ||
        Math.abs(moveEvent.clientX - startX) > 3 ||
        Math.abs(moveEvent.clientY - startY) > 3;
      applyLayout(false);
    };

    const stop = (stopEvent) => {
      if (stopEvent.pointerId !== pointerId) {
        return;
      }

      navigatorElement.classList.remove("is-dragging");
      headerElement.releasePointerCapture?.(pointerId);
      if (wasCollapsedAtStart && !moved) {
        setCollapsed(false);
      }
      applyLayout(true);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  function startResize(event) {
    if (collapsed) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = layout.width;
    const startHeight = layout.height;

    navigatorElement.classList.add("is-resizing");
    resizeHandle.setPointerCapture?.(pointerId);

    const move = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }

      layout = {
        ...layout,
        width: startWidth + moveEvent.clientX - startX,
        height: startHeight + moveEvent.clientY - startY
      };
      applyLayout(false);
    };

    const stop = (stopEvent) => {
      if (stopEvent.pointerId !== pointerId) {
        return;
      }

      navigatorElement.classList.remove("is-resizing");
      resizeHandle.releasePointerCapture?.(pointerId);
      applyLayout(true);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  function handleViewportResize() {
    applyLayout(true);
  }

  function resetCapturedEntries() {
    entries = [];
    entryKeys = new Set();
    lastSignature = "";
    pendingDomChange = true;
    warnedEmptyMessageKeys = new Set();
    render();
  }

  function handleConversationChange() {
    resetCapturedEntries();
    scheduleRefresh(true);
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      scheduleRefresh(false);
    }
  }

  listElement.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest(".item");
    if (!button) {
      return;
    }

    jumpToEntry(Number(button.dataset.index));
  });

  toggleButton.addEventListener("click", () => {
    setCollapsed(!collapsed);
  });

  refreshButton.addEventListener("click", () => {
    refresh(true);
  });

  headerElement.addEventListener("pointerdown", startDrag);
  resizeHandle.addEventListener("pointerdown", startResize);

  const observer = new MutationObserver(() => {
    pendingDomChange = true;
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  window.addEventListener("popstate", handleConversationChange);
  window.addEventListener("hashchange", handleConversationChange);
  window.addEventListener("resize", handleViewportResize);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "CQN_STATUS") {
      refresh(true);
      sendResponse({
        enabled: true,
        count: entries.length,
        collapsed
      });
      return;
    }

    if (message?.type === "CQN_REFRESH") {
      refresh(true);
      sendResponse({
        enabled: true,
        count: entries.length
      });
    }
  });

  window[GLOBAL_KEY] = {
    refresh: () => refresh(true),
    destroy: () => {
      observer.disconnect();
      window.clearTimeout(refreshTimer);
      window.clearInterval(periodicRefreshTimer);
      window.removeEventListener("popstate", handleConversationChange);
      window.removeEventListener("hashchange", handleConversationChange);
      window.removeEventListener("resize", handleViewportResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      host.remove();
      delete window[GLOBAL_KEY];
    }
  };

  setCollapsed(false);
  refresh(true);
  startPeriodicRefresh();
})();
