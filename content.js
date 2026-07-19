(async () => {
  const GLOBAL_KEY = "__chatgptQuestionNavigator";
  const HOST_ID = "chatgpt-question-navigator";
  const HIGHLIGHT_STYLE_ID = "chatgpt-question-navigator-highlight";
  const HIGHLIGHT_CLASS = "chatgpt-question-navigator-target";
  const LAYOUT_STORAGE_KEY = "chatgpt-question-navigator-layout-v1";
  const LEGACY_ORGANIZER_STORAGE_PREFIX = "cqn-organizer-state-v1";
  const ORGANIZER_STORAGE_PREFIX = "cqn-organizer-state-v2";
  const ORGANIZER_STORAGE_VERSION = 2;
  const MAX_LABEL_LENGTH = 120;
  const MAX_QUOTE_LENGTH = 90;
  const PERIODIC_REFRESH_MS = 2000;
  const DEFAULT_WIDTH = 360;
  const DEFAULT_HEIGHT = 560;
  const MIN_WIDTH = 300;
  const MIN_HEIGHT = 340;
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

  const i18n = globalThis.CQN_I18N;
  const organizer = globalThis.CQN_ORGANIZER;
  const settings = globalThis.CQN_SETTINGS;
  if (!i18n || !organizer || !settings) {
    console.error("[ChatGPT Question Navigator] Shared modules are unavailable.");
    return;
  }

  await Promise.all([i18n.initialize(), settings.initialize()]);

  let entries = [];
  let collapsed = false;
  let currentFilter = "all";
  let searchQuery = "";
  let refreshTimer = null;
  let periodicRefreshTimer = null;
  let languageUnsubscribe = null;
  let settingsUnsubscribe = null;
  let autoClassificationEnabled = settings.getAutoClassificationEnabled();
  let customLabels = settings.getLabels();
  let labelsExpanded = false;
  let labelManagerOpen = false;
  let batchMode = false;
  let selectedEntryKeys = new Set();
  let lastUrl = location.href;
  let lastSignature = "";
  let pendingDomChange = true;
  let warnedEmptyMessageKeys = new Set();
  let conversationStorageKey = getConversationStorageKey();
  let organizerState = createEmptyOrganizerState();
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
        --cqn-code: #2563eb;
        --cqn-solution: #7c3aed;
        --cqn-research: #0891b2;
        --cqn-todo: #d97706;
        --cqn-other: #64748b;
        --cqn-shadow: 0 18px 46px rgba(16, 24, 40, 0.18);
        color-scheme: light;
        font-family: "Bahnschrift", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;
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
        container-type: inline-size;
        width: 320px;
        height: 460px;
        min-width: 260px;
        min-height: 260px;
        max-width: calc(100vw - 16px);
        max-height: calc(100vh - 16px);
        border: 1px solid var(--cqn-border);
        border-radius: 14px;
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
        padding: 13px 13px 12px;
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
        border-radius: 9px;
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
        gap: 11px;
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
        padding: 11px;
      }

      .tools {
        display: grid;
        gap: 8px;
      }

      .hint {
        margin: 0;
        color: var(--cqn-muted);
        font-size: 11px;
      }

      .search-shell {
        position: relative;
        display: grid;
        grid-template-columns: 20px minmax(0, 1fr) 24px;
        align-items: center;
        min-height: 38px;
        border: 1px solid var(--cqn-border);
        border-radius: 10px;
        background: color-mix(in srgb, var(--cqn-panel) 92%, var(--cqn-accent) 8%);
        padding: 0 7px 0 9px;
        transition: border-color 140ms ease, box-shadow 140ms ease;
      }

      .search-shell:focus-within {
        border-color: color-mix(in srgb, var(--cqn-accent) 60%, transparent);
        box-shadow: 0 0 0 3px var(--cqn-accent-soft);
      }

      .search-icon {
        color: var(--cqn-muted);
        font-size: 16px;
        line-height: 1;
      }

      .search-input {
        min-width: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--cqn-text);
        font: inherit;
        font-size: 12px;
        line-height: 1.4;
      }

      .search-input::placeholder {
        color: color-mix(in srgb, var(--cqn-muted) 78%, transparent);
      }

      .clear-search {
        display: grid;
        width: 24px;
        height: 24px;
        place-items: center;
        border: 0;
        border-radius: 7px;
        background: transparent;
        color: var(--cqn-muted);
        cursor: pointer;
        font: inherit;
        font-size: 16px;
      }

      .clear-search[hidden] {
        display: none;
      }

      .clear-search:hover {
        background: var(--cqn-accent-soft);
        color: var(--cqn-text);
      }

      .filter-row {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
        overflow: visible;
        padding: 1px;
      }

      .label-filter-row {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .label-filter-row:empty {
        display: none;
      }

      .label-filter-chip {
        display: inline-flex;
        min-width: 0;
        max-width: 132px;
        min-height: 25px;
        align-items: center;
        gap: 5px;
        border: 1px solid color-mix(in srgb, var(--label-color) 34%, var(--cqn-border));
        border-radius: 7px;
        background: color-mix(in srgb, var(--cqn-panel) 94%, var(--label-color) 6%);
        color: var(--cqn-text);
        cursor: pointer;
        font: inherit;
        font-size: 9px;
        font-weight: 800;
        padding: 4px 7px;
      }

      .label-filter-chip.is-active {
        border-color: var(--label-color);
        background: var(--label-color);
        color: #ffffff;
      }

      .label-filter-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .organize-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .auto-control {
        display: inline-flex;
        min-width: 0;
        align-items: center;
        gap: 7px;
        color: var(--cqn-text);
        cursor: pointer;
        font-size: 10px;
        font-weight: 800;
      }

      .auto-control input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }

      .switch-track {
        position: relative;
        flex: 0 0 auto;
        width: 30px;
        height: 17px;
        border-radius: 999px;
        background: #a5adba;
        transition: background 150ms ease;
      }

      .switch-track::after {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 11px;
        height: 11px;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.24);
        content: "";
        transition: transform 150ms ease;
      }

      .auto-control input:checked + .switch-track {
        background: var(--cqn-accent);
      }

      .auto-control input:checked + .switch-track::after {
        transform: translateX(13px);
      }

      .auto-control input:focus-visible + .switch-track {
        box-shadow: 0 0 0 3px var(--cqn-accent-soft);
      }

      .organize-actions {
        display: flex;
        gap: 5px;
      }

      .compact-button {
        min-height: 26px;
        border: 1px solid var(--cqn-border);
        border-radius: 7px;
        background: var(--cqn-panel);
        color: var(--cqn-muted);
        cursor: pointer;
        font: inherit;
        font-size: 9px;
        font-weight: 800;
        padding: 0 7px;
      }

      .compact-button:hover,
      .compact-button.is-active {
        border-color: color-mix(in srgb, var(--cqn-accent) 45%, var(--cqn-border));
        background: var(--cqn-accent-soft);
        color: var(--cqn-text);
      }

      .label-manager,
      .batch-toolbar {
        display: grid;
        gap: 8px;
        border: 1px solid var(--cqn-border);
        border-radius: 10px;
        background: color-mix(in srgb, var(--cqn-panel) 96%, var(--cqn-accent) 4%);
        padding: 9px;
      }

      .label-manager[hidden],
      .batch-toolbar[hidden] {
        display: none;
      }

      .manager-heading {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 8px;
      }

      .manager-title {
        margin: 0;
        font-size: 11px;
        font-weight: 900;
      }

      .manager-hint,
      .manager-message {
        margin: 2px 0 0;
        color: var(--cqn-muted);
        font-size: 9px;
        line-height: 1.45;
      }

      .manager-message.is-error {
        color: #b42318;
      }

      .label-create-row,
      .manager-label-row,
      .batch-actions {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .label-input,
      .batch-label-select {
        min-width: 0;
        min-height: 28px;
        flex: 1;
        border: 1px solid var(--cqn-border);
        border-radius: 7px;
        outline: 0;
        background: var(--cqn-panel);
        color: var(--cqn-text);
        font: inherit;
        font-size: 10px;
        padding: 0 7px;
      }

      .label-input:focus,
      .batch-label-select:focus {
        border-color: var(--cqn-accent);
        box-shadow: 0 0 0 2px var(--cqn-accent-soft);
      }

      .manager-labels {
        display: grid;
        max-height: 152px;
        gap: 5px;
        overflow: auto;
      }

      .label-color-dot {
        flex: 0 0 auto;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--label-color);
      }

      .manager-label-row .label-input {
        background: transparent;
      }

      .batch-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        color: var(--cqn-muted);
        font-size: 10px;
        font-weight: 800;
      }

      .filter-chip {
        display: inline-flex;
        width: 100%;
        min-width: 0;
        align-items: center;
        justify-content: center;
        gap: 3px;
        min-height: 28px;
        border: 1px solid var(--cqn-border);
        border-radius: 999px;
        background: var(--cqn-panel);
        color: var(--cqn-muted);
        cursor: pointer;
        font: inherit;
        font-size: 9px;
        font-weight: 800;
        padding: 0 4px;
        white-space: nowrap;
      }

      .filter-label {
        min-width: 0;
      }

      .filter-chip:hover,
      .filter-chip:focus-visible {
        border-color: color-mix(in srgb, var(--cqn-accent) 48%, var(--cqn-border));
        color: var(--cqn-text);
        outline: none;
      }

      .filter-chip.is-active {
        border-color: var(--cqn-accent);
        background: var(--cqn-accent);
        color: #ffffff;
        box-shadow: 0 5px 13px rgba(16, 163, 127, 0.2);
      }

      .filter-count {
        flex: 0 0 auto;
        opacity: 0.72;
        font-variant-numeric: tabular-nums;
      }

      @container (min-width: 340px) {
        .filter-chip {
          gap: 5px;
          font-size: 10px;
          padding: 0 7px;
        }
      }

      .utility-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .language-control {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: var(--cqn-muted);
      }

      .language-select {
        max-width: 112px;
        min-height: 26px;
        border: 1px solid var(--cqn-border);
        border-radius: 7px;
        outline: none;
        background: var(--cqn-panel);
        color: var(--cqn-text);
        cursor: pointer;
        font: inherit;
        font-size: 10px;
        font-weight: 700;
        padding: 0 5px;
      }

      .language-select:focus-visible {
        border-color: var(--cqn-accent);
        box-shadow: 0 0 0 2px var(--cqn-accent-soft);
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
        gap: 10px;
        min-height: 0;
        overflow: auto;
        padding: 0 3px 16px 0;
        scrollbar-width: thin;
      }

      .group {
        display: grid;
        gap: 6px;
      }

      .group-header {
        display: flex;
        align-items: center;
        gap: 7px;
        min-height: 22px;
        color: var(--cqn-muted);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.02em;
        padding: 0 4px;
        text-transform: uppercase;
      }

      .group-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--category-color, var(--cqn-other));
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--category-color, var(--cqn-other)) 15%, transparent);
      }

      .group-count {
        margin-left: auto;
        font-variant-numeric: tabular-nums;
      }

      .group-items {
        display: grid;
        gap: 6px;
      }

      .item-card {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px;
        width: 100%;
        height: auto;
        min-height: 56px;
        min-width: 0;
        align-items: start;
        border: 1px solid var(--cqn-border);
        border-left: 3px solid var(--category-color, var(--cqn-other));
        border-radius: 10px;
        background: color-mix(in srgb, var(--cqn-panel) 96%, var(--category-color, var(--cqn-other)) 4%);
        color: var(--cqn-text);
        margin: 0;
        overflow: visible;
        padding: 7px;
        transition: border-color 140ms ease, background 140ms ease, transform 140ms ease;
      }

      .item-card.is-selected {
        border-color: var(--cqn-accent);
        box-shadow: 0 0 0 2px var(--cqn-accent-soft);
      }

      .selection-checkbox {
        position: absolute;
        top: 10px;
        left: 9px;
        width: 16px;
        height: 16px;
        accent-color: var(--cqn-accent);
      }

      .item-card.is-batch .item-main {
        padding-left: 24px;
      }

      .item-card:hover {
        z-index: 4;
        border-color: color-mix(in srgb, var(--category-color, var(--cqn-other)) 38%, var(--cqn-border));
        background: color-mix(in srgb, var(--cqn-panel) 91%, var(--category-color, var(--cqn-other)) 9%);
        transform: translateY(-1px);
      }

      .item-card:focus-within,
      .item-card:has(.label-menu[open]) {
        z-index: 12;
      }

      .item-main {
        display: grid;
        grid-template-columns: 30px minmax(0, 1fr);
        gap: 8px;
        min-width: 0;
        border: 0;
        background: transparent;
        color: var(--cqn-text);
        cursor: pointer;
        font: inherit;
        padding: 1px;
        text-align: left;
      }

      .item-main:focus-visible {
        border-radius: 7px;
        box-shadow: 0 0 0 3px var(--cqn-accent-soft);
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

      .item-actions {
        display: grid;
        justify-items: end;
        gap: 5px;
      }

      .label-menu {
        position: relative;
        z-index: 3;
      }

      .label-menu[open] {
        z-index: 8;
      }

      .label-menu summary {
        display: grid;
        width: 28px;
        height: 24px;
        place-items: center;
        border: 1px solid var(--cqn-border);
        border-radius: 7px;
        background: var(--cqn-panel);
        color: var(--cqn-muted);
        cursor: pointer;
        font-size: 10px;
        font-weight: 900;
        list-style: none;
      }

      .label-menu summary::-webkit-details-marker {
        display: none;
      }

      .label-menu-panel {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        display: grid;
        width: 176px;
        max-height: 190px;
        gap: 3px;
        overflow: auto;
        border: 1px solid var(--cqn-border);
        border-radius: 9px;
        background: var(--cqn-panel);
        box-shadow: 0 14px 32px rgba(15, 23, 42, 0.18);
        padding: 7px;
      }

      .label-menu-option {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 6px;
        border-radius: 6px;
        color: var(--cqn-text);
        cursor: pointer;
        font-size: 10px;
        padding: 5px;
      }

      .label-menu-option:hover {
        background: var(--cqn-accent-soft);
      }

      .label-menu-option span:last-child {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .label-pills {
        display: flex;
        min-width: 0;
        flex-wrap: wrap;
        gap: 4px;
      }

      .label-pills:empty {
        display: none;
      }

      .label-pill {
        display: inline-flex;
        max-width: 104px;
        align-items: center;
        border-radius: 999px;
        background: color-mix(in srgb, var(--label-color) 13%, transparent);
        color: var(--label-color);
        font-size: 8px;
        font-weight: 900;
        line-height: 1;
        padding: 4px 6px;
      }

      .label-pill span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .favorite-button {
        display: grid;
        width: 28px;
        height: 28px;
        place-items: center;
        border: 1px solid transparent;
        border-radius: 8px;
        background: transparent;
        color: #94a3b8;
        cursor: pointer;
        font: inherit;
        font-size: 17px;
        line-height: 1;
      }

      .favorite-button:hover,
      .favorite-button:focus-visible {
        border-color: rgba(217, 119, 6, 0.28);
        background: rgba(245, 158, 11, 0.11);
        color: #d97706;
        outline: none;
      }

      .favorite-button.is-favorite {
        color: #d97706;
      }

      .category-select {
        width: 74px;
        min-height: 24px;
        border: 1px solid color-mix(in srgb, var(--category-color, var(--cqn-other)) 30%, var(--cqn-border));
        border-radius: 7px;
        outline: none;
        background: color-mix(in srgb, var(--cqn-panel) 92%, var(--category-color, var(--cqn-other)) 8%);
        color: var(--cqn-text);
        cursor: pointer;
        font: inherit;
        font-size: 9px;
        font-weight: 800;
        padding: 0 3px;
      }

      .category-select:focus-visible {
        border-color: var(--category-color, var(--cqn-accent));
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--category-color, var(--cqn-accent)) 15%, transparent);
      }

      .quote {
        display: block;
        width: 100%;
        overflow: hidden;
        border-left: 3px solid var(--cqn-accent);
        border-radius: 5px;
        background: rgba(16, 163, 127, 0.09);
        color: #2d6f5f;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.45;
        padding: 5px 7px;
      }

      .quote-content {
        display: -webkit-box;
        width: 100%;
        overflow: hidden;
        white-space: normal;
        overflow-wrap: anywhere;
        -webkit-box-orient: vertical;
        line-clamp: 2;
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
        border-radius: 10px;
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

        .search-shell,
        .filter-chip,
        .compact-button,
        .label-input,
        .batch-label-select,
        .language-select,
        .category-select {
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

    <aside class="navigator" aria-label="${i18n.t("navigatorLabel")}">
      <header class="header">
        <div class="mark" aria-hidden="true">${i18n.getLocale() === "zh-CN" ? "问" : "Q"}</div>
        <span class="collapsed-count" aria-hidden="true">0</span>
        <div class="title">
          <p class="name">${i18n.t("navigatorName")}</p>
          <p class="count">${i18n.t("scanning")}</p>
        </div>
        <span class="drag-grip" title="${i18n.t("drag")}" aria-hidden="true"></span>
        <button class="icon-button refresh-button" type="button" title="${i18n.t("refresh")}" aria-label="${i18n.t("refresh")}">↻</button>
        <button class="icon-button toggle-button" type="button" title="${i18n.t("collapse")}" aria-label="${i18n.t("collapse")}">›</button>
      </header>
      <section class="body">
        <div class="tools">
          <div class="search-shell">
            <span class="search-icon" aria-hidden="true">⌕</span>
            <input class="search-input" type="text" role="searchbox" autocomplete="off" aria-label="${i18n.t("searchPlaceholder")}" placeholder="${i18n.t("searchPlaceholder")}">
            <button class="clear-search" type="button" title="${i18n.t("clearSearch")}" aria-label="${i18n.t("clearSearch")}" hidden>×</button>
          </div>
          <div class="organize-row">
            <label class="auto-control" title="${i18n.t("toggleAutoClassification")}">
              <input class="auto-toggle" type="checkbox" aria-label="${i18n.t("toggleAutoClassification")}">
              <span class="switch-track" aria-hidden="true"></span>
              <span class="auto-label">${i18n.t("autoClassification")}</span>
            </label>
            <div class="organize-actions">
              <button class="compact-button batch-toggle" type="button">${i18n.t("batchMode")}</button>
              <button class="compact-button manager-toggle" type="button">${i18n.t("manageLabels")}</button>
            </div>
          </div>
          <section class="label-manager" aria-label="${i18n.t("labelManagerTitle")}" hidden>
            <div class="manager-heading">
              <div>
                <p class="manager-title">${i18n.t("labelManagerTitle")}</p>
                <p class="manager-hint">${i18n.t("labelManagerHint")}</p>
              </div>
              <button class="icon-button manager-close" type="button" aria-label="${i18n.t("closeLabelManager")}">×</button>
            </div>
            <div class="label-create-row">
              <input class="label-input label-create-input" maxlength="20" placeholder="${i18n.t("labelNamePlaceholder")}">
              <button class="compact-button label-create-button" type="button">${i18n.t("createLabel")}</button>
            </div>
            <p class="manager-message" aria-live="polite"></p>
            <div class="manager-labels"></div>
          </section>
          <section class="batch-toolbar" aria-label="${i18n.t("batchMode")}" hidden>
            <div class="batch-summary">
              <span class="selected-count">${i18n.t("selectedCount", { count: 0 })}</span>
              <button class="compact-button select-visible" type="button">${i18n.t("selectVisible")}</button>
            </div>
            <div class="batch-actions">
              <select class="batch-label-select" aria-label="${i18n.t("batchLabelPlaceholder")}"></select>
              <button class="compact-button batch-add" type="button">${i18n.t("batchAdd")}</button>
              <button class="compact-button batch-remove" type="button">${i18n.t("batchRemove")}</button>
              <button class="compact-button batch-cancel" type="button">${i18n.t("batchCancel")}</button>
            </div>
          </section>
          <div class="filter-row" role="toolbar" aria-label="${i18n.t("navigatorName")}"></div>
          <div class="label-filter-row" role="toolbar" aria-label="${i18n.t("labelFilterAria")}"></div>
          <div class="utility-row">
            <p class="hint">${i18n.t("clickToJump")}</p>
            <label class="language-control">
              <span aria-hidden="true">文/A</span>
              <select class="language-select" aria-label="${i18n.t("languageLabel")}">
                <option value="auto">${i18n.t("languageAuto")}</option>
                <option value="zh-CN">${i18n.t("languageChinese")}</option>
                <option value="en">${i18n.t("languageEnglish")}</option>
              </select>
            </label>
          </div>
        </div>
        <div class="list" role="list"></div>
      </section>
      <div class="resize-handle" title="${i18n.t("resize")}" aria-hidden="true"></div>
    </aside>
  `;

  const navigatorElement = shadow.querySelector(".navigator");
  const headerElement = shadow.querySelector(".header");
  const markElement = shadow.querySelector(".mark");
  const nameElement = shadow.querySelector(".name");
  const countElement = shadow.querySelector(".count");
  const collapsedCountElement = shadow.querySelector(".collapsed-count");
  const hintElement = shadow.querySelector(".hint");
  const searchInput = shadow.querySelector(".search-input");
  const clearSearchButton = shadow.querySelector(".clear-search");
  const filterRow = shadow.querySelector(".filter-row");
  const labelFilterRow = shadow.querySelector(".label-filter-row");
  const autoToggle = shadow.querySelector(".auto-toggle");
  const autoLabel = shadow.querySelector(".auto-label");
  const batchToggle = shadow.querySelector(".batch-toggle");
  const managerToggle = shadow.querySelector(".manager-toggle");
  const labelManager = shadow.querySelector(".label-manager");
  const managerClose = shadow.querySelector(".manager-close");
  const managerTitle = shadow.querySelector(".manager-title");
  const managerHint = shadow.querySelector(".manager-hint");
  const labelCreateInput = shadow.querySelector(".label-create-input");
  const labelCreateButton = shadow.querySelector(".label-create-button");
  const managerMessage = shadow.querySelector(".manager-message");
  const managerLabels = shadow.querySelector(".manager-labels");
  const batchToolbar = shadow.querySelector(".batch-toolbar");
  const selectedCountElement = shadow.querySelector(".selected-count");
  const selectVisibleButton = shadow.querySelector(".select-visible");
  const batchLabelSelect = shadow.querySelector(".batch-label-select");
  const batchAddButton = shadow.querySelector(".batch-add");
  const batchRemoveButton = shadow.querySelector(".batch-remove");
  const batchCancelButton = shadow.querySelector(".batch-cancel");
  const languageSelect = shadow.querySelector(".language-select");
  const listElement = shadow.querySelector(".list");
  const toggleButton = shadow.querySelector(".toggle-button");
  const refreshButton = shadow.querySelector(".refresh-button");
  const dragGrip = shadow.querySelector(".drag-grip");
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

  function createEmptyOrganizerState() {
    return {
      version: ORGANIZER_STORAGE_VERSION,
      items: {}
    };
  }

  function getConversationId() {
    const segments = location.pathname.split("/").filter(Boolean);
    const conversationMarker = segments.lastIndexOf("c");
    const candidate = conversationMarker >= 0 ? segments[conversationMarker + 1] : "";
    return candidate && /^[a-zA-Z0-9_-]{8,}$/.test(candidate) ? candidate : "";
  }

  function getConversationStorageKey() {
    const conversationId = getConversationId();
    return conversationId ? `${ORGANIZER_STORAGE_PREFIX}:${conversationId}` : "";
  }

  function sanitizeOrganizerState(value) {
    if (!value || typeof value !== "object" || !value.items || typeof value.items !== "object") {
      return createEmptyOrganizerState();
    }

    const items = {};
    Object.entries(value.items).forEach(([key, item]) => {
      if (!organizer.isPersistableStateKey(key) || !item || typeof item !== "object") {
        return;
      }

      const favorite = item.favorite === true;
      const categoryOverride = organizer.isCategory(item.categoryOverride)
        ? item.categoryOverride
        : "";
      const labelIds = Array.isArray(item.labelIds)
        ? Array.from(
            new Set(item.labelIds.map(settings.normalizeLabelId).filter(Boolean))
          ).slice(0, settings.MAX_LABELS)
        : [];
      if (favorite || categoryOverride || labelIds.length) {
        items[key] = { favorite, categoryOverride, labelIds };
      }
    });

    return {
      version: ORGANIZER_STORAGE_VERSION,
      items
    };
  }

  async function loadOrganizerState(storageKey = conversationStorageKey) {
    if (!storageKey) {
      return organizerState;
    }

    try {
      const conversationId = getConversationId();
      const legacyKey = conversationId
        ? `${LEGACY_ORGANIZER_STORAGE_PREFIX}:${conversationId}`
        : "";
      const keys = legacyKey ? [storageKey, legacyKey] : [storageKey];
      const result = await chrome.storage.local.get(keys);
      if (storageKey === conversationStorageKey) {
        const storedState = result?.[storageKey];
        const legacyState = result?.[legacyKey];
        organizerState = sanitizeOrganizerState(storedState || legacyState);
        if (!storedState && legacyState) {
          await saveOrganizerStateNow(storageKey, organizerState);
        }
      }
    } catch (error) {
      console.warn("[ChatGPT Question Navigator] Organizer state could not be loaded.", error);
      if (storageKey === conversationStorageKey) {
        organizerState = createEmptyOrganizerState();
      }
    }

    return organizerState;
  }

  async function saveOrganizerStateNow(
    storageKey = conversationStorageKey,
    state = organizerState
  ) {
    if (!storageKey) {
      return;
    }

    try {
      await chrome.storage.local.set({
        [storageKey]: sanitizeOrganizerState(state)
      });
    } catch (error) {
      console.warn("[ChatGPT Question Navigator] Organizer state could not be saved.", error);
    }
  }

  function scheduleOrganizerStateSave() {
    if (!conversationStorageKey) {
      return;
    }

    void saveOrganizerStateNow(conversationStorageKey, organizerState);
  }

  function getEntryStateKeys(entry) {
    if (!entry) {
      return [];
    }

    return [
      entry.key,
      entry.turnId ? `turn:${entry.turnId}` : "",
      entry.messageId ? `message:${entry.messageId}` : "",
      entry.testId ? `test:${entry.testId}` : ""
    ].filter((value, index, values) => value && values.indexOf(value) === index);
  }

  function getEntryOrganizerRecord(entry) {
    const matchingKey = getEntryStateKeys(entry).find((key) => organizerState.items[key]);
    return matchingKey ? organizerState.items[matchingKey] : null;
  }

  function updateEntryOrganizerRecord(entry, patch) {
    const keys = getEntryStateKeys(entry);
    const canonicalKey = keys[0];
    if (!canonicalKey) {
      return;
    }

    const current = getEntryOrganizerRecord(entry) || {};
    const next = {
      favorite:
        patch.favorite === undefined ? current.favorite === true : patch.favorite === true,
      categoryOverride:
        patch.categoryOverride === undefined
          ? organizer.isCategory(current.categoryOverride)
            ? current.categoryOverride
            : ""
          : organizer.isCategory(patch.categoryOverride)
            ? patch.categoryOverride
            : "",
      labelIds:
        patch.labelIds === undefined
          ? Array.isArray(current.labelIds)
            ? current.labelIds
            : []
          : Array.from(
              new Set(
                (Array.isArray(patch.labelIds) ? patch.labelIds : [])
                  .map(settings.normalizeLabelId)
                  .filter(Boolean)
              )
            ).slice(0, settings.MAX_LABELS)
    };

    keys.forEach((key) => delete organizerState.items[key]);
    if (next.favorite || next.categoryOverride || next.labelIds.length) {
      organizerState.items[canonicalKey] = next;
    }
    scheduleOrganizerStateSave();
  }

  function applyOrganizerMetadata(entry) {
    const record = getEntryOrganizerRecord(entry) || {};
    const autoCategory = autoClassificationEnabled
      ? organizer.classifyQuestion({
          text: entry.displayText || entry.text || "",
          hasCodeBlock: entry.hasCodeBlock === true
        })
      : organizer.isCategory(entry.autoCategory)
        ? entry.autoCategory
        : "other";
    const categoryOverride = organizer.isCategory(record.categoryOverride)
      ? record.categoryOverride
      : "";

    return {
      ...entry,
      autoCategory,
      categoryOverride,
      category: categoryOverride || autoCategory,
      favorite: record.favorite === true,
      labelIds: Array.isArray(record.labelIds)
        ? record.labelIds.filter((id) => customLabels.some((label) => label.id === id))
        : []
    };
  }

  async function switchConversationState(nextStorageKey) {
    if (nextStorageKey === conversationStorageKey) {
      return;
    }

    const sessionItems = !conversationStorageKey ? { ...organizerState.items } : null;
    conversationStorageKey = nextStorageKey;
    organizerState = createEmptyOrganizerState();
    await loadOrganizerState(nextStorageKey);

    if (sessionItems && nextStorageKey) {
      organizerState.items = {
        ...sessionItems,
        ...organizerState.items
      };
      scheduleOrganizerStateSave();
    }

    entries = entries.map(applyOrganizerMetadata);
    selectedEntryKeys.clear();
    batchMode = false;
    render();
  }

  function getFavoriteCount() {
    return entries.filter((entry) => entry.favorite).length;
  }

  function getCategoryCounts() {
    return organizer.CATEGORY_ORDER.reduce((counts, category) => {
      counts[category] = entries.filter((entry) => entry.category === category).length;
      return counts;
    }, {});
  }

  function getCurrentLabelCounts() {
    return customLabels.reduce((counts, label) => {
      const count = entries.filter((entry) => entry.labelIds?.includes(label.id)).length;
      if (count > 0) {
        counts[label.id] = count;
      }
      return counts;
    }, {});
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
    return i18n.t("unloadedQuestion", { index: index + 1 });
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

  function parseConversationTurnOrder(...values) {
    for (const value of values) {
      const match = String(value || "").match(/conversation-turn-(\d+)/i);
      if (match) {
        return Number(match[1]);
      }
    }

    return null;
  }

  function getContainerConversationTurnOrder(container) {
    const turnContainer = container.matches?.("[data-testid*='conversation-turn-' i]")
      ? container
      : container.closest?.("[data-testid*='conversation-turn-' i]");
    return parseConversationTurnOrder(
      container.getAttribute("data-testid"),
      turnContainer?.getAttribute("data-testid")
    );
  }

  function getEntryConversationTurnOrder(entry) {
    if (Number.isInteger(entry?.turnOrder)) {
      return entry.turnOrder;
    }

    return parseConversationTurnOrder(entry?.testId, entry?.key);
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
            turnOrder: getContainerConversationTurnOrder(container),
            fullText: parts.fullText,
            displayText: parts.displayText,
            titleText,
            text: parts.fullText || parts.displayText,
            quote: parts.quoteText,
            quoteLabel: parts.quoteLabel,
            label: parts.displayText,
            searchText: parts.searchText,
            hasCodeBlock: Boolean(container.querySelector("pre, code")),
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
    const favorites = getFavoriteCount();
    countElement.textContent = entries.length
      ? i18n.t("questionFavoriteCount", { count: entries.length, favorites })
      : i18n.t("noQuestionsCount");
    collapsedCountElement.textContent =
      entries.length > 99 ? "99+" : String(entries.length);
    collapsedCountElement.title = i18n.t("questionCount", { count: entries.length });
  }

  function createEmptyState(message) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = message;
    return empty;
  }

  function getCategoryColor(category) {
    const variables = {
      code: "var(--cqn-code)",
      solution: "var(--cqn-solution)",
      research: "var(--cqn-research)",
      todo: "var(--cqn-todo)",
      other: "var(--cqn-other)"
    };
    return variables[category] || variables.other;
  }

  function getCategoryLabel(category) {
    return i18n.t(organizer.CATEGORY_LABEL_KEYS[category] || "categoryOther");
  }

  function getLabelById(labelId) {
    return customLabels.find((label) => label.id === labelId) || null;
  }

  function getActiveLabelId() {
    return currentFilter.startsWith("label:") ? currentFilter.slice(6) : "";
  }

  function renderFilters() {
    const categoryCounts = getCategoryCounts();
    const filters = [
      { id: "all", label: i18n.t("filterAll"), count: entries.length },
      { id: "favorites", label: i18n.t("filterFavorites"), count: getFavoriteCount() },
      ...(autoClassificationEnabled
        ? organizer.CATEGORY_ORDER.map((category) => ({
            id: category,
            label: getCategoryLabel(category),
            count: categoryCounts[category]
          }))
        : [])
    ];
    const fragment = document.createDocumentFragment();

    filters.forEach((filter) => {
      const button = document.createElement("button");
      button.className = "filter-chip";
      button.classList.toggle("is-active", currentFilter === filter.id);
      button.type = "button";
      button.dataset.filter = filter.id;
      button.setAttribute("aria-pressed", String(currentFilter === filter.id));

      const label = document.createElement("span");
      label.className = "filter-label";
      label.textContent = filter.label;
      const count = document.createElement("span");
      count.className = "filter-count";
      count.textContent = String(filter.count);
      button.append(label, count);
      fragment.appendChild(button);
    });

    filterRow.replaceChildren(fragment);

    const labelCounts = getCurrentLabelCounts();
    const usedLabels = customLabels.filter((label) => labelCounts[label.id] > 0);
    const visibleLabels = labelsExpanded ? usedLabels : usedLabels.slice(0, 4);
    const labelFragment = document.createDocumentFragment();
    visibleLabels.forEach((labelDefinition) => {
      const filterId = `label:${labelDefinition.id}`;
      const button = document.createElement("button");
      button.className = "label-filter-chip";
      button.classList.toggle("is-active", currentFilter === filterId);
      button.type = "button";
      button.dataset.filter = filterId;
      button.style.setProperty("--label-color", labelDefinition.color);
      button.setAttribute("aria-pressed", String(currentFilter === filterId));

      const name = document.createElement("span");
      name.className = "label-filter-name";
      name.textContent = labelDefinition.name;
      const count = document.createElement("span");
      count.className = "filter-count";
      count.textContent = String(labelCounts[labelDefinition.id]);
      button.append(name, count);
      labelFragment.appendChild(button);
    });

    if (usedLabels.length > 4) {
      const expandButton = document.createElement("button");
      expandButton.className = "label-filter-chip";
      expandButton.type = "button";
      expandButton.dataset.action = "expand-labels";
      expandButton.style.setProperty("--label-color", "var(--cqn-accent)");
      expandButton.textContent = labelsExpanded
        ? i18n.t("collapseLabels")
        : i18n.t("labelCountMore", { count: usedLabels.length - 4 });
      expandButton.title = i18n.t(labelsExpanded ? "collapseLabels" : "expandLabels");
      labelFragment.appendChild(expandButton);
    }
    labelFilterRow.replaceChildren(labelFragment);
  }

  function getVisibleEntries() {
    const activeLabelId = getActiveLabelId();
    return entries.filter((entry) => {
      const filterMatches =
        currentFilter === "all" ||
        (currentFilter === "favorites" && entry.favorite) ||
        (activeLabelId && entry.labelIds?.includes(activeLabelId)) ||
        (autoClassificationEnabled && entry.category === currentFilter);
      return filterMatches && organizer.matchesSearch(entry, searchQuery);
    });
  }

  function renderLabelPills(entry, body) {
    const assignedLabels = (entry.labelIds || []).map(getLabelById).filter(Boolean);
    if (!assignedLabels.length) {
      return;
    }

    const pills = document.createElement("span");
    pills.className = "label-pills";
    assignedLabels.slice(0, 2).forEach((labelDefinition) => {
      const pill = document.createElement("span");
      pill.className = "label-pill";
      pill.style.setProperty("--label-color", labelDefinition.color);
      pill.title = labelDefinition.name;
      const name = document.createElement("span");
      name.textContent = labelDefinition.name;
      pill.appendChild(name);
      pills.appendChild(pill);
    });
    if (assignedLabels.length > 2) {
      const more = document.createElement("span");
      more.className = "label-pill";
      more.style.setProperty("--label-color", "var(--cqn-muted)");
      more.textContent = i18n.t("labelCountMore", { count: assignedLabels.length - 2 });
      more.title = assignedLabels.slice(2).map((label) => label.name).join(", ");
      pills.appendChild(more);
    }
    body.appendChild(pills);
  }

  function createQuestionLabelMenu(entry) {
    const details = document.createElement("details");
    details.className = "label-menu";
    const summary = document.createElement("summary");
    summary.title = i18n.t("editQuestionLabels");
    summary.setAttribute("aria-label", summary.title);
    summary.textContent = entry.labelIds?.length ? `#${entry.labelIds.length}` : "#";
    details.appendChild(summary);

    const panel = document.createElement("div");
    panel.className = "label-menu-panel";
    panel.setAttribute("aria-label", i18n.t("questionLabels"));
    if (!customLabels.length) {
      const empty = document.createElement("span");
      empty.className = "manager-hint";
      empty.textContent = i18n.t("noCustomLabels");
      panel.appendChild(empty);
    } else {
      customLabels.forEach((labelDefinition) => {
        const option = document.createElement("label");
        option.className = "label-menu-option";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = entry.labelIds?.includes(labelDefinition.id) || false;
        checkbox.dataset.action = "question-label";
        checkbox.dataset.index = String(entry.index);
        checkbox.dataset.labelId = labelDefinition.id;
        const dot = document.createElement("span");
        dot.className = "label-color-dot";
        dot.style.setProperty("--label-color", labelDefinition.color);
        const name = document.createElement("span");
        name.textContent = labelDefinition.name;
        option.append(checkbox, dot, name);
        panel.appendChild(option);
      });
    }
    details.appendChild(panel);
    return details;
  }

  function createEntryCard(entry) {
    const card = document.createElement("article");
    card.className = "item-card";
    card.setAttribute("role", "listitem");
    card.style.setProperty(
      "--category-color",
      getCategoryColor(autoClassificationEnabled ? entry.category : "other")
    );
    card.classList.toggle("is-batch", batchMode);
    card.classList.toggle("is-selected", selectedEntryKeys.has(entry.key));

    if (batchMode) {
      const checkbox = document.createElement("input");
      checkbox.className = "selection-checkbox";
      checkbox.type = "checkbox";
      checkbox.checked = selectedEntryKeys.has(entry.key);
      checkbox.dataset.action = "batch-select";
      checkbox.dataset.index = String(entry.index);
      checkbox.setAttribute("aria-label", i18n.t("selectQuestion"));
      card.appendChild(checkbox);
    }

    const mainButton = document.createElement("button");
    mainButton.className = "item-main";
    mainButton.type = "button";
    mainButton.dataset.index = String(entry.index);
    mainButton.title = entry.titleText || entry.fullText || entry.text || entry.displayText || "";

    const number = document.createElement("span");
    number.className = "index";
    number.textContent = String(entry.index + 1);

    const text = document.createElement("span");
    text.className = "text";
    text.textContent =
      entry.displayText ||
      entry.label ||
      i18n.t("unloadedQuestion", { index: entry.index + 1 });

    const body = document.createElement("span");
    body.className = "item-body";

    if (entry.quote && !entry.isPlaceholder) {
      const quote = document.createElement("span");
      quote.className = "quote";
      quote.title = entry.quote;

      const quoteContent = document.createElement("span");
      quoteContent.className = "quote-content";

      const prefix = document.createElement("span");
      prefix.className = "quote-prefix";
      prefix.textContent = i18n.t("quotePrefix");

      quoteContent.append(prefix, document.createTextNode(entry.quoteLabel));
      quote.appendChild(quoteContent);
      body.appendChild(quote);
    }

    renderLabelPills(entry, body);
    body.appendChild(text);
    mainButton.append(number, body);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const favoriteButton = document.createElement("button");
    favoriteButton.className = "favorite-button";
    favoriteButton.classList.toggle("is-favorite", entry.favorite);
    favoriteButton.type = "button";
    favoriteButton.dataset.index = String(entry.index);
    favoriteButton.dataset.action = "favorite";
    favoriteButton.textContent = i18n.t(entry.favorite ? "favoriteSymbol" : "unfavoriteSymbol");
    favoriteButton.title = i18n.t(entry.favorite ? "removeFavorite" : "addFavorite");
    favoriteButton.setAttribute("aria-label", favoriteButton.title);
    favoriteButton.setAttribute("aria-pressed", String(entry.favorite));

    actions.append(favoriteButton, createQuestionLabelMenu(entry));
    if (autoClassificationEnabled) {
      const categorySelect = document.createElement("select");
      categorySelect.className = "category-select";
      categorySelect.dataset.index = String(entry.index);
      categorySelect.dataset.action = "category";
      categorySelect.title = i18n.t("categoryLabel");
      categorySelect.setAttribute("aria-label", i18n.t("categoryLabel"));

      const automaticOption = document.createElement("option");
      automaticOption.value = "";
      automaticOption.textContent = i18n.t("automaticCategory", {
        category: getCategoryLabel(entry.autoCategory)
      });
      categorySelect.appendChild(automaticOption);
      organizer.CATEGORY_ORDER.forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = getCategoryLabel(category);
        categorySelect.appendChild(option);
      });
      categorySelect.value = entry.categoryOverride || "";
      actions.appendChild(categorySelect);
    }
    card.append(mainButton, actions);
    return card;
  }

  function createCategoryGroup(category, categoryEntries) {
    const group = document.createElement("section");
    group.className = "group";
    group.style.setProperty("--category-color", getCategoryColor(category));

    const header = document.createElement("div");
    header.className = "group-header";
    const dot = document.createElement("span");
    dot.className = "group-dot";
    dot.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = getCategoryLabel(category);
    const count = document.createElement("span");
    count.className = "group-count";
    count.textContent = i18n.t("groupCount", { count: categoryEntries.length });
    header.append(dot, label, count);

    const items = document.createElement("div");
    items.className = "group-items";
    categoryEntries.forEach((entry) => items.appendChild(createEntryCard(entry)));
    group.append(header, items);
    return group;
  }

  function getLabelErrorMessage(reason) {
    const keys = {
      empty: "labelRequired",
      tooLong: "labelTooLong",
      duplicate: "labelDuplicate",
      limit: "labelLimit",
      missing: "labelMissing"
    };
    return i18n.t(keys[reason] || "labelOperationFailed");
  }

  function setManagerMessage(message = "", isError = false) {
    managerMessage.textContent = message;
    managerMessage.classList.toggle("is-error", isError);
  }

  function renderLabelManager() {
    labelManager.hidden = !labelManagerOpen;
    managerToggle.classList.toggle("is-active", labelManagerOpen);
    managerToggle.setAttribute("aria-pressed", String(labelManagerOpen));
    managerLabels.replaceChildren();

    if (!customLabels.length) {
      const empty = document.createElement("p");
      empty.className = "manager-hint";
      empty.textContent = i18n.t("noCustomLabels");
      managerLabels.appendChild(empty);
      return;
    }

    customLabels.forEach((labelDefinition) => {
      const row = document.createElement("div");
      row.className = "manager-label-row";
      row.dataset.labelId = labelDefinition.id;
      const dot = document.createElement("span");
      dot.className = "label-color-dot";
      dot.style.setProperty("--label-color", labelDefinition.color);
      const input = document.createElement("input");
      input.className = "label-input manager-label-input";
      input.value = labelDefinition.name;
      input.maxLength = settings.MAX_LABEL_NAME_LENGTH;
      input.setAttribute("aria-label", i18n.t("renameLabel"));
      const save = document.createElement("button");
      save.className = "compact-button label-save";
      save.type = "button";
      save.textContent = i18n.t("saveLabel");
      save.title = i18n.t("renameLabel");
      const remove = document.createElement("button");
      remove.className = "compact-button label-delete";
      remove.type = "button";
      remove.textContent = "×";
      remove.title = i18n.t("deleteLabel");
      remove.setAttribute("aria-label", remove.title);
      row.append(dot, input, save, remove);
      managerLabels.appendChild(row);
    });
  }

  function renderBatchToolbar() {
    batchToolbar.hidden = !batchMode;
    batchToggle.classList.toggle("is-active", batchMode);
    batchToggle.setAttribute("aria-pressed", String(batchMode));
    selectedCountElement.textContent = i18n.t("selectedCount", {
      count: selectedEntryKeys.size
    });

    const previousValue = batchLabelSelect.value;
    batchLabelSelect.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = i18n.t("batchLabelPlaceholder");
    batchLabelSelect.appendChild(placeholder);
    customLabels.forEach((labelDefinition) => {
      const option = document.createElement("option");
      option.value = labelDefinition.id;
      option.textContent = labelDefinition.name;
      batchLabelSelect.appendChild(option);
    });
    batchLabelSelect.value = getLabelById(previousValue) ? previousValue : "";
    const disabled = selectedEntryKeys.size === 0 || !customLabels.length;
    batchAddButton.disabled = disabled;
    batchRemoveButton.disabled = disabled;
  }

  function render() {
    if (!autoClassificationEnabled && organizer.isCategory(currentFilter)) {
      currentFilter = "all";
    }
    const activeLabelId = getActiveLabelId();
    if (activeLabelId && !getLabelById(activeLabelId)) {
      currentFilter = "all";
    }
    updateCounts();
    renderFilters();
    renderLabelManager();
    renderBatchToolbar();
    clearSearchButton.hidden = !searchQuery;
    listElement.replaceChildren();

    if (entries.length === 0) {
      listElement.appendChild(createEmptyState(i18n.t("openConversationEmpty")));
      return;
    }

    const visibleEntries = getVisibleEntries();
    if (visibleEntries.length === 0) {
      const message = searchQuery
        ? i18n.t("noResults")
        : currentFilter === "favorites"
          ? i18n.t("noFavorites")
          : getActiveLabelId()
            ? i18n.t("noLabelResults")
            : i18n.t("noCategoryResults");
      listElement.appendChild(createEmptyState(message));
      return;
    }

    const shouldGroup = autoClassificationEnabled && !getActiveLabelId();
    if (!shouldGroup) {
      visibleEntries.forEach((entry) => listElement.appendChild(createEntryCard(entry)));
      return;
    }

    organizer.CATEGORY_ORDER.forEach((category) => {
      const categoryEntries = visibleEntries.filter((entry) => entry.category === category);
      if (categoryEntries.length) {
        listElement.appendChild(createCategoryGroup(category, categoryEntries));
      }
    });
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
    entries = nextEntries.map((entry, index) =>
      applyOrganizerMetadata({
        ...entry,
        index
      })
    );

    if (shouldRender) {
      render();
    }
  }

  function mergePersistentPlaceholders(nextEntries, shouldPreservePlaceholders) {
    if (!shouldPreservePlaceholders || entries.length === 0) {
      return nextEntries;
    }

    const previousEntries = [...entries];
    const unmatchedPreviousEntries = new Set(previousEntries);
    const placementByPreviousEntry = new Map();

    // The current DOM scan is authoritative for every connected message. Building
    // from this list first prevents a newly loaded historical turn from being
    // appended after the previously known messages.
    const orderedEntries = nextEntries.map((nextEntry) => {
      const previousEntry = previousEntries.find(
        (candidate) =>
          unmatchedPreviousEntries.has(candidate) && areSameMessageEntry(candidate, nextEntry)
      );
      if (!previousEntry) {
        return nextEntry;
      }

      unmatchedPreviousEntries.delete(previousEntry);
      const mergedEntry = mergeSameMessageEntry(previousEntry, nextEntry);
      placementByPreviousEntry.set(previousEntry, mergedEntry);
      return mergedEntry;
    });

    const retainedEntries = [];
    previousEntries.forEach((previousEntry, previousIndex) => {
      if (!unmatchedPreviousEntries.has(previousEntry)) {
        return;
      }

      const retainedEntry = retainDisconnectedEntry(previousEntry, previousIndex);
      const duplicateIndex = orderedEntries.findIndex((entry) =>
        areSameMessageEntry(retainedEntry, entry)
      );
      if (duplicateIndex >= 0) {
        const mergedEntry = mergeSameMessageEntry(retainedEntry, orderedEntries[duplicateIndex]);
        orderedEntries[duplicateIndex] = mergedEntry;
        placementByPreviousEntry.set(previousEntry, mergedEntry);
        return;
      }

      placementByPreviousEntry.set(previousEntry, retainedEntry);
      retainedEntries.push({ previousEntry, previousIndex, retainedEntry });
    });

    retainedEntries.forEach(({ previousEntry, previousIndex, retainedEntry }) => {
      const insertionIndex = findRetainedEntryInsertionIndex(
        orderedEntries,
        retainedEntry,
        previousEntries,
        previousIndex,
        placementByPreviousEntry
      );
      orderedEntries.splice(insertionIndex, 0, retainedEntry);
      placementByPreviousEntry.set(previousEntry, retainedEntry);
    });

    return orderedEntries;
  }

  function retainDisconnectedEntry(currentEntry, previousIndex) {
    if (currentEntry.isPlaceholder) {
      const hydratedEntry = hydratePlaceholderEntry(currentEntry, previousIndex);
      if (hydratedEntry && !hydratedEntry.isPlaceholder) {
        return hydratedEntry;
      }

      return {
        ...currentEntry,
        isStalePlaceholder: !currentEntry.element?.isConnected
      };
    }

    const currentElement = currentEntry.element?.isConnected
      ? currentEntry.element
      : findCurrentElementForEntry(currentEntry);
    return {
      ...currentEntry,
      element: currentElement || currentEntry.element,
      turnOrder:
        (currentElement ? getContainerConversationTurnOrder(currentElement) : null) ??
        getEntryConversationTurnOrder(currentEntry),
      isStalePlaceholder: !currentElement
    };
  }

  function findRetainedEntryInsertionIndex(
    orderedEntries,
    retainedEntry,
    previousEntries,
    previousIndex,
    placementByPreviousEntry
  ) {
    const explicitOrder = getEntryConversationTurnOrder(retainedEntry);
    if (explicitOrder !== null) {
      const firstLaterIndex = orderedEntries.findIndex((entry) => {
        const order = getEntryConversationTurnOrder(entry);
        return order !== null && order > explicitOrder;
      });
      if (firstLaterIndex >= 0) {
        return firstLaterIndex;
      }

      for (let index = orderedEntries.length - 1; index >= 0; index -= 1) {
        const order = getEntryConversationTurnOrder(orderedEntries[index]);
        if (order !== null && order < explicitOrder) {
          return index + 1;
        }
      }
    }

    for (let index = previousIndex - 1; index >= 0; index -= 1) {
      const previousPlacement = placementByPreviousEntry.get(previousEntries[index]);
      const placementIndex = orderedEntries.indexOf(previousPlacement);
      if (placementIndex >= 0) {
        return placementIndex + 1;
      }
    }

    for (let index = previousIndex + 1; index < previousEntries.length; index += 1) {
      const nextPlacement = placementByPreviousEntry.get(previousEntries[index]);
      const placementIndex = orderedEntries.indexOf(nextPlacement);
      if (placementIndex >= 0) {
        return placementIndex;
      }
    }

    return orderedEntries.length;
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
        turnOrder:
          getEntryConversationTurnOrder(nextEntry) ?? getEntryConversationTurnOrder(currentEntry),
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
        turnOrder:
          getContainerConversationTurnOrder(element) ?? getEntryConversationTurnOrder(entry),
        fullText: parts.fullText,
        displayText: parts.displayText,
        titleText: parts.fullText,
        text: parts.fullText,
        quote: parts.quoteText,
        quoteLabel: parts.quoteLabel,
        label: parts.displayText,
        searchText: parts.searchText,
        hasCodeBlock: Boolean(element.querySelector("pre, code")),
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
      currentFilter = "all";
      searchQuery = "";
      searchInput.value = "";
      void switchConversationState(getConversationStorageKey());
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

    refresh(false);
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

  function applyTranslations() {
    navigatorElement.setAttribute("aria-label", i18n.t("navigatorLabel"));
    markElement.textContent = i18n.getLocale() === "zh-CN" ? "问" : "Q";
    nameElement.textContent = i18n.t("navigatorName");
    hintElement.textContent = i18n.t("clickToJump");
    searchInput.placeholder = i18n.t("searchPlaceholder");
    searchInput.setAttribute("aria-label", i18n.t("searchPlaceholder"));
    clearSearchButton.title = i18n.t("clearSearch");
    clearSearchButton.setAttribute("aria-label", clearSearchButton.title);
    filterRow.setAttribute("aria-label", i18n.t("navigatorName"));
    labelFilterRow.setAttribute("aria-label", i18n.t("labelFilterAria"));
    autoToggle.setAttribute("aria-label", i18n.t("toggleAutoClassification"));
    autoToggle.parentElement.title = i18n.t("toggleAutoClassification");
    autoLabel.textContent = i18n.t("autoClassification");
    batchToggle.textContent = i18n.t(batchMode ? "exitBatchMode" : "batchMode");
    managerToggle.textContent = i18n.t("manageLabels");
    managerTitle.textContent = i18n.t("labelManagerTitle");
    managerHint.textContent = i18n.t("labelManagerHint");
    labelManager.setAttribute("aria-label", i18n.t("labelManagerTitle"));
    managerClose.setAttribute("aria-label", i18n.t("closeLabelManager"));
    labelCreateInput.placeholder = i18n.t("labelNamePlaceholder");
    labelCreateButton.textContent = i18n.t("createLabel");
    batchToolbar.setAttribute("aria-label", i18n.t("batchMode"));
    selectVisibleButton.textContent = i18n.t("selectVisible");
    batchAddButton.textContent = i18n.t("batchAdd");
    batchRemoveButton.textContent = i18n.t("batchRemove");
    batchCancelButton.textContent = i18n.t("batchCancel");
    dragGrip.title = i18n.t("drag");
    refreshButton.title = i18n.t("refresh");
    refreshButton.setAttribute("aria-label", refreshButton.title);
    resizeHandle.title = i18n.t("resize");
    languageSelect.setAttribute("aria-label", i18n.t("languageLabel"));

    const optionLabels = {
      auto: i18n.t("languageAuto"),
      "zh-CN": i18n.t("languageChinese"),
      en: i18n.t("languageEnglish")
    };
    Array.from(languageSelect.options).forEach((option) => {
      option.textContent = optionLabels[option.value] || option.value;
    });
    languageSelect.value = i18n.getPreference();
    autoToggle.checked = autoClassificationEnabled;
    autoToggle.title = i18n.t(
      autoClassificationEnabled ? "autoClassificationHintOn" : "autoClassificationHintOff"
    );
    setCollapsed(collapsed);
    render();
  }

  function setCollapsed(nextCollapsed) {
    collapsed = nextCollapsed;
    navigatorElement.classList.toggle("is-collapsed", collapsed);
    toggleButton.textContent = collapsed ? "‹" : "›";
    toggleButton.title = i18n.t(collapsed ? "expand" : "collapse");
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
    selectedEntryKeys.clear();
    batchMode = false;
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

  function toggleFavorite(index) {
    const entry = entries[index];
    if (!entry) {
      return;
    }

    entry.favorite = !entry.favorite;
    updateEntryOrganizerRecord(entry, { favorite: entry.favorite });
    render();
  }

  function setCategoryOverride(index, categoryOverride) {
    const entry = entries[index];
    if (!entry) {
      return;
    }

    entry.categoryOverride = organizer.isCategory(categoryOverride) ? categoryOverride : "";
    entry.category = entry.categoryOverride || entry.autoCategory;
    updateEntryOrganizerRecord(entry, { categoryOverride: entry.categoryOverride });
    render();
  }

  function setQuestionLabel(index, labelId, checked) {
    const entry = entries[index];
    if (!entry || !getLabelById(labelId)) {
      return;
    }

    const nextIds = new Set(entry.labelIds || []);
    if (checked) {
      nextIds.add(labelId);
    } else {
      nextIds.delete(labelId);
    }
    entry.labelIds = Array.from(nextIds);
    updateEntryOrganizerRecord(entry, { labelIds: entry.labelIds });
    render();
  }

  function toggleBatchEntry(index, checked) {
    const entry = entries[index];
    if (!entry) {
      return;
    }
    if (checked) {
      selectedEntryKeys.add(entry.key);
    } else {
      selectedEntryKeys.delete(entry.key);
    }
    render();
  }

  function applyBatchLabel(shouldAdd) {
    const labelId = batchLabelSelect.value;
    if (!getLabelById(labelId) || selectedEntryKeys.size === 0) {
      return;
    }

    entries.forEach((entry) => {
      if (!selectedEntryKeys.has(entry.key)) {
        return;
      }
      const nextIds = new Set(entry.labelIds || []);
      if (shouldAdd) {
        nextIds.add(labelId);
      } else {
        nextIds.delete(labelId);
      }
      entry.labelIds = Array.from(nextIds);
      updateEntryOrganizerRecord(entry, { labelIds: entry.labelIds });
    });
    selectedEntryKeys.clear();
    batchMode = false;
    render();
  }

  async function createCustomLabel() {
    const result = await settings.createLabel(labelCreateInput.value);
    if (!result.ok) {
      setManagerMessage(getLabelErrorMessage(result.reason), true);
      return;
    }
    labelCreateInput.value = "";
    setManagerMessage("");
  }

  async function renameCustomLabel(row) {
    const labelId = row?.dataset.labelId || "";
    const input = row?.querySelector(".manager-label-input");
    const result = await settings.renameLabel(labelId, input?.value || "");
    if (!result.ok) {
      setManagerMessage(getLabelErrorMessage(result.reason), true);
      return;
    }
    setManagerMessage("");
  }

  async function deleteCustomLabel(labelId) {
    const labelDefinition = getLabelById(labelId);
    if (!labelDefinition) {
      setManagerMessage(i18n.t("labelMissing"), true);
      return;
    }
    if (!window.confirm(i18n.t("labelDeleteConfirm", { name: labelDefinition.name }))) {
      return;
    }
    const result = await settings.deleteLabel(labelId);
    if (!result.ok) {
      setManagerMessage(getLabelErrorMessage(result.reason), true);
    }
  }

  function handleSettingsChange(snapshot) {
    const previousLabelIds = new Set(customLabels.map((label) => label.id));
    autoClassificationEnabled = snapshot.autoClassificationEnabled !== false;
    customLabels = snapshot.labels || [];
    const currentLabelIds = new Set(customLabels.map((label) => label.id));
    const removedLabelIds = Array.from(previousLabelIds).filter((id) => !currentLabelIds.has(id));

    if (removedLabelIds.length) {
      Object.values(organizerState.items).forEach((record) => {
        if (Array.isArray(record.labelIds)) {
          record.labelIds = record.labelIds.filter((id) => currentLabelIds.has(id));
        }
      });
      scheduleOrganizerStateSave();
    }

    entries = entries.map(applyOrganizerMetadata);
    if (!autoClassificationEnabled && organizer.isCategory(currentFilter)) {
      currentFilter = "all";
    }
    const activeLabelId = getActiveLabelId();
    if (activeLabelId && !currentLabelIds.has(activeLabelId)) {
      currentFilter = "all";
    }
    render();
  }

  listElement.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const favoriteButton = target?.closest(".favorite-button");
    if (favoriteButton) {
      toggleFavorite(Number(favoriteButton.dataset.index));
      return;
    }

    const mainButton = target?.closest(".item-main");
    if (mainButton) {
      const index = Number(mainButton.dataset.index);
      if (batchMode) {
        const entry = entries[index];
        toggleBatchEntry(index, !selectedEntryKeys.has(entry?.key));
      } else {
        jumpToEntry(index);
      }
    }
  });

  listElement.addEventListener("change", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.matches(".category-select")) {
      setCategoryOverride(Number(target.dataset.index), target.value);
      return;
    }
    if (target?.matches("[data-action='question-label']")) {
      setQuestionLabel(Number(target.dataset.index), target.dataset.labelId, target.checked);
      return;
    }
    if (target?.matches("[data-action='batch-select']")) {
      toggleBatchEntry(Number(target.dataset.index), target.checked);
    }
  });

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    render();
  });

  clearSearchButton.addEventListener("click", () => {
    searchInput.value = "";
    searchQuery = "";
    searchInput.focus();
    render();
  });

  filterRow.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest(".filter-chip");
    if (!button) {
      return;
    }

    const nextFilter = button.dataset.filter || "all";
    currentFilter =
      nextFilter === "all" || nextFilter === "favorites" || organizer.isCategory(nextFilter)
        ? nextFilter
        : "all";
    render();
  });

  labelFilterRow.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest("button");
    if (!button) {
      return;
    }
    if (button.dataset.action === "expand-labels") {
      labelsExpanded = !labelsExpanded;
      render();
      return;
    }
    const labelId = String(button.dataset.filter || "").replace(/^label:/, "");
    currentFilter = getLabelById(labelId) ? `label:${labelId}` : "all";
    render();
  });

  autoToggle.addEventListener("change", () => {
    void settings.setAutoClassificationEnabled(autoToggle.checked);
  });

  managerToggle.addEventListener("click", () => {
    labelManagerOpen = !labelManagerOpen;
    setManagerMessage("");
    render();
    if (labelManagerOpen) {
      labelCreateInput.focus();
    }
  });

  managerClose.addEventListener("click", () => {
    labelManagerOpen = false;
    setManagerMessage("");
    render();
  });

  labelCreateButton.addEventListener("click", () => {
    void createCustomLabel();
  });

  labelCreateInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void createCustomLabel();
    }
  });

  managerLabels.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const row = target?.closest(".manager-label-row");
    if (target?.closest(".label-save")) {
      void renameCustomLabel(row);
      return;
    }
    if (target?.closest(".label-delete")) {
      void deleteCustomLabel(row?.dataset.labelId || "");
    }
  });

  managerLabels.addEventListener("keydown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (event.key === "Enter" && target?.matches(".manager-label-input")) {
      event.preventDefault();
      void renameCustomLabel(target.closest(".manager-label-row"));
    }
  });

  batchToggle.addEventListener("click", () => {
    batchMode = !batchMode;
    selectedEntryKeys.clear();
    render();
  });

  selectVisibleButton.addEventListener("click", () => {
    getVisibleEntries().forEach((entry) => selectedEntryKeys.add(entry.key));
    render();
  });

  batchAddButton.addEventListener("click", () => applyBatchLabel(true));
  batchRemoveButton.addEventListener("click", () => applyBatchLabel(false));
  batchCancelButton.addEventListener("click", () => {
    selectedEntryKeys.clear();
    batchMode = false;
    render();
  });

  languageSelect.addEventListener("change", () => {
    void i18n.setPreference(languageSelect.value);
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
  languageUnsubscribe = i18n.subscribe(() => applyTranslations());
  settingsUnsubscribe = settings.subscribe(handleSettingsChange);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "CQN_STATUS") {
      refresh(true);
      sendResponse({
        enabled: true,
        count: entries.length,
        favoriteCount: getFavoriteCount(),
        categoryCounts: getCategoryCounts(),
        autoClassificationEnabled,
        customLabelCount: customLabels.length,
        labelCounts: getCurrentLabelCounts(),
        locale: i18n.getLocale(),
        collapsed
      });
      return;
    }

    if (message?.type === "CQN_REFRESH") {
      refresh(true);
      sendResponse({
        enabled: true,
        count: entries.length,
        favoriteCount: getFavoriteCount(),
        categoryCounts: getCategoryCounts(),
        autoClassificationEnabled,
        customLabelCount: customLabels.length,
        labelCounts: getCurrentLabelCounts(),
        locale: i18n.getLocale()
      });
    }
  });

  window[GLOBAL_KEY] = {
    refresh: () => refresh(true),
    destroy: () => {
      observer.disconnect();
      window.clearTimeout(refreshTimer);
      window.clearInterval(periodicRefreshTimer);
      languageUnsubscribe?.();
      settingsUnsubscribe?.();
      window.removeEventListener("popstate", handleConversationChange);
      window.removeEventListener("hashchange", handleConversationChange);
      window.removeEventListener("resize", handleViewportResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      host.remove();
      delete window[GLOBAL_KEY];
    }
  };

  await loadOrganizerState();
  languageSelect.value = i18n.getPreference();
  autoToggle.checked = autoClassificationEnabled;
  setCollapsed(false);
  refresh(true);
  startPeriodicRefresh();
})();
