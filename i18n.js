(function initCqnI18n(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.CQN_I18N = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCqnI18n() {
  const STORAGE_KEY = "cqn-language-preference-v1";
  const DEFAULT_PREFERENCE = "auto";
  const SUPPORTED_LOCALES = ["zh-CN", "en"];

  const dictionaries = {
    "zh-CN": {
      navigatorLabel: "ChatGPT 问题导航",
      navigatorName: "问题导航",
      scanning: "正在扫描当前对话...",
      questionCount: "{count} 个问题",
      questionFavoriteCount: "{count} 个问题 · {favorites} 个收藏",
      noQuestionsCount: "当前对话还没有检测到你的问题",
      openConversationEmpty: "打开一个 ChatGPT 对话后，这里会列出你发出的每个问题。",
      noResults: "没有找到匹配的问题。",
      noFavorites: "当前对话还没有收藏的问题。",
      noCategoryResults: "这个分类暂时没有问题。",
      clickToJump: "点击问题跳转到原位置",
      refresh: "刷新列表",
      collapse: "折叠导航",
      expand: "展开导航",
      drag: "拖动导航栏",
      resize: "拖动缩放导航栏",
      searchPlaceholder: "搜索问题或引用…",
      clearSearch: "清除搜索",
      filterAll: "全部",
      filterFavorites: "收藏",
      categoryCode: "代码",
      categorySolution: "方案",
      categoryResearch: "资料",
      categoryTodo: "待办",
      categoryOther: "其他",
      groupCount: "{count}",
      quotePrefix: "引用：",
      addFavorite: "收藏这个问题",
      removeFavorite: "取消收藏",
      favoriteSymbol: "★",
      unfavoriteSymbol: "☆",
      categoryLabel: "修改问题分类",
      automaticCategory: "自动 · {category}",
      autoClassification: "自动分类",
      autoClassificationOn: "已开启",
      autoClassificationOff: "已关闭",
      autoClassificationHintOn: "按代码、方案、资料、待办和其他自动分组",
      autoClassificationHintOff: "已按提问顺序平铺；标签、收藏和搜索仍可使用",
      toggleAutoClassification: "切换自动分类",
      manageLabels: "管理标签",
      customLabels: "自定义标签",
      labelManagerTitle: "全局标签",
      labelManagerHint: "标签可跨对话复用，问题关联按会话保存。",
      labelNamePlaceholder: "输入标签名称",
      createLabel: "新建",
      renameLabel: "重命名标签",
      saveLabel: "保存",
      deleteLabel: "删除标签",
      closeLabelManager: "关闭标签管理器",
      noCustomLabels: "还没有自定义标签。",
      editQuestionLabels: "编辑问题标签",
      questionLabels: "问题标签",
      labelCountMore: "+{count}",
      expandLabels: "展开标签筛选",
      collapseLabels: "收起标签筛选",
      batchMode: "批量标记",
      exitBatchMode: "退出批量模式",
      selectedCount: "已选 {count} 项",
      selectVisible: "全选当前结果",
      batchLabelPlaceholder: "选择标签",
      batchAdd: "添加",
      batchRemove: "移除",
      batchCancel: "取消",
      selectQuestion: "选择这个问题",
      labelRequired: "请输入标签名称。",
      labelTooLong: "标签名称不能超过 20 个字符。",
      labelDuplicate: "已经有同名标签。",
      labelLimit: "最多可以创建 30 个标签。",
      labelMissing: "这个标签已不存在。",
      labelDeleteConfirm: "删除标签“{name}”？它会从所有会话的问题中移除。",
      labelOperationFailed: "标签操作失败，请重试。",
      labelFilterAria: "自定义标签筛选",
      noLabelResults: "这个标签下暂时没有问题。",
      languageLabel: "界面语言",
      languageAuto: "自动",
      languageChinese: "简体中文",
      languageEnglish: "English",
      unloadedQuestion: "第 {index} 个问题（内容尚未加载）",
      unavailableQuestion: "这个问题暂时无法定位，请等待对话加载完成后重试。",
      popupTitle: "问题导航",
      popupEyebrow: "ChatGPT Navigator",
      popupChecking: "正在检查当前页面...",
      popupPleaseWait: "请稍候。",
      popupUnsupportedTitle: "当前页面不支持",
      popupUnsupportedText: "请打开 chatgpt.com 或 chat.openai.com 的对话页面后再使用。",
      popupEnabledTitle: "已在 ChatGPT 页面启用",
      popupEnabledCount: "已整理 {count} 个问题，其中 {favorites} 个收藏。",
      popupEnabledEmpty: "导航栏已启用，当前对话还没有检测到你的问题。",
      popupNeedsRefreshTitle: "需要刷新 ChatGPT 页面",
      popupNeedsRefreshText: "扩展脚本还没有连接到当前页面。刷新 ChatGPT 标签页后再试。",
      popupRefreshingTitle: "正在刷新",
      popupRefreshingText: "正在重新扫描当前 ChatGPT 对话。",
      popupRefreshedTitle: "问题列表已刷新",
      popupRefreshFailedTitle: "刷新失败",
      popupRefreshFailedText: "请刷新 ChatGPT 页面后再试。",
      popupReadFailed: "读取失败",
      popupNoTab: "没有可用的当前标签页。",
      popupCannotReadTab: "无法读取当前标签页。",
      popupLocalTitle: "本地智能整理",
      popupLocalBadge: "本地运行",
      popupLocalText: "自动分类、搜索和收藏都在本机完成；不会上传或远程保存聊天内容。",
      popupAutoTitle: "自动分类",
      popupAutoTextOn: "新问题会按内容自动分组。",
      popupAutoTextOff: "问题会按提问顺序平铺显示。",
      popupCustomLabels: "{count} 个全局标签",
      popupRefreshButton: "刷新问题列表",
      popupNote: "仅在 chatgpt.com 和 chat.openai.com 生效。语言设置会应用到所有 ChatGPT 会话。"
    },
    en: {
      navigatorLabel: "ChatGPT Question Navigator",
      navigatorName: "Question Navigator",
      scanning: "Scanning this conversation...",
      questionCount: "{count} questions",
      questionFavoriteCount: "{count} questions · {favorites} favorites",
      noQuestionsCount: "No questions detected in this conversation",
      openConversationEmpty: "Open a ChatGPT conversation and your questions will appear here.",
      noResults: "No matching questions found.",
      noFavorites: "No favorites in this conversation yet.",
      noCategoryResults: "No questions in this category yet.",
      clickToJump: "Select a question to jump back",
      refresh: "Refresh list",
      collapse: "Collapse navigator",
      expand: "Expand navigator",
      drag: "Drag navigator",
      resize: "Drag to resize navigator",
      searchPlaceholder: "Search questions or quotes…",
      clearSearch: "Clear search",
      filterAll: "All",
      filterFavorites: "Favorites",
      categoryCode: "Code",
      categorySolution: "Solutions",
      categoryResearch: "Research",
      categoryTodo: "To-dos",
      categoryOther: "Other",
      groupCount: "{count}",
      quotePrefix: "Quote: ",
      addFavorite: "Favorite this question",
      removeFavorite: "Remove from favorites",
      favoriteSymbol: "★",
      unfavoriteSymbol: "☆",
      categoryLabel: "Change question category",
      automaticCategory: "Auto · {category}",
      autoClassification: "Auto categories",
      autoClassificationOn: "On",
      autoClassificationOff: "Off",
      autoClassificationHintOn: "Groups questions into Code, Solutions, Research, To-dos, and Other.",
      autoClassificationHintOff: "Questions are shown chronologically. Labels, favorites, and search still work.",
      toggleAutoClassification: "Toggle automatic classification",
      manageLabels: "Manage labels",
      customLabels: "Custom labels",
      labelManagerTitle: "Global labels",
      labelManagerHint: "Labels are reusable across chats; assignments stay conversation-specific.",
      labelNamePlaceholder: "Enter a label name",
      createLabel: "Create",
      renameLabel: "Rename label",
      saveLabel: "Save",
      deleteLabel: "Delete label",
      closeLabelManager: "Close label manager",
      noCustomLabels: "No custom labels yet.",
      editQuestionLabels: "Edit question labels",
      questionLabels: "Question labels",
      labelCountMore: "+{count}",
      expandLabels: "Expand label filters",
      collapseLabels: "Collapse label filters",
      batchMode: "Batch label",
      exitBatchMode: "Exit batch mode",
      selectedCount: "{count} selected",
      selectVisible: "Select visible",
      batchLabelPlaceholder: "Choose a label",
      batchAdd: "Add",
      batchRemove: "Remove",
      batchCancel: "Cancel",
      selectQuestion: "Select this question",
      labelRequired: "Enter a label name.",
      labelTooLong: "Label names can contain up to 20 characters.",
      labelDuplicate: "A label with this name already exists.",
      labelLimit: "You can create up to 30 labels.",
      labelMissing: "This label no longer exists.",
      labelDeleteConfirm: "Delete “{name}”? It will be removed from questions in every conversation.",
      labelOperationFailed: "The label could not be updated. Try again.",
      labelFilterAria: "Custom label filters",
      noLabelResults: "No questions use this label yet.",
      languageLabel: "Interface language",
      languageAuto: "Auto",
      languageChinese: "简体中文",
      languageEnglish: "English",
      unloadedQuestion: "Question {index} (content not loaded)",
      unavailableQuestion: "This question is not available yet. Wait for the conversation to finish loading and try again.",
      popupTitle: "Question Navigator",
      popupEyebrow: "ChatGPT Navigator",
      popupChecking: "Checking this page...",
      popupPleaseWait: "Please wait.",
      popupUnsupportedTitle: "Page not supported",
      popupUnsupportedText: "Open a conversation on chatgpt.com or chat.openai.com to use the extension.",
      popupEnabledTitle: "Enabled on ChatGPT",
      popupEnabledCount: "Organized {count} questions with {favorites} favorites.",
      popupEnabledEmpty: "The navigator is ready. No questions have been detected yet.",
      popupNeedsRefreshTitle: "Refresh the ChatGPT page",
      popupNeedsRefreshText: "The extension is not connected to this page yet. Refresh the ChatGPT tab and try again.",
      popupRefreshingTitle: "Refreshing",
      popupRefreshingText: "Scanning the current ChatGPT conversation again.",
      popupRefreshedTitle: "Question list refreshed",
      popupRefreshFailedTitle: "Refresh failed",
      popupRefreshFailedText: "Refresh the ChatGPT page and try again.",
      popupReadFailed: "Unable to read page",
      popupNoTab: "There is no active browser tab.",
      popupCannotReadTab: "The active browser tab could not be read.",
      popupLocalTitle: "Local organization",
      popupLocalBadge: "Runs locally",
      popupLocalText: "Automatic categories, search, and favorites run on your device. Chat content is never uploaded or stored remotely.",
      popupAutoTitle: "Automatic classification",
      popupAutoTextOn: "New questions are grouped by content.",
      popupAutoTextOff: "Questions are shown in chronological order.",
      popupCustomLabels: "{count} global labels",
      popupRefreshButton: "Refresh question list",
      popupNote: "Works on chatgpt.com and chat.openai.com. Your language choice applies to every ChatGPT conversation."
    }
  };

  let preference = DEFAULT_PREFERENCE;
  let locale = resolveLocale(preference, getBrowserLanguage());
  let initialized = false;
  let storageListenerAttached = false;
  const listeners = new Set();

  function getBrowserLanguage() {
    try {
      return globalThis.chrome?.i18n?.getUILanguage?.() || globalThis.navigator?.language || "en";
    } catch {
      return "en";
    }
  }

  function normalizePreference(value) {
    return value === "auto" || SUPPORTED_LOCALES.includes(value) ? value : DEFAULT_PREFERENCE;
  }

  function resolveLocale(nextPreference = DEFAULT_PREFERENCE, browserLanguage = "en") {
    const normalizedPreference = normalizePreference(nextPreference);
    if (SUPPORTED_LOCALES.includes(normalizedPreference)) {
      return normalizedPreference;
    }

    return /^zh(?:[-_]|$)/i.test(String(browserLanguage || "")) ? "zh-CN" : "en";
  }

  function format(template, values) {
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) =>
      Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : `{${key}}`
    );
  }

  function t(key, values = {}, requestedLocale = locale) {
    const selected = dictionaries[requestedLocale] || dictionaries.en;
    const fallback = dictionaries.en;
    const template = selected[key] ?? fallback[key] ?? key;
    return format(template, values);
  }

  function emitChange() {
    const state = { preference, locale };
    listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.warn("[ChatGPT Question Navigator] Language listener failed.", error);
      }
    });
  }

  function applyPreference(nextPreference, shouldEmit = true) {
    const normalized = normalizePreference(nextPreference);
    const nextLocale = resolveLocale(normalized, getBrowserLanguage());
    const changed = normalized !== preference || nextLocale !== locale;
    preference = normalized;
    locale = nextLocale;

    if (changed && shouldEmit) {
      emitChange();
    }

    return locale;
  }

  function handleStorageChanged(changes, areaName) {
    if (areaName !== "local" || !changes?.[STORAGE_KEY]) {
      return;
    }

    applyPreference(changes[STORAGE_KEY].newValue);
  }

  function attachStorageListener() {
    if (storageListenerAttached || !globalThis.chrome?.storage?.onChanged?.addListener) {
      return;
    }

    globalThis.chrome.storage.onChanged.addListener(handleStorageChanged);
    storageListenerAttached = true;
  }

  async function initialize() {
    if (initialized) {
      return locale;
    }

    initialized = true;
    attachStorageListener();

    try {
      const result = await globalThis.chrome?.storage?.local?.get?.(STORAGE_KEY);
      applyPreference(result?.[STORAGE_KEY], false);
    } catch {
      applyPreference(DEFAULT_PREFERENCE, false);
    }

    return locale;
  }

  async function setPreference(nextPreference) {
    const normalized = normalizePreference(nextPreference);
    applyPreference(normalized);

    try {
      await globalThis.chrome?.storage?.local?.set?.({ [STORAGE_KEY]: normalized });
    } catch (error) {
      console.warn("[ChatGPT Question Navigator] Language preference could not be saved.", error);
    }

    return locale;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getLocale() {
    return locale;
  }

  function getPreference() {
    return preference;
  }

  function getDictionaryKeys(requestedLocale) {
    return Object.keys(dictionaries[requestedLocale] || {}).sort();
  }

  return {
    STORAGE_KEY,
    SUPPORTED_LOCALES,
    dictionaries,
    getBrowserLanguage,
    getDictionaryKeys,
    getLocale,
    getPreference,
    initialize,
    normalizePreference,
    resolveLocale,
    setPreference,
    subscribe,
    t
  };
});
