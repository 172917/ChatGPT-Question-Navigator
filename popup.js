const statusDot = document.getElementById("statusDot");
const statusTitle = document.getElementById("statusTitle");
const statusText = document.getElementById("statusText");
const licenseBadge = document.getElementById("licenseBadge");
const machineCodeInput = document.getElementById("machineCode");
const copyMachineButton = document.getElementById("copyMachineButton");
const activationInput = document.getElementById("activationInput");
const activateButton = document.getElementById("activateButton");
const deactivateButton = document.getElementById("deactivateButton");
const licenseHint = document.getElementById("licenseHint");
const refreshButton = document.getElementById("refreshButton");

let activeTabId = null;
let activeTabIsChatGPT = false;
let licenseStatus = null;

function isChatGPTUrl(url) {
  return /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(url || "");
}

function setStatus(kind, title, text) {
  statusDot.classList.toggle("is-on", kind === "on");
  statusDot.classList.toggle("is-warning", kind === "warning");
  statusTitle.textContent = title;
  statusText.textContent = text;
}

function setLicenseBadge(kind, text) {
  licenseBadge.classList.toggle("is-on", kind === "on");
  licenseBadge.classList.toggle("is-warning", kind === "warning");
  licenseBadge.textContent = text;
}

function sendToActiveTab(message) {
  if (!activeTabId) {
    return Promise.reject(new Error("没有可用的当前标签页。"));
  }

  return chrome.tabs.sendMessage(activeTabId, message);
}

function sendToBackground(message) {
  return chrome.runtime.sendMessage(message);
}

function formatRemainingTrialTime(remainingHours) {
  if (remainingHours >= 24) {
    return `${Math.ceil(remainingHours / 24)} 天`;
  }

  return `${remainingHours} 小时`;
}

function renderLicense(status) {
  licenseStatus = status || {};
  const machineCode = licenseStatus.machineCode || "";
  const authorized = Boolean(licenseStatus.authorized);
  const mode = licenseStatus.mode || "";
  const isLicensed = authorized && mode === "license";
  const isTrial = authorized && mode === "trial";

  machineCodeInput.value = machineCode || "机器码生成失败";
  activationInput.disabled = isLicensed;
  activateButton.disabled = isLicensed;
  deactivateButton.hidden = !isLicensed;

  if (isLicensed) {
    setLicenseBadge("on", "已激活");
    activationInput.value = "";
    activationInput.placeholder = "本机已激活";
    licenseHint.textContent = `永久授权已绑定到本机。签发时间：${licenseStatus.license?.issuedAt || "未知"}`;
    return;
  }

  if (isTrial) {
    const remainingHours = Number(licenseStatus.trial?.remainingHours || 0);
    setLicenseBadge("on", "试用中");
    activationInput.placeholder = "可提前粘贴激活码转为永久授权";
    licenseHint.textContent =
      remainingHours > 0
        ? `一周免费试用还剩约 ${formatRemainingTrialTime(remainingHours)}。试用结束后需要激活码继续使用。`
        : "免费试用即将结束。建议现在输入激活码。";
    return;
  }

  setLicenseBadge("warning", "未激活");
  activationInput.placeholder = "粘贴你生成的本机激活码";
  licenseHint.textContent = licenseStatus.reason || "把机器码发给作者，拿到激活码后粘贴到这里。";
}

async function loadLicenseStatus() {
  const response = await sendToBackground({ type: "CQN_LICENSE_STATUS" });
  renderLicense(response);
  return response;
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
  const status = await loadLicenseStatus();

  if (!status?.authorized) {
    refreshButton.disabled = true;
    setStatus("warning", "试用已结束", "请复制机器码并输入对应激活码。激活后刷新 ChatGPT 页面即可使用。");
    return;
  }

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
    const statusTitleText = status.mode === "trial" ? "免费试用中" : "已在 ChatGPT 页面启用";
    refreshButton.disabled = false;
    setStatus(
      "on",
      statusTitleText,
      count > 0
        ? `右侧导航栏已检测到 ${count} 个你的问题。`
        : "右侧导航栏已启用，当前对话还没有检测到你的问题。"
    );
  } catch {
    refreshButton.disabled = true;
    setStatus(
      "warning",
      "需要刷新 ChatGPT 页面",
      "授权已生效，但扩展脚本还没有连接到当前页面。刷新 ChatGPT 标签页后再试。"
    );
  }
}

copyMachineButton.addEventListener("click", async () => {
  const machineCode = licenseStatus?.machineCode || machineCodeInput.value;
  if (!machineCode) {
    return;
  }

  copyMachineButton.disabled = true;
  try {
    await navigator.clipboard.writeText(machineCode);
    copyMachineButton.textContent = "已复制";
  } catch {
    machineCodeInput.select();
    document.execCommand("copy");
    copyMachineButton.textContent = "已复制";
  } finally {
    window.setTimeout(() => {
      copyMachineButton.textContent = "复制";
      copyMachineButton.disabled = false;
    }, 1200);
  }
});

activateButton.addEventListener("click", async () => {
  const activationCode = activationInput.value.trim();
  if (!activationCode) {
    setStatus("warning", "缺少激活码", "请先粘贴当前机器码对应的激活码。");
    return;
  }

  activateButton.disabled = true;
  setStatus("warning", "正在激活", "正在验证本机激活码。");

  try {
    const response = await sendToBackground({
      type: "CQN_LICENSE_ACTIVATE",
      activationCode
    });

    renderLicense(response);

    if (!response?.authorized) {
      setStatus("warning", "激活失败", response?.error || response?.reason || "激活码无法通过验证。");
      activateButton.disabled = false;
      return;
    }

    setStatus("on", "激活成功", "请刷新 ChatGPT 页面，右侧问题导航栏会自动启用。");
    refreshButton.disabled = !activeTabIsChatGPT;
  } catch (error) {
    setStatus("warning", "激活失败", error?.message || "授权模块没有响应。");
    activateButton.disabled = false;
  }
});

deactivateButton.addEventListener("click", async () => {
  deactivateButton.disabled = true;
  setStatus("warning", "正在解绑", "正在清除本机授权记录。");

  try {
    const response = await sendToBackground({ type: "CQN_LICENSE_DEACTIVATE" });
    renderLicense(response);
    refreshButton.disabled = !response?.authorized || !activeTabIsChatGPT;
    setStatus(
      response?.authorized ? "on" : "warning",
      "已解绑本机",
      response?.authorized
        ? "永久授权已移除，当前仍可在试用期内使用。"
        : "永久授权已移除，试用已结束后将不能继续使用。"
    );
  } catch (error) {
    setStatus("warning", "解绑失败", error?.message || "授权模块没有响应。");
  } finally {
    deactivateButton.disabled = false;
  }
});

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
    refreshButton.disabled = !licenseStatus?.authorized || !activeTabIsChatGPT;
  }
});

loadPageStatus().catch((error) => {
  refreshButton.disabled = true;
  setStatus("warning", "读取失败", error.message);
});
