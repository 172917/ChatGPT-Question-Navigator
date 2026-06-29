const statusDot = document.getElementById("statusDot");
const statusTitle = document.getElementById("statusTitle");
const statusText = document.getElementById("statusText");
const refreshButton = document.getElementById("refreshButton");

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

function sendToActiveTab(message) {
  if (!activeTabId) {
    return Promise.reject(new Error("没有可用的当前标签页。"));
  }

  return chrome.tabs.sendMessage(activeTabId, message);
}

async function loadActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("无法读取当前标签页。");
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
      "当前页面不支持",
      "请打开 chatgpt.com 或 chat.openai.com 的对话页面后再使用。"
    );
    return;
  }

  try {
    const response = await sendToActiveTab({ type: "CQN_STATUS" });
    const count = Number(response?.count || 0);
    refreshButton.disabled = false;
    setStatus(
      "on",
      "已在 ChatGPT 页面启用",
      count > 0
        ? `右侧导航栏已检测到 ${count} 个你的问题。`
        : "右侧导航栏已启用，当前对话还没有检测到你的问题。"
    );
  } catch {
    refreshButton.disabled = true;
    setStatus(
      "warning",
      "需要刷新 ChatGPT 页面",
      "扩展脚本还没有连接到当前页面。刷新 ChatGPT 标签页后再试。"
    );
  }
}

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  setStatus("warning", "正在刷新", "正在重新扫描当前 ChatGPT 对话。");

  try {
    const response = await sendToActiveTab({ type: "CQN_REFRESH" });
    const count = Number(response?.count || 0);
    setStatus(
      "on",
      "问题列表已刷新",
      count > 0 ? `当前检测到 ${count} 个你的问题。` : "当前对话还没有检测到你的问题。"
    );
  } catch {
    setStatus("warning", "刷新失败", "请刷新 ChatGPT 页面后再试。");
  } finally {
    refreshButton.disabled = !activeTabIsChatGPT;
  }
});

loadPageStatus().catch((error) => {
  refreshButton.disabled = true;
  setStatus("warning", "读取失败", error.message);
});
