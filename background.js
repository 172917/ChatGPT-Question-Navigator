chrome.runtime.onInstalled.addListener(() => {
  console.info("[ChatGPT Question Navigator] Open-source extension installed.");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CQN_OPEN_SOURCE_STATUS") {
    sendResponse({
      ok: true,
      authorized: true,
      mode: "open-source"
    });
    return;
  }

  sendResponse({
    ok: false,
    error: "Unknown message."
  });
});
