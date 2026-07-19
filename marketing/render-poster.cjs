const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const htmlPath = path.join(__dirname, "chatgpt-question-navigator-poster.html");
const pngPath = path.join(__dirname, "chatgpt-question-navigator-poster.png");
const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "cqn-poster-"));
const pageUrl = `file:///${htmlPath.replace(/\\/g, "/")}?export=1`;

try {
  if (!fs.existsSync(chromePath)) {
    throw new Error(`Chrome executable not found: ${chromePath}`);
  }

  const result = spawnSync(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--run-all-compositor-stages-before-draw",
      "--force-device-scale-factor=1",
      "--window-size=1080,1350",
      `--user-data-dir=${profilePath}`,
      `--screenshot=${pngPath}`,
      pageUrl
    ],
    { encoding: "utf8" }
  );

  if (result.status !== 0 || !fs.existsSync(pngPath)) {
    throw new Error(result.stderr || result.stdout || "Chrome poster export failed.");
  }

  console.log(JSON.stringify({ png: pngPath, width: 1080, height: 1350 }, null, 2));
} finally {
  fs.rmSync(profilePath, { recursive: true, force: true });
}
