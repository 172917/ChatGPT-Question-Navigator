const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const modernHtml = fs.readFileSync(path.join(__dirname, "fixtures/chatgpt-modern.html"), "utf8");
const scripts = ["i18n.js", "organizer.js", "settings.js", "content.js"].map((file) =>
  fs.readFileSync(path.join(__dirname, "..", file), "utf8")
);

async function mount(t, html = modernHtml, stored = {}) {
  const dom = new JSDOM(html, {
    url: "https://chatgpt.com/c/test-conversation-123",
    runScripts: "outside-only",
    pretendToBeVisual: true
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const writes = [];
  const scrollTargets = [];
  window.HTMLElement.prototype.scrollIntoView = function () { scrollTargets.push(this); };
  window.chrome = {
    i18n: { getUILanguage: () => "zh-CN" },
    storage: {
      local: {
        get: async () => stored,
        set: async (value) => { Object.assign(stored, value); writes.push(value); }
      },
      onChanged: { addListener() {} }
    },
    runtime: { onMessage: { addListener() {} } }
  };
  for (const script of scripts) await window.eval(script);
  const shadow = window.document.getElementById("chatgpt-question-navigator").shadowRoot;
  const api = window.__chatgptQuestionNavigator;
  return {
    window, document: window.document, shadow, api, writes, scrollTargets,
    questionTitles: () => [...shadow.querySelectorAll(".item-main .text")].map((e) => e.textContent),
    replies: () => [...shadow.querySelectorAll(".reply-text")].map((e) => e.textContent)
  };
}

test("modern DOM: nested user markers yield one question each and ignore cached routes and replies", async (t) => {
  const app = await mount(t);
  assert.deepEqual(app.questionTitles().sort(), ["请解释这段代码", "请给我一个学习方案"].sort());
  assert.match(app.shadow.querySelector(".count").textContent, /2 个问题/);
  assert.equal(app.replies().length, 2);
  assert.ok(app.replies().some((text) => text.includes("先初始化")));
  assert.ok(app.replies().every((text) => !text.includes("复制")));
});

test("question and reply buttons scroll to their own message, including after DOM replacement", async (t) => {
  const app = await mount(t);
  app.shadow.querySelector('.item-main[data-index="0"]').click();
  assert.equal(app.scrollTargets.at(-1).getAttribute("data-chatgpt-search-message-ids"), "user-one");
  const oldReply = app.document.querySelector('[data-chatgpt-search-message-ids="answer-one answer-one"]');
  const newReply = oldReply.cloneNode(true);
  oldReply.replaceWith(newReply);
  app.shadow.querySelector('.reply-summary[data-index="0"]').click();
  assert.equal(app.scrollTargets.at(-1), newReply);
  assert.ok(newReply.classList.contains("chatgpt-question-navigator-target"));
});

test("late and streaming answers update summaries without changing the question count", async (t) => {
  const app = await mount(t);
  const reply = app.document.querySelector('[data-chatgpt-search-message-ids="answer-two"]');
  reply.remove();
  app.api.refresh();
  assert.equal(app.replies().length, 1);
  reply.querySelector("p").textContent = "这是一条稍后生成的回复。";
  app.document.querySelector('[data-content-search-turn-key="fallback-turn-1"]').append(reply);
  app.api.refresh();
  assert.ok(app.replies().includes("这是一条稍后生成的回复。"));
  reply.querySelector("p").textContent += "现在已生成完成。";
  app.api.refresh();
  assert.ok(app.replies().some((text) => text.includes("生成完成")));
  assert.equal(app.questionTitles().length, 2);
});

test("modern messages reuse saved organizer metadata by stable message ID", async (t) => {
  const app = await mount(t, modernHtml, {
    "cqn-organizer-state-v2:test-conversation-123": {
      version: 2, items: { "message:user-one": { favorite: true, categoryOverride: "code", labelIds: [] } }
    }
  });
  assert.equal(app.shadow.querySelector('.favorite-button[data-index="0"]').getAttribute("aria-pressed"), "true");
});

test("simple mode hides labels, flattens questions, ignores hidden filters, and persists the preference", async (t) => {
  const app = await mount(t);
  const input = app.shadow.querySelector(".search-input");
  input.value = "不存在的搜索结果";
  input.dispatchEvent(new app.window.Event("input"));
  assert.equal(app.questionTitles().length, 0);
  app.shadow.querySelector(".simple-toggle").click();
  assert.equal(app.shadow.querySelector(".navigator").classList.contains("is-compact"), true);
  assert.equal(app.shadow.querySelector(".simple-toggle").getAttribute("aria-pressed"), "true");
  assert.equal(app.shadow.querySelector(".simple-toggle").title, "恢复完整模式");
  assert.deepEqual(app.questionTitles(), ["请解释这段代码", "请给我一个学习方案"]);
  assert.equal(app.shadow.querySelectorAll(".group, .label-pills").length, 0);
  assert.equal(app.replies().length, 2);
  assert.ok(app.writes.some((value) => value["cqn-compact-mode-v1"] === true));
  app.shadow.querySelector(".simple-toggle").click();
  assert.equal(app.questionTitles().length, 0);
  assert.equal(input.value, "不存在的搜索结果");
});

test("simple mode restores after reload and question clicks still jump when full mode has batch selection active", async (t) => {
  const app = await mount(t, modernHtml, { "cqn-compact-mode-v1": true });
  assert.equal(app.shadow.querySelector(".simple-toggle").getAttribute("aria-pressed"), "true");
  app.shadow.querySelector(".simple-toggle").click();
  app.shadow.querySelector(".batch-toggle").click();
  app.shadow.querySelector(".simple-toggle").click();
  app.shadow.querySelector(".item-main").click();
  assert.equal(app.scrollTargets.length, 1);
  assert.equal(app.shadow.querySelectorAll(".selection-checkbox").length, 0);
});

test("conversation changes ignore still-mounted previous messages and reset the list while loading", async (t) => {
  const app = await mount(t);
  app.window.history.pushState({}, "", "/c/next-conversation-456");
  app.api.refresh();
  assert.equal(app.questionTitles().length, 0);
  const next = app.document.createElement("div");
  next.setAttribute("data-chatgpt-conversation-selection-target", "next-conversation-456");
  next.innerHTML = '<div data-turn-key="next-user"><div data-chatgpt-search-unit-key="fallback-turn-0:0:user" data-chatgpt-search-message-ids="next-user"><div data-user-message-bubble="true">新对话的问题</div></div></div>';
  app.document.body.append(next);
  app.api.refresh();
  assert.deepEqual(app.questionTitles(), ["新对话的问题"]);
});

test("duplicate question text keeps distinct IDs and later-prepended history preserves chronological order", async (t) => {
  const app = await mount(t, modernHtml, { "cqn-compact-mode-v1": true });
  const first = app.document.querySelector('[data-turn-key="user-one"]');
  const older = first.cloneNode(true);
  older.setAttribute("data-turn-key", "older-user");
  older.querySelector('[data-chatgpt-search-message-ids="user-one"]').setAttribute("data-chatgpt-search-message-ids", "older-user");
  older.querySelector('[data-chatgpt-search-message-ids="answer-one answer-one"]').remove();
  first.before(older);
  app.api.refresh();
  assert.deepEqual(app.questionTitles(), ["请解释这段代码", "请解释这段代码", "请给我一个学习方案"]);
  app.shadow.querySelector('.item-main[data-index="1"]').click();
  assert.equal(app.scrollTargets.at(-1).getAttribute("data-chatgpt-search-message-ids"), "user-one");
});

test("legacy conversation-turn/data-message-author-role pages still show questions and associated replies", async (t) => {
  const app = await mount(t, `<!doctype html><body>
    <article data-testid="conversation-turn-1" data-turn="user"><h5 class="sr-only">你说：</h5><div data-message-author-role="user" data-message-id="old-user"><div class="whitespace-pre-wrap">旧页面问题</div></div></article>
    <article data-testid="conversation-turn-2" data-turn="assistant"><h6 class="sr-only">ChatGPT said:</h6><div data-message-author-role="assistant" data-message-id="old-answer"><p>旧页面回复</p></div></article>
    </body>`);
  assert.deepEqual(app.questionTitles(), ["旧页面问题"]);
  assert.deepEqual(app.replies(), ["旧页面回复"]);
  app.shadow.querySelector(".reply-summary").click();
  assert.match(app.scrollTargets.at(-1).textContent, /旧页面回复/);
});

test("agent-style replies without assistant search-unit attributes are included", async (t) => {
  const app = await mount(t, `<!doctype html><body><div data-chatgpt-conversation-selection-target="test-conversation-123"><div data-turn-key="agent-user"><h4 class="sr-only">你说：</h4><div data-user-message-bubble="true">请绘制动画</div><div data-markdown-text-style="assistant-message"><p>动画已生成。</p></div></div></div></body>`);
  assert.deepEqual(app.questionTitles(), ["请绘制动画"]);
  assert.deepEqual(app.replies(), ["动画已生成。"]);
});

test("a temporarily empty user bubble retains its question and receives the latest loaded reply", async (t) => {
  const app = await mount(t, modernHtml, { "cqn-compact-mode-v1": true });
  app.document.querySelector('[data-chatgpt-search-message-ids="user-one"] [data-user-message-bubble]').replaceChildren();
  app.document.querySelector('[data-chatgpt-search-message-ids="answer-one answer-one"] p').textContent = "重新加载后的完整回复。";
  app.api.refresh();
  assert.equal(app.questionTitles()[0], "请解释这段代码");
  assert.ok(app.replies()[0].includes("重新加载后的完整回复"));
});

test("newly loaded older replies and edits outside the last three questions refresh their cards", async (t) => {
  const app = await mount(t, modernHtml, { "cqn-compact-mode-v1": true });
  const root = app.document.querySelector('[data-chatgpt-conversation-selection-target="test-conversation-123"]');
  for (let i = 2; i < 6; i += 1) {
    const turn = app.document.createElement("div");
    turn.innerHTML = `<div data-chatgpt-search-unit-key="fallback-turn-${i}:0:user" data-chatgpt-search-message-ids="extra-${i}"><div data-user-message-bubble="true">问题 ${i}</div></div>`;
    root.append(turn);
  }
  app.api.refresh();
  app.document.querySelector('[data-chatgpt-search-message-ids="user-one"] [data-user-message-bubble]').textContent = "第一个问题已修改";
  app.document.querySelector('[data-chatgpt-search-message-ids="answer-one answer-one"] p').textContent = "第一条回复已修改";
  app.api.refresh();
  assert.equal(app.questionTitles()[0], "第一个问题已修改");
  assert.ok(app.replies()[0].includes("第一条回复已修改"));
  assert.equal(app.questionTitles().length, 6);
});
