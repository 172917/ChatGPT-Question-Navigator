const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const exportsDir = path.join(__dirname, "exports");
const profiles = {
  master: {
    fps: 60,
    bitrate: 12000000,
    filename: "question-navigator-demo-master-1080p.mp4"
  },
  github: {
    fps: 30,
    bitrate: 4000000,
    filename: "question-navigator-demo-github.mp4",
    maxBytes: 25 * 1024 * 1024
  }
};

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
  ".json": "application/json",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) continue;
    const key = argument.slice(2);
    if (key === "validate-only") {
      values.validateOnly = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    values[key] = value;
    index += 1;
  }
  return values;
}

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

function findChild(buffer, parent, type) {
  return readMp4Boxes(buffer, parent.dataStart, parent.end).find((box) => box.type === type);
}

function fullBoxFlags(buffer, box) {
  return buffer.readUIntBE(box.dataStart + 1, 3);
}

function parseFragmentedDuration(buffer, topLevelBoxes, moovChildren, trackInfo) {
  const defaults = new Map();
  const mvex = moovChildren.find((box) => box.type === "mvex");
  if (mvex) {
    for (const trex of readMp4Boxes(buffer, mvex.dataStart, mvex.end).filter((box) => box.type === "trex")) {
      const trackId = buffer.readUInt32BE(trex.dataStart + 4);
      defaults.set(trackId, buffer.readUInt32BE(trex.dataStart + 12));
    }
  }

  let longestSeconds = 0;
  for (const moof of topLevelBoxes.filter((box) => box.type === "moof")) {
    for (const traf of readMp4Boxes(buffer, moof.dataStart, moof.end).filter((box) => box.type === "traf")) {
      const children = readMp4Boxes(buffer, traf.dataStart, traf.end);
      const tfhd = children.find((box) => box.type === "tfhd");
      const tfdt = children.find((box) => box.type === "tfdt");
      if (!tfhd || !tfdt) continue;

      const trackId = buffer.readUInt32BE(tfhd.dataStart + 4);
      const info = trackInfo.get(trackId);
      if (!info?.timescale) continue;

      const tfhdFlags = fullBoxFlags(buffer, tfhd);
      let tfhdCursor = tfhd.dataStart + 8;
      if (tfhdFlags & 0x000001) tfhdCursor += 8;
      if (tfhdFlags & 0x000002) tfhdCursor += 4;
      let defaultDuration = defaults.get(trackId) || 0;
      if (tfhdFlags & 0x000008) {
        defaultDuration = buffer.readUInt32BE(tfhdCursor);
        tfhdCursor += 4;
      }

      const tfdtVersion = buffer.readUInt8(tfdt.dataStart);
      const baseDecodeTime = tfdtVersion === 1
        ? Number(buffer.readBigUInt64BE(tfdt.dataStart + 4))
        : buffer.readUInt32BE(tfdt.dataStart + 4);
      let fragmentDuration = 0;

      for (const trun of children.filter((box) => box.type === "trun")) {
        const trunFlags = fullBoxFlags(buffer, trun);
        const sampleCount = buffer.readUInt32BE(trun.dataStart + 4);
        let cursor = trun.dataStart + 8;
        if (trunFlags & 0x000001) cursor += 4;
        if (trunFlags & 0x000004) cursor += 4;
        if (!(trunFlags & 0x000100)) {
          fragmentDuration += defaultDuration * sampleCount;
          continue;
        }
        for (let index = 0; index < sampleCount; index += 1) {
          fragmentDuration += buffer.readUInt32BE(cursor);
          cursor += 4;
          if (trunFlags & 0x000200) cursor += 4;
          if (trunFlags & 0x000400) cursor += 4;
          if (trunFlags & 0x000800) cursor += 4;
        }
      }

      longestSeconds = Math.max(longestSeconds, (baseDecodeTime + fragmentDuration) / info.timescale);
    }
  }
  return longestSeconds;
}

