const statusDot = document.getElementById("statusDot");
const statusTitle = document.getElementById("statusTitle");
const statusText = document.getElementById("statusText");
const refreshButton = document.getElementById("refreshButton");
const markElement = document.querySelector(".mark");
const eyebrowElement = document.getElementById("eyebrow");
const pageTitleElement = document.getElementById("pageTitle");
const localTitleElement = document.getElementById("localTitle");
const localBadgeElement = document.getElementById("localBadge");
const localTextElement = document.getElementById("localText");
const languageLabelElement = document.getElementById("languageLabel");
const languageSelect = document.getElementById("languageSelect");
const autoClassificationToggle = document.getElementById("autoClassificationToggle");
const autoTitleElement = document.getElementById("autoTitle");
const autoTextElement = document.getElementById("autoText");
const labelCountElement = document.getElementById("labelCount");
const noteElement = document.getElementById("note");
const i18n = globalThis.CQN_I18N;
const settings = globalThis.CQN_SETTINGS;

let activeTabId = null;
let activeTabIsChatGPT = false;

function isChatGPTUrl(url) {
  return /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(url || "");
}

function setStatus(kind, title, text) {
  statusDot.classList.toggle("is-on", kind === "on");
  statusDot.classList.toggle("is-warning", kind === "warning");
  statusTitle.textContent = title;
  statusText.textContent = text;
}

function applyTranslations() {
  document.documentElement.lang = i18n.getLocale();
  document.title = i18n.t("popupTitle");
  markElement.textContent = i18n.getLocale() === "zh-CN" ? "问" : "Q";
  eyebrowElement.textContent = i18n.t("popupEyebrow");
  pageTitleElement.textContent = i18n.t("popupTitle");
  localTitleElement.textContent = i18n.t("popupLocalTitle");
  localBadgeElement.textContent = i18n.t("popupLocalBadge");
  localTextElement.textContent = i18n.t("popupLocalText");
  languageLabelElement.textContent = i18n.t("languageLabel");
  const autoEnabled = settings.getAutoClassificationEnabled();
  autoClassificationToggle.checked = autoEnabled;
  autoClassificationToggle.setAttribute("aria-label", i18n.t("toggleAutoClassification"));
  autoTitleElement.textContent = i18n.t("popupAutoTitle");
  autoTextElement.textContent = i18n.t(autoEnabled ? "popupAutoTextOn" : "popupAutoTextOff");
  labelCountElement.textContent = i18n.t("popupCustomLabels", {
    count: settings.getLabels().length
  });
  refreshButton.textContent = i18n.t("popupRefreshButton");
  noteElement.textContent = i18n.t("popupNote");

  const optionLabels = {
    auto: i18n.t("languageAuto"),
    "zh-CN": i18n.t("languageChinese"),
    en: i18n.t("languageEnglish")
  };
  Array.from(languageSelect.options).forEach((option) => {
    option.textContent = optionLabels[option.value] || option.value;
  });
  languageSelect.value = i18n.getPreference();
}

function sendToActiveTab(message) {
  if (!activeTabId) {
    return Promise.reject(new Error(i18n.t("popupNoTab")));
  }

  return chrome.tabs.sendMessage(activeTabId, message);
}

async function loadActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error(i18n.t("popupCannotReadTab"));
  }

  activeTabId = tab.id;
  activeTabIsChatGPT = isChatGPTUrl(tab.url);
}

async function loadPageStatus() {
  await loadActiveTab();

  if (!activeTabIsChatGPT) {
    refreshButton.disabled = true;
    setStatus(
      "warning",
      i18n.t("popupUnsupportedTitle"),
      i18n.t("popupUnsupportedText")
    );
    return;
  }

  try {
    const response = await sendToActiveTab({ type: "CQN_STATUS" });
    const count = Number(response?.count || 0);
    const favorites = Number(response?.favoriteCount || 0);
    refreshButton.disabled = false;
    setStatus(
      "on",
      i18n.t("popupEnabledTitle"),
      count > 0
        ? i18n.t("popupEnabledCount", { count, favorites })
        : i18n.t("popupEnabledEmpty")
    );
  } catch {
    refreshButton.disabled = true;
    setStatus(
      "warning",
      i18n.t("popupNeedsRefreshTitle"),
      i18n.t("popupNeedsRefreshText")
    );
  }
}

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  setStatus(
    "warning",
    i18n.t("popupRefreshingTitle"),
    i18n.t("popupRefreshingText")
  );

  try {
    const response = await sendToActiveTab({ type: "CQN_REFRESH" });
    const count = Number(response?.count || 0);
    const favorites = Number(response?.favoriteCount || 0);
    setStatus(
      "on",
      i18n.t("popupRefreshedTitle"),
      count > 0
        ? i18n.t("popupEnabledCount", { count, favorites })
        : i18n.t("popupEnabledEmpty")
    );
  } catch {
    setStatus(
      "warning",
      i18n.t("popupRefreshFailedTitle"),
      i18n.t("popupRefreshFailedText")
    );
  } finally {
    refreshButton.disabled = !activeTabIsChatGPT;
  }
});

languageSelect.addEventListener("change", async () => {
  await i18n.setPreference(languageSelect.value);
});

autoClassificationToggle.addEventListener("change", async () => {
  await settings.setAutoClassificationEnabled(autoClassificationToggle.checked);
});

i18n.subscribe(() => {
  applyTranslations();
  void loadPageStatus();
});

settings.subscribe(() => {
  applyTranslations();
  void loadPageStatus();
});

async function initializePopup() {
  await Promise.all([i18n.initialize(), settings.initialize()]);
  applyTranslations();
  setStatus("warning", i18n.t("popupChecking"), i18n.t("popupPleaseWait"));

  try {
    await loadPageStatus();
  } catch (error) {
    refreshButton.disabled = true;
    setStatus("warning", i18n.t("popupReadFailed"), error.message);
  }
}

void initializePopup();
