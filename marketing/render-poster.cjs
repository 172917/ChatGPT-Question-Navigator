const path = require("path");
const { chromium } = require("playwright");

(async () => {
const html = path.join(__dirname, "chatgpt-question-navigator-poster.html");
const png = path.join(__dirname, "chatgpt-question-navigator-poster.png");
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1350 },
    deviceScaleFactor: 1
  });

  await page.goto(`file:///${html.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
  await page.locator(".poster").screenshot({ path: png });

  const metrics = await page.evaluate(() => {
    const overflowing = [];
    for (const el of document.querySelectorAll(".poster *")) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
        overflowing.push({
          className: String(el.className),
          text: el.textContent.trim().slice(0, 80),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight
        });
      }
    }
    return overflowing;
  });

  console.log(JSON.stringify({ png, overflowing: metrics }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