function parseMp4Metadata(filePath) {
  const buffer = fs.readFileSync(filePath);
  const topLevelBoxes = readMp4Boxes(buffer);
  const moov = topLevelBoxes.find((box) => box.type === "moov");
  if (!moov) throw new Error(`${path.basename(filePath)} has no moov metadata box.`);
  const moovChildren = readMp4Boxes(buffer, moov.dataStart, moov.end);
  const mvhd = moovChildren.find((box) => box.type === "mvhd");
  if (!mvhd) throw new Error(`${path.basename(filePath)} has no mvhd timing box.`);

  const mvhdVersion = buffer.readUInt8(mvhd.dataStart);
  const timescaleOffset = mvhd.dataStart + (mvhdVersion === 1 ? 20 : 12);
  const durationOffset = timescaleOffset + 4;
  const timescale = buffer.readUInt32BE(timescaleOffset);
  const durationUnits = mvhdVersion === 1
    ? Number(buffer.readBigUInt64BE(durationOffset))
    : buffer.readUInt32BE(durationOffset);

  let width = 0;
  let height = 0;
  const trackTypes = [];
  const trackInfo = new Map();
  for (const trak of moovChildren.filter((box) => box.type === "trak")) {
    const tkhd = findChild(buffer, trak, "tkhd");
    let trackId = 0;
    if (tkhd) {
      const version = buffer.readUInt8(tkhd.dataStart);
      trackId = buffer.readUInt32BE(tkhd.dataStart + (version === 1 ? 20 : 12));
      const dimensionsOffset = tkhd.start + (version === 1 ? 96 : 84);
      const trackWidth = buffer.readUInt32BE(dimensionsOffset) / 65536;
      const trackHeight = buffer.readUInt32BE(dimensionsOffset + 4) / 65536;
      if (trackWidth * trackHeight > width * height) {
        width = Math.round(trackWidth);
        height = Math.round(trackHeight);
      }
    }

    const mdia = findChild(buffer, trak, "mdia");
    const hdlr = mdia && findChild(buffer, mdia, "hdlr");
    const mdhd = mdia && findChild(buffer, mdia, "mdhd");
    let trackTimescale = 0;
    if (mdhd) {
      const version = buffer.readUInt8(mdhd.dataStart);
      const timescaleOffset = mdhd.dataStart + (version === 1 ? 20 : 12);
      trackTimescale = buffer.readUInt32BE(timescaleOffset);
    }
    if (hdlr && hdlr.dataStart + 12 <= hdlr.end) {
      const type = buffer.toString("ascii", hdlr.dataStart + 8, hdlr.dataStart + 12);
      trackTypes.push(type);
      if (trackId) trackInfo.set(trackId, { type, timescale: trackTimescale });
    }
  }

  const movieDuration = timescale ? durationUnits / timescale : 0;
  const fragmentedDuration = movieDuration > 0
    ? 0
    : parseFragmentedDuration(buffer, topLevelBoxes, moovChildren, trackInfo);

  return {
    duration: Math.max(movieDuration, fragmentedDuration),
    width,
    height,
    size: buffer.length,
    trackTypes
  };
}

function assertExpectedMetadata(metadata, profileName) {
  if (Math.abs(metadata.duration - 37) > 0.75) {
    throw new Error(`${profileName} duration is ${metadata.duration.toFixed(2)}s; expected 37s.`);
  }
  if (metadata.width !== 1920 || metadata.height !== 1080) {
    throw new Error(`${profileName} dimensions are ${metadata.width}x${metadata.height}; expected 1920x1080.`);
  }
  if (!metadata.trackTypes.includes("vide") || !metadata.trackTypes.includes("soun")) {
    throw new Error(`${profileName} must contain both video and audio tracks: ${metadata.trackTypes.join(", ")}`);
  }
  if (profiles[profileName]?.maxBytes && metadata.size > profiles[profileName].maxBytes) {
    throw new Error(`${profileName} is ${(metadata.size / 1024 / 1024).toFixed(1)} MB; expected at most 25 MB.`);
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
    await delay(180);
  }
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ""}`);
}

function sendFile(request, response, filePath) {
  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }

    const headers = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    };
    const range = request.headers.range;
    if (!range) {
      response.writeHead(200, { ...headers, "Content-Length": stats.size });
      fs.createReadStream(filePath).pipe(response);
      return;
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      response.writeHead(416, { "Content-Range": `bytes */${stats.size}` }).end();
      return;
    }
    const suffixRange = !match[1] && Boolean(match[2]);
    const suffixLength = suffixRange ? Number(match[2]) : 0;
    const start = suffixRange ? Math.max(stats.size - suffixLength, 0) : (match[1] ? Number(match[1]) : 0);
    const end = suffixRange
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
    fs.createReadStream(filePath, { start, end }).pipe(response);
  });
}

function createStaticServer(sourceFiles) {
  return http.createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    } catch {
      response.writeHead(400).end("Bad request");
      return;
    }

    if (pathname === "/__source/chat.mp4") return sendFile(request, response, sourceFiles.chat);
    if (pathname === "/__source/nav.mp4") return sendFile(request, response, sourceFiles.nav);

    const requestedPath = path.resolve(projectRoot, `.${pathname}`);
    if (requestedPath !== projectRoot && !requestedPath.startsWith(`${projectRoot}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    sendFile(request, response, requestedPath);
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

