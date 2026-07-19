(function initCqnOrganizer(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.CQN_ORGANIZER = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCqnOrganizer() {
  const CATEGORY_ORDER = ["code", "solution", "research", "todo", "other"];
  const CATEGORY_LABEL_KEYS = {
    code: "categoryCode",
    solution: "categorySolution",
    research: "categoryResearch",
    todo: "categoryTodo",
    other: "categoryOther"
  };

  const CATEGORY_RULES = {
    code: [
      [/```|`[^`\n]{2,}`/, 7],
      [/\b(?:javascript|typescript|python|java|kotlin|swift|rust|golang|node\.?js|react|vue|angular|sql|html|css|json|xml|yaml|powershell|bash|c\+\+|c#|\.net|wpf|winforms|stm32)\b/i, 2],
      [/\b(?:bug|debug|exception|stack trace|compile|compiler|runtime|function|method|class|variable|repository|repo|commit|pull request)\b/i, 3],
      [/\b(?:api|sdk|database|query|endpoint)\b/i, 1],
      [/\b[\w-]+\.(?:js|ts|tsx|jsx|py|cs|cpp|c|h|java|kt|swift|rs|go|html|css|json|xml|ya?ml|md)\b/i, 5],
      [/(?:代码|编程|函数|方法|类|变量|接口|调试|报错|异常|编译|数据库|查询|仓库|提交|脚本|前端|后端|源码|修复|重构)/i, 3],
      [/(?:TypeError|ReferenceError|SyntaxError|NullReferenceException|Traceback|error\s*[:：]|failed\s+to)/i, 5]
    ],
    solution: [
      [/\b(?:solution|proposal|architecture|design|strategy|workflow|approach|roadmap|trade-?off|feasibility|optimi[sz]e|refactor plan)\b/i, 4],
      [/(?:方案|架构|设计|策略|流程|路线图|选型|权衡|可行性|优化|规划|思路|改造|实施)/i, 4],
      [/(?:怎么做|如何做|如何实现|怎样实现|应该怎么|建议怎么)/i, 1]
    ],
    research: [
      [/\b(?:research|paper|literature|reference|source|citation|documentation|docs|tutorial|guide|dataset|survey|benchmark|official website|link)\b/i, 4],
      [/(?:资料|论文|文献|参考|来源|引用|官方文档|教程|指南|数据集|调研|综述|基准|官网|链接|搜索|检索|查找)/i, 4]
    ],
    todo: [
      [/\b(?:todo|to-do|checklist|action items?|next steps?|task list|remind|follow[- ]?up|milestone|schedule)\b/i, 4],
      [/(?:待办|任务清单|行动项|下一步|后续步骤|提醒|跟进|里程碑|日程|排期|检查清单)/i, 4],
      [/(?:列出|整理|生成).{0,8}(?:步骤|清单|任务)/i, 2]
    ]
  };

  const TIE_BREAK_ORDER = ["code", "todo", "research", "solution"];

  function normalizeSearchText(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function scoreCategory(text, rules) {
    return rules.reduce((score, [pattern, weight]) => score + (pattern.test(text) ? weight : 0), 0);
  }

  function classifyQuestion(input = {}) {
    const text = String(input.text || "");
    const normalized = normalizeSearchText(text);
    const scores = {
      code: scoreCategory(text, CATEGORY_RULES.code) + (input.hasCodeBlock ? 8 : 0),
      solution: scoreCategory(text, CATEGORY_RULES.solution),
      research: scoreCategory(text, CATEGORY_RULES.research),
      todo: scoreCategory(text, CATEGORY_RULES.todo)
    };

    if (!normalized || Object.values(scores).every((score) => score === 0)) {
      return "other";
    }

    let selected = "other";
    let selectedScore = 0;
    TIE_BREAK_ORDER.forEach((category) => {
      if (scores[category] > selectedScore) {
        selected = category;
        selectedScore = scores[category];
      }
    });

    return selected;
  }

  function isCategory(value) {
    return CATEGORY_ORDER.includes(value);
  }

  function isPersistableStateKey(key) {
    return (
      typeof key === "string" &&
      key.length <= 512 &&
      /^(turn|message|test):[^\r\n]+$/.test(key)
    );
  }

  function matchesSearch(entry, query) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
      return true;
    }

    const haystack = normalizeSearchText(
      [entry?.displayText, entry?.fullText, entry?.quote, entry?.quoteLabel, entry?.searchText]
        .filter(Boolean)
        .join(" ")
    );
    return haystack.includes(normalizedQuery);
  }

  return {
    CATEGORY_LABEL_KEYS,
    CATEGORY_ORDER,
    CATEGORY_RULES,
    classifyQuestion,
    isCategory,
    isPersistableStateKey,
    matchesSearch,
    normalizeSearchText
  };
});
