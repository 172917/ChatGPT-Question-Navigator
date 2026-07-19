const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const outputPath = path.join(__dirname, "exports", "promo-16x9.mp4");
const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function readMp4Boxes(buffer, start = 0, end = buffer.length) {
  const boxes = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    let headerSize = 8;
    if (size === 1) {
      if (offset + 16 > end) break;
      size = Number(buffer.readBigUInt64BE(offset + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) break;
    boxes.push({ type, start: offset, end: offset + size, dataStart: offset + headerSize });
    offset += size;
  }
  return boxes;
}

function parseMp4Metadata(filePath) {
  const buffer = fs.readFileSync(filePath);
  const moov = readMp4Boxes(buffer).find((box) => box.type === "moov");
  if (!moov) throw new Error("Exported MP4 has no moov metadata box.");
  const moovChildren = readMp4Boxes(buffer, moov.dataStart, moov.end);
  const mvhd = moovChildren.find((box) => box.type === "mvhd");
  if (!mvhd) throw new Error("Exported MP4 has no mvhd timing box.");

  const mvhdVersion = buffer.readUInt8(mvhd.dataStart);
  const timescaleOffset = mvhd.dataStart + (mvhdVersion === 1 ? 20 : 12);
  const durationOffset = timescaleOffset + 4;
  const timescale = buffer.readUInt32BE(timescaleOffset);
  const durationUnits = mvhdVersion === 1
    ? Number(buffer.readBigUInt64BE(durationOffset))
    : buffer.readUInt32BE(durationOffset);

  let width = 0;
  let height = 0;
  for (const trak of moovChildren.filter((box) => box.type === "trak")) {
    const tkhd = readMp4Boxes(buffer, trak.dataStart, trak.end).find((box) => box.type === "tkhd");
    if (!tkhd) continue;
    const version = buffer.readUInt8(tkhd.dataStart);
    const dimensionsOffset = tkhd.start + (version === 1 ? 96 : 84);
    const trackWidth = buffer.readUInt32BE(dimensionsOffset) / 65536;
    const trackHeight = buffer.readUInt32BE(dimensionsOffset + 4) / 65536;
    if (trackWidth * trackHeight > width * height) {
      width = Math.round(trackWidth);
      height = Math.round(trackHeight);
    }
  }

  return {
    duration: timescale ? durationUnits / timescale : 0,
    width,
    height,
    size: buffer.length
  };
}

function assertExpectedMetadata(metadata) {
  if (Math.abs(metadata.duration - 20) > 0.75 || metadata.width !== 1920 || metadata.height !== 1080) {
    throw new Error(`Invalid MP4 metadata: ${JSON.stringify(metadata)}`);
  }
}

async function waitFor(check, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(150);
  }
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ""}`);
}

function createStaticServer() {
  return http.createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    } catch {
      response.writeHead(400).end("Bad request");
      return;
    }

    const requestedPath = path.resolve(projectRoot, `.${pathname}`);
    if (requestedPath !== projectRoot && !requestedPath.startsWith(`${projectRoot}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    fs.stat(requestedPath, (statError, stats) => {
      if (statError || !stats.isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }

      const headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
        "Content-Type": mimeTypes[path.extname(requestedPath).toLowerCase()] || "application/octet-stream"
      };
      const range = request.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match) {
          response.writeHead(416, { "Content-Range": `bytes */${stats.size}` }).end();
          return;
        }
        const isSuffixRange = !match[1] && Boolean(match[2]);
        const suffixLength = isSuffixRange ? Number(match[2]) : 0;
        const start = isSuffixRange
          ? Math.max(stats.size - suffixLength, 0)
          : (match[1] ? Number(match[1]) : 0);
        const end = isSuffixRange
          ? stats.size - 1
          : (match[2] ? Math.min(Number(match[2]), stats.size - 1) : stats.size - 1);
        if (start > end || start >= stats.size) {
          response.writeHead(416, { "Content-Range": `bytes */${stats.size}` }).end();
          return;
        }
        response.writeHead(206, {
          ...headers,
          "Content-Length": end - start + 1,
          "Content-Range": `bytes ${start}-${end}/${stats.size}`
        });
        fs.createReadStream(requestedPath, { start, end }).pipe(response);
        return;
      }

      response.writeHead(200, { ...headers, "Content-Length": stats.size });
      fs.createReadStream(requestedPath).pipe(response);
    });
  });
}

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(url);
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", () => reject(new Error("Chrome DevTools connection failed.")), { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (!payload.id || !this.pending.has(payload.id)) return;
      const { resolve, reject } = this.pending.get(payload.id);
      this.pending.delete(payload.id);
      if (payload.error) reject(new Error(payload.error.message));
      else resolve(payload.result);
    });
  }

  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function main() {
  if (process.argv.includes("--validate-only")) {
    const metadata = parseMp4Metadata(outputPath);
    assertExpectedMetadata(metadata);
    console.log(`Validated ${metadata.duration.toFixed(2)}s, ${metadata.width}x${metadata.height}, ${(metadata.size / 1024 / 1024).toFixed(1)} MB`);
    console.log(outputPath);
    return;
  }

  const chromePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));
  if (!chromePath) throw new Error("Chrome or Edge was not found. Set CHROME_PATH and try again.");

  const server = createStaticServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const serverPort = server.address().port;
  const debugPort = 9300 + Math.floor(Math.random() * 500);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cqn-video-"));
  const profilePath = path.join(tempRoot, "profile");
  const downloadPath = path.join(tempRoot, "downloads");
  fs.mkdirSync(downloadPath, { recursive: true });

  const chrome = childProcess.spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profilePath}`,
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--autoplay-policy=no-user-gesture-required",
    "--hide-scrollbars",
    "--mute-audio",
    "--window-size=1920,1080",
    "about:blank"
  ], { stdio: "ignore", windowsHide: true });

  let client;
  try {
    const targets = await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      if (!response.ok) return null;
      const items = await response.json();
      return items.some((item) => item.type === "page") ? items : null;
    }, 12000, "Chrome DevTools did not become ready");
    const pageTarget = targets.find((target) => target.type === "page" && target.url === "about:blank")
      || targets.find((target) => target.type === "page");

    client = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();
    await client.call("Page.enable");
    await client.call("Runtime.enable");
    await client.call("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath,
      eventsEnabled: true
    });

    const promoUrl = `http://127.0.0.1:${serverPort}/marketing/video/promo-16x9.html`;
    await client.call("Page.navigate", { url: promoUrl });
    const loadedStatus = await waitFor(
      async () => {
        const status = await evaluate(client, "document.querySelector('#status')?.textContent || ''");
        if (status.includes("素材加载失败")) throw new Error(status);
        return status.includes("素材已加载") ? status : null;
      },
      15000,
      "Promo assets did not load"
    );

    await evaluate(client, "document.querySelector('#exportMp4Button').click(); true");
    const completion = await waitFor(async () => {
      const status = await evaluate(client, "document.querySelector('#status')?.textContent || ''");
      if (status.includes("导出失败")) throw new Error(status);
      return status.includes("导出完成") ? status : null;
    }, 55000, "MP4 export did not complete");

    const downloadedPath = await waitFor(() => {
      const files = fs.readdirSync(downloadPath).filter((name) => name.endsWith(".mp4"));
      if (!files.length) return null;
      const candidate = path.join(downloadPath, files[0]);
      return fs.statSync(candidate).size > 100000 ? candidate : null;
    }, 10000, "Chrome did not save the MP4 download");

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.copyFileSync(downloadedPath, outputPath);

    const metadata = parseMp4Metadata(outputPath);
    assertExpectedMetadata(metadata);
    const sizeMb = metadata.size / 1024 / 1024;
    console.log(completion);
    console.log(`Validated ${metadata.duration.toFixed(2)}s, ${metadata.width}x${metadata.height}, ${sizeMb.toFixed(1)} MB`);
    console.log(outputPath);
  } finally {
    if (client) client.close();
    chrome.kill();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