async function renderProfiles(selectedProfiles, sourceFiles) {
  const chromePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));
  if (!chromePath) throw new Error("Chrome or Edge was not found. Set CHROME_PATH and try again.");

  const server = createStaticServer(sourceFiles);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const serverPort = server.address().port;
  const debugPort = 9300 + Math.floor(Math.random() * 500);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cqn-product-film-"));
  const profilePath = path.join(tempRoot, "profile");
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
    fs.mkdirSync(exportsDir, { recursive: true });

    for (const profileName of selectedProfiles) {
      const profile = profiles[profileName];
      const downloadPath = path.join(tempRoot, `downloads-${profileName}`);
      fs.mkdirSync(downloadPath, { recursive: true });
      await client.call("Browser.setDownloadBehavior", {
        behavior: "allow",
        downloadPath,
        eventsEnabled: true
      });

      const promoUrl = new URL(`http://127.0.0.1:${serverPort}/marketing/video/promo-16x9.html`);
      promoUrl.searchParams.set("profile", profileName);
      promoUrl.searchParams.set("fps", String(profile.fps));
      promoUrl.searchParams.set("bitrate", String(profile.bitrate));
      console.log(`Rendering ${profileName}: ${profile.fps} fps at ${(profile.bitrate / 1000000).toFixed(1)} Mbps`);
      await client.call("Page.navigate", { url: promoUrl.href });

      await waitFor(async () => {
        const status = await evaluate(client, "document.querySelector('#status')?.textContent || ''");
        if (status.includes("failed")) throw new Error(status);
        return status.includes("Assets ready") ? status : null;
      }, 35000, `${profileName} source clips did not load`);

      await evaluate(client, "window.startHeadlessExport(); true");
      await waitFor(async () => {
        const status = await evaluate(client, "document.querySelector('#status')?.textContent || ''");
        if (status.includes("failed")) throw new Error(status);
        return status.includes("Export complete") ? status : null;
      }, 70000, `${profileName} export did not complete`);

      const downloadedPath = await waitFor(() => {
        const files = fs.readdirSync(downloadPath).filter((name) => name.endsWith(".mp4"));
        if (!files.length) return null;
        const candidate = path.join(downloadPath, files[0]);
        return fs.statSync(candidate).size > 100000 ? candidate : null;
      }, 12000, `${profileName} MP4 download was not saved`);

      const outputPath = path.join(exportsDir, profile.filename);
      fs.copyFileSync(downloadedPath, outputPath);
      const metadata = parseMp4Metadata(outputPath);
      assertExpectedMetadata(metadata, profileName);
      console.log(`Validated ${profileName}: ${metadata.duration.toFixed(2)}s, ${metadata.width}x${metadata.height}, ${(metadata.size / 1024 / 1024).toFixed(1)} MB, tracks ${metadata.trackTypes.join("+")}`);
      console.log(outputPath);
    }
  } finally {
    if (client) client.close();
    if (chrome.exitCode === null) {
      const exited = new Promise((resolve) => chrome.once("exit", resolve));
      chrome.kill();
      await Promise.race([exited, delay(3000)]);
    }
    await new Promise((resolve) => server.close(resolve));
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    } catch (error) {
      console.warn(`Temporary render directory could not be removed yet: ${error.message}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const requestedProfile = args.profile || "all";
  if (requestedProfile !== "all" && !profiles[requestedProfile]) {
    throw new Error("--profile must be master, github, or all");
  }
  const selectedProfiles = requestedProfile === "all" ? ["master", "github"] : [requestedProfile];

  if (args.validateOnly) {
    for (const profileName of selectedProfiles) {
      const outputPath = path.join(exportsDir, profiles[profileName].filename);
      const metadata = parseMp4Metadata(outputPath);
      assertExpectedMetadata(metadata, profileName);
      console.log(`Validated ${profileName}: ${metadata.duration.toFixed(2)}s, ${metadata.width}x${metadata.height}, ${(metadata.size / 1024 / 1024).toFixed(1)} MB, tracks ${metadata.trackTypes.join("+")}`);
    }
    return;
  }

  const sourceFiles = {
    chat: path.resolve(args["source-chat"] || ""),
    nav: path.resolve(args["source-nav"] || "")
  };
  if (!args["source-chat"] || !fs.existsSync(sourceFiles.chat)) {
    throw new Error("Provide an existing first recording with --source-chat <path>.");
  }
  if (!args["source-nav"] || !fs.existsSync(sourceFiles.nav)) {
    throw new Error("Provide an existing navigation recording with --source-nav <path>.");
  }

  await renderProfiles(selectedProfiles, sourceFiles);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
