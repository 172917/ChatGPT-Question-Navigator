const PRODUCT_ID = "chatgpt-question-navigator";
const PRODUCT_SALT = "cqn-local-license-v1";
const LICENSE_VERSION = 1;
const TRIAL_HOURS = 7 * 24;
const TRIAL_MS = TRIAL_HOURS * 60 * 60 * 1000;
const MACHINE_CODE_LENGTH = 20;
const MACHINE_CODE_GROUP_SIZE = 4;
const ACTIVATION_PREFIX = "CQNLIC-";
const BASE32_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const STORAGE_KEYS = {
  deviceSeed: "cqnDeviceSeed",
  licenseRecord: "cqnLicenseRecord",
  trialStartedAt: "cqnTrialStartedAt"
};
const PUBLIC_JWK = {
  kty: "EC",
  x: "0cwrTMXxGM3mEtuBg-r5ia7cy1RsxTOQgfTDsMwtjC0",
  y: "MbB2gAuGxD0I7c3dB9TEAgDj2EAtO297jjUkrUVmhwk",
  crv: "P-256"
};

let publicKeyPromise = null;

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function storageSet(values) {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, resolve);
  });
}

function storageRemove(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  });
}

function textToBytes(text) {
  return new TextEncoder().encode(text);
}

function bytesToText(bytes) {
  return new TextDecoder().decode(bytes);
}

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToBase32(bytes, length) {
  let output = "";
  let value = 0;
  let bits = 0;

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;

      if (output.length >= length) {
        return output;
      }
    }
  }

  if (bits > 0 && output.length < length) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output.padEnd(length, BASE32_ALPHABET[0]).slice(0, length);
}

function formatMachineCode(rawCode) {
  const groups = [];
  for (let index = 0; index < rawCode.length; index += MACHINE_CODE_GROUP_SIZE) {
    groups.push(rawCode.slice(index, index + MACHINE_CODE_GROUP_SIZE));
  }

  return `CQN-${groups.join("-")}`;
}

function normalizeActivationCode(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

async function getDeviceSeed() {
  const stored = await storageGet(STORAGE_KEYS.deviceSeed);
  if (typeof stored[STORAGE_KEYS.deviceSeed] === "string") {
    return stored[STORAGE_KEYS.deviceSeed];
  }

  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const seed = bytesToBase64Url(randomBytes);
  await storageSet({ [STORAGE_KEYS.deviceSeed]: seed });
  return seed;
}

async function getMachineCode() {
  const seed = await getDeviceSeed();
  const extensionId = chrome.runtime.id || "unpacked-extension";
  const digest = await sha256(textToBytes(`${seed}:${extensionId}:${PRODUCT_SALT}`));
  return formatMachineCode(bytesToBase32(digest, MACHINE_CODE_LENGTH));
}

async function getTrialState() {
  const stored = await storageGet(STORAGE_KEYS.trialStartedAt);
  let startedAt = stored[STORAGE_KEYS.trialStartedAt];

  if (typeof startedAt !== "string") {
    startedAt = new Date().toISOString();
    await storageSet({ [STORAGE_KEYS.trialStartedAt]: startedAt });
  }

  const startedAtMs = Date.parse(startedAt);
  const safeStartedAtMs = Number.isFinite(startedAtMs) ? startedAtMs : Date.now();
  const expiresAtMs = safeStartedAtMs + TRIAL_MS;
  const remainingMs = Math.max(0, expiresAtMs - Date.now());

  return {
    active: remainingMs > 0,
    startedAt: new Date(safeStartedAtMs).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    remainingMs,
    remainingHours: Math.ceil(remainingMs / (60 * 60 * 1000)),
    totalHours: TRIAL_HOURS
  };
}

function getPublicKey() {
  if (!publicKeyPromise) {
    publicKeyPromise = crypto.subtle.importKey(
      "jwk",
      PUBLIC_JWK,
      {
        name: "ECDSA",
        namedCurve: "P-256"
      },
      false,
      ["verify"]
    );
  }

  return publicKeyPromise;
}

function normalizeMachineCode(value) {
  return String(value || "").trim().toUpperCase();
}

async function verifyActivationCode(activationCode, machineCode) {
  const normalizedCode = normalizeActivationCode(activationCode);
  if (!normalizedCode.startsWith(ACTIVATION_PREFIX)) {
    return { ok: false, error: "激活码格式不正确。" };
  }

  const token = normalizedCode.slice(ACTIVATION_PREFIX.length);
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0) {
    return { ok: false, error: "激活码内容不完整。" };
  }

  const payloadPart = token.slice(0, separatorIndex);
  const signaturePart = token.slice(separatorIndex + 1);
  let payloadBytes;
  let signatureBytes;
  let payload;

  try {
    payloadBytes = base64UrlToBytes(payloadPart);
    signatureBytes = base64UrlToBytes(signaturePart);
    payload = JSON.parse(bytesToText(payloadBytes));
  } catch {
    return { ok: false, error: "激活码无法解析。" };
  }

  const publicKey = await getPublicKey();
  const signatureValid = await crypto.subtle.verify(
    {
      name: "ECDSA",
      hash: "SHA-256"
    },
    publicKey,
    signatureBytes,
    payloadBytes
  );

  if (!signatureValid) {
    return { ok: false, error: "激活码签名无效。" };
  }

  if (payload.productId !== PRODUCT_ID || payload.version !== LICENSE_VERSION) {
    return { ok: false, error: "激活码不适用于当前插件版本。" };
  }

  if (normalizeMachineCode(payload.machineCode) !== normalizeMachineCode(machineCode)) {
    return { ok: false, error: "激活码不属于当前机器码。" };
  }

  if (payload.licenseType !== "lifetime") {
    return { ok: false, error: "当前只支持永久授权激活码。" };
  }

  return {
    ok: true,
    payload,
    normalizedCode
  };
}

