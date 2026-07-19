(function initCqnSettings(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.CQN_SETTINGS = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCqnSettings() {
  const SETTINGS_STORAGE_KEY = "cqn-global-settings-v1";
  const LABELS_STORAGE_KEY = "cqn-custom-labels-v1";
  const ORGANIZER_STORAGE_PREFIX = "cqn-organizer-state-v2:";
  const MAX_LABELS = 30;
  const MAX_LABEL_NAME_LENGTH = 20;
  const LABEL_COLORS = [
    "#0f766e",
    "#2563eb",
    "#7c3aed",
    "#b45309",
    "#be123c",
    "#0369a1",
    "#4d7c0f",
    "#9f1239"
  ];

  let settings = { autoClassificationEnabled: true };
  let labels = [];
  let initialized = false;
  let storageListenerAttached = false;
  const listeners = new Set();

  function normalizeLabelName(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function normalizeLabelId(value) {
    const id = String(value || "");
    return /^[a-zA-Z0-9_-]{6,80}$/.test(id) ? id : "";
  }

  function sanitizeSettings(value) {
    return {
      autoClassificationEnabled: value?.autoClassificationEnabled !== false
    };
  }

  function sanitizeLabels(value) {
    const source = Array.isArray(value) ? value : [];
    const seenIds = new Set();
    const seenNames = new Set();
    const result = [];

    source.slice(0, MAX_LABELS * 2).forEach((label, index) => {
      if (!label || typeof label !== "object" || result.length >= MAX_LABELS) {
        return;
      }

      const id = normalizeLabelId(label.id);
      const name = normalizeLabelName(label.name).slice(0, MAX_LABEL_NAME_LENGTH);
      const normalizedName = name.toLocaleLowerCase();
      if (!id || !name || seenIds.has(id) || seenNames.has(normalizedName)) {
        return;
      }

      const color = LABEL_COLORS.includes(label.color)
        ? label.color
        : LABEL_COLORS[index % LABEL_COLORS.length];
      seenIds.add(id);
      seenNames.add(normalizedName);
      result.push({ id, name, color });
    });

    return result;
  }

  function validateLabelName(value, excludeId = "") {
    const name = normalizeLabelName(value);
    if (!name) {
      return { valid: false, reason: "empty", name };
    }
    if (Array.from(name).length > MAX_LABEL_NAME_LENGTH) {
      return { valid: false, reason: "tooLong", name };
    }

    const duplicate = labels.some(
      (label) =>
        label.id !== excludeId && label.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    );
    if (duplicate) {
      return { valid: false, reason: "duplicate", name };
    }
    if (!excludeId && labels.length >= MAX_LABELS) {
      return { valid: false, reason: "limit", name };
    }
    return { valid: true, reason: "", name };
  }

  function createStableId() {
    try {
      return `label_${globalThis.crypto?.randomUUID?.().replace(/-/g, "")}`;
    } catch {
      return `label_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  function emitChange(reason = "update") {
    const snapshot = getSnapshot();
    listeners.forEach((listener) => {
      try {
        listener(snapshot, reason);
      } catch (error) {
        console.warn("[ChatGPT Question Navigator] Settings listener failed.", error);
      }
    });
  }

  function getSnapshot() {
    return {
      autoClassificationEnabled: settings.autoClassificationEnabled,
      labels: labels.map((label) => ({ ...label }))
    };
  }

  function handleStorageChanged(changes, areaName) {
    if (areaName !== "local") {
      return;
    }

    let changed = false;
    if (changes?.[SETTINGS_STORAGE_KEY]) {
      settings = sanitizeSettings(changes[SETTINGS_STORAGE_KEY].newValue);
      changed = true;
    }
    if (changes?.[LABELS_STORAGE_KEY]) {
      labels = sanitizeLabels(changes[LABELS_STORAGE_KEY].newValue);
      changed = true;
    }
    if (changed) {
      emitChange("storage");
    }
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
      return getSnapshot();
    }

    initialized = true;
    attachStorageListener();
    try {
      const result = await globalThis.chrome?.storage?.local?.get?.([
        SETTINGS_STORAGE_KEY,
        LABELS_STORAGE_KEY
      ]);
      settings = sanitizeSettings(result?.[SETTINGS_STORAGE_KEY]);
      labels = sanitizeLabels(result?.[LABELS_STORAGE_KEY]);
    } catch {
      settings = sanitizeSettings(null);
      labels = [];
    }
    return getSnapshot();
  }

  async function setAutoClassificationEnabled(enabled) {
    settings = { autoClassificationEnabled: enabled !== false };
    emitChange("autoClassification");
    try {
      await globalThis.chrome?.storage?.local?.set?.({
        [SETTINGS_STORAGE_KEY]: settings
      });
    } catch (error) {
      console.warn("[ChatGPT Question Navigator] Settings could not be saved.", error);
    }
    return settings.autoClassificationEnabled;
  }

  async function saveLabels(reason) {
    emitChange(reason);
    try {
      await globalThis.chrome?.storage?.local?.set?.({ [LABELS_STORAGE_KEY]: labels });
    } catch (error) {
      console.warn("[ChatGPT Question Navigator] Labels could not be saved.", error);
    }
    return labels.map((label) => ({ ...label }));
  }

  async function createLabel(value) {
    const validation = validateLabelName(value);
    if (!validation.valid) {
      return { ok: false, reason: validation.reason };
    }

    const label = {
      id: createStableId(),
      name: validation.name,
      color: LABEL_COLORS[labels.length % LABEL_COLORS.length]
    };
    labels = [...labels, label];
    await saveLabels("createLabel");
    return { ok: true, label: { ...label } };
  }

  async function renameLabel(id, value) {
    const normalizedId = normalizeLabelId(id);
    const validation = validateLabelName(value, normalizedId);
    const index = labels.findIndex((label) => label.id === normalizedId);
    if (index < 0) {
      return { ok: false, reason: "missing" };
    }
    if (!validation.valid) {
      return { ok: false, reason: validation.reason };
    }

    labels = labels.map((label) =>
      label.id === normalizedId ? { ...label, name: validation.name } : label
    );
    await saveLabels("renameLabel");
    return { ok: true, label: { ...labels[index], name: validation.name } };
  }

  function cleanLabelFromOrganizerState(value, labelId) {
    if (!value || typeof value !== "object" || !value.items || typeof value.items !== "object") {
      return value;
    }

    let changed = false;
    const items = {};
    Object.entries(value.items).forEach(([key, item]) => {
      if (!item || typeof item !== "object") {
        return;
      }
      const labelIds = Array.isArray(item.labelIds)
        ? item.labelIds.filter((id) => id !== labelId)
        : [];
      if (labelIds.length !== (Array.isArray(item.labelIds) ? item.labelIds.length : 0)) {
        changed = true;
      }
      if (item.favorite === true || item.categoryOverride || labelIds.length) {
        items[key] = { ...item, labelIds };
      }
    });

    return changed ? { ...value, items } : value;
  }

  async function deleteLabel(id) {
    const normalizedId = normalizeLabelId(id);
    if (!labels.some((label) => label.id === normalizedId)) {
      return { ok: false, reason: "missing" };
    }

    labels = labels.filter((label) => label.id !== normalizedId);
    await saveLabels("deleteLabel");

    try {
      const allStored = await globalThis.chrome?.storage?.local?.get?.(null);
      const updates = {};
      Object.entries(allStored || {}).forEach(([key, value]) => {
        if (!key.startsWith(ORGANIZER_STORAGE_PREFIX)) {
          return;
        }
        const cleaned = cleanLabelFromOrganizerState(value, normalizedId);
        if (cleaned !== value) {
          updates[key] = cleaned;
        }
      });
      if (Object.keys(updates).length) {
        await globalThis.chrome?.storage?.local?.set?.(updates);
      }
    } catch (error) {
      console.warn("[ChatGPT Question Navigator] Removed label associations could not be cleaned.", error);
    }

    return { ok: true };
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    SETTINGS_STORAGE_KEY,
    LABELS_STORAGE_KEY,
    ORGANIZER_STORAGE_PREFIX,
    LABEL_COLORS,
    MAX_LABELS,
    MAX_LABEL_NAME_LENGTH,
    cleanLabelFromOrganizerState,
    createLabel,
    deleteLabel,
    getAutoClassificationEnabled: () => settings.autoClassificationEnabled,
    getLabels: () => labels.map((label) => ({ ...label })),
    getSnapshot,
    initialize,
    normalizeLabelId,
    normalizeLabelName,
    renameLabel,
    sanitizeLabels,
    sanitizeSettings,
    setAutoClassificationEnabled,
    subscribe,
    validateLabelName
  };
});
