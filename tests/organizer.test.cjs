const test = require("node:test");
const assert = require("node:assert/strict");

const organizer = require("../organizer.js");
const i18n = require("../i18n.js");

test("classifies Chinese and English code questions", () => {
  assert.equal(organizer.classifyQuestion({ text: "这段 C# 代码为什么报 NullReferenceException？" }), "code");
  assert.equal(organizer.classifyQuestion({ text: "Please debug the TypeScript function in app.ts" }), "code");
  assert.equal(organizer.classifyQuestion({ text: "普通问题", hasCodeBlock: true }), "code");
});

test("classifies solutions, research, todos, and fallback questions", () => {
  assert.equal(organizer.classifyQuestion({ text: "给我设计一个多轴控制架构方案" }), "solution");
  assert.equal(organizer.classifyQuestion({ text: "给我设计一个 WPF、C# 和 STM32 协同工作的整体架构方案" }), "solution");
  assert.equal(organizer.classifyQuestion({ text: "Find official documentation and research papers about trajectory planning" }), "research");
  assert.equal(organizer.classifyQuestion({ text: "Find official documentation and benchmark sources for this API" }), "research");
  assert.equal(organizer.classifyQuestion({ text: "整理下一步行动项和任务清单" }), "todo");
  assert.equal(organizer.classifyQuestion({ text: "你觉得这个怎么样？" }), "other");
});

test("strong code signals win category conflicts", () => {
  assert.equal(
    organizer.classifyQuestion({ text: "查找资料并修复 src/app.ts 的 TypeError" }),
    "code"
  );
});

test("search matches question and quote text", () => {
  const entry = {
    displayText: "解释一下这个公式",
    quote: "Fourier transform",
    searchText: "解释一下这个公式 Fourier transform"
  };

  assert.equal(organizer.matchesSearch(entry, "公式"), true);
  assert.equal(organizer.matchesSearch(entry, "FOURIER"), true);
  assert.equal(organizer.matchesSearch(entry, "数据库"), false);
});

test("only stable non-content identifiers can be persisted", () => {
  assert.equal(organizer.isPersistableStateKey("message:abc_123"), true);
  assert.equal(organizer.isPersistableStateKey("turn:conversation-turn-7"), true);
  assert.equal(organizer.isPersistableStateKey("test:conversation-turn-7"), true);
  assert.equal(organizer.isPersistableStateKey("text:我的问题正文:8"), false);
  assert.equal(organizer.isPersistableStateKey("message:line one\nline two"), false);
});

test("locale dictionaries have matching keys", () => {
  assert.deepEqual(i18n.getDictionaryKeys("zh-CN"), i18n.getDictionaryKeys("en"));
});

test("locale resolution follows preference and browser fallback", () => {
  assert.equal(i18n.resolveLocale("zh-CN", "en-US"), "zh-CN");
  assert.equal(i18n.resolveLocale("en", "zh-CN"), "en");
  assert.equal(i18n.resolveLocale("auto", "zh-TW"), "zh-CN");
  assert.equal(i18n.resolveLocale("auto", "fr-FR"), "en");
  assert.equal(i18n.resolveLocale("unsupported", "en-US"), "en");
});