async function getLicenseStatus() {
  const machineCode = await getMachineCode();
  const stored = await storageGet(STORAGE_KEYS.licenseRecord);
  const licenseRecord = stored[STORAGE_KEYS.licenseRecord];

  if (!licenseRecord?.activationCode) {
    const trial = await getTrialState();
    if (trial.active) {
      return {
        ok: true,
        authorized: true,
        mode: "trial",
        machineCode,
        trial
      };
    }

    return {
      ok: true,
      authorized: false,
      mode: "expired",
      machineCode,
      trial,
      reason: "一周免费试用已结束，请激活后继续使用。"
    };
  }

  const verification = await verifyActivationCode(licenseRecord.activationCode, machineCode);
  if (!verification.ok) {
    return {
      ok: true,
      authorized: false,
      mode: "invalid",
      machineCode,
      reason: verification.error
    };
  }

  return {
    ok: true,
    authorized: true,
    mode: "license",
    machineCode,
    license: {
      licenseType: verification.payload.licenseType,
      issuedAt: verification.payload.issuedAt,
      activatedAt: licenseRecord.activatedAt || ""
    }
  };
}

async function activateLicense(activationCode) {
  const machineCode = await getMachineCode();
  const verification = await verifyActivationCode(activationCode, machineCode);

  if (!verification.ok) {
    return {
      ok: false,
      authorized: false,
      machineCode,
      error: verification.error
    };
  }

  await storageSet({
    [STORAGE_KEYS.licenseRecord]: {
      activationCode: verification.normalizedCode,
      payload: verification.payload,
      activatedAt: new Date().toISOString()
    }
  });

  return getLicenseStatus();
}

async function deactivateLicense() {
  await storageRemove(STORAGE_KEYS.licenseRecord);
  return getLicenseStatus();
}

chrome.runtime.onInstalled.addListener(() => {
  getDeviceSeed().catch((error) => {
    console.warn("[ChatGPT Question Navigator] 机器码初始化失败。", error);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = message?.type;

  (async () => {
    if (type === "CQN_LICENSE_STATUS") {
      return getLicenseStatus();
    }

    if (type === "CQN_LICENSE_ACTIVATE") {
      return activateLicense(message.activationCode);
    }

    if (type === "CQN_LICENSE_DEACTIVATE") {
      return deactivateLicense();
    }

    return {
      ok: false,
      error: "未知授权消息。"
    };
  })()
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        authorized: false,
        error: error?.message || "授权处理失败。"
      });
    });

  return true;
});
