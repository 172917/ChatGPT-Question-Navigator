const test = require("node:test");
const assert = require("node:assert/strict");

const settings = require("../settings.js");

test("automatic classification defaults on and accepts an explicit off value", () => {
  assert.deepEqual(settings.sanitizeSettings(null), { autoClassificationEnabled: true });
  assert.deepEqual(settings.sanitizeSettings({ autoClassificationEnabled: false }), {
    autoClassificationEnabled: false
  });
});

test("labels are trimmed, deduplicated case-insensitively, and color-sanitized", () => {
  const labels = settings.sanitizeLabels([
    { id: "label_alpha", name: "  Work  ", color: "#0f766e" },
    { id: "label_beta", name: "work", color: "#ffffff" },
    { id: "bad", name: "Research", color: "#2563eb" },
    { id: "label_gamma", name: "Research", color: "#ffffff" }
  ]);

  assert.deepEqual(labels, [
    { id: "label_alpha", name: "Work", color: "#0f766e" },
    { id: "label_gamma", name: "Research", color: settings.LABEL_COLORS[3] }
  ]);
});

test("deleting a label only removes its ids from v2 organizer metadata", () => {
  const source = {
    version: 2,
    items: {
      "turn:conversation-turn-1": {
        favorite: true,
        categoryOverride: "code",
        labelIds: ["label_alpha", "label_beta"]
      },
      "turn:conversation-turn-3": {
        favorite: false,
        categoryOverride: "",
        labelIds: ["label_alpha"]
      }
    }
  };

  assert.deepEqual(settings.cleanLabelFromOrganizerState(source, "label_alpha"), {
    version: 2,
    items: {
      "turn:conversation-turn-1": {
        favorite: true,
        categoryOverride: "code",
        labelIds: ["label_beta"]
      }
    }
  });
});
