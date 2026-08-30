const dns = require("node:dns").promises;
const net = require("node:net");
const { Readable } = require("node:stream");

function isPrivateAddress(address) {
  if (!address) return true;
  if (net.isIPv4(address)) {
    const parts = address.split(".").map(Number);
    return parts[0] === 0
      || parts[0] === 10
      || parts[0] === 127
      || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
      || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || parts[0] >= 224;
  }
  const normalized = address.toLowerCase().split("%")[0];
  return normalized === "::" || normalized === "::1"
    || normalized.startsWith("fc") || normalized.startsWith("fd")
    || normalized.startsWith("fe8") || normalized.startsWith("fe9")
    || normalized.startsWith("fea") || normalized.startsWith("feb")
    || normalized.startsWith("::ffff:127.")
    || normalized.startsWith("::ffff:10.")
    || normalized.startsWith("::ffff:192.168.");
}

async function assertPublicUrl(value) {
  const target = new URL(value);
  if (!/^https?:$/.test(target.protocol)) throw new Error("unsupported protocol");
  if (target.username || target.password) throw new Error("credentials are not allowed");
  const hostname = target.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) throw new Error("private host");
  const addresses = net.isIP(hostname) ? [{ address: hostname }] : await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error("private address");
  return target;
}

async function fetchPublicMedia(initialUrl, rangeHeader) {
  let target = await assertPublicUrl(initialUrl);
  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    const controller = new AbortController();
    const headerTimeout = setTimeout(() => controller.abort(), 20000);
    let upstream;
    try {
      upstream = await fetch(target, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "image/*,video/*,audio/*,application/octet-stream;q=0.8,*/*;q=0.5",
          ...(rangeHeader ? { Range: rangeHeader } : {})
        }
      });
    } finally {
      clearTimeout(headerTimeout);
    }
    if (![301, 302, 303, 307, 308].includes(upstream.status)) return upstream;
    const location = upstream.headers.get("location");
    if (!location) throw new Error("redirect without location");
    target = await assertPublicUrl(new URL(location, target).href);
  }
  throw new Error("too many redirects");
}

function safeFileName(value) {
  return String(value || "VinaAI-download")
    .replace(/[\r\n\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 120) || "VinaAI-download";
}

module.exports = async function mediaDownload(request, response) {
  // 2026-08-16 新增逻辑：服务端流式读取公开媒体并以 attachment 返回，解决浏览器对外部图片和视频的 CORS/下载属性限制。
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const mediaUrl = Array.isArray(request.query.url) ? request.query.url[0] : request.query.url;
    if (!mediaUrl || mediaUrl.length > 8192) throw new Error("invalid media url");
    const fileName = safeFileName(Array.isArray(request.query.filename) ? request.query.filename[0] : request.query.filename);
    const upstream = await fetchPublicMedia(mediaUrl, request.headers.range);
    if (!upstream.ok && upstream.status !== 206) throw new Error(`upstream ${upstream.status}`);

    response.statusCode = upstream.status;
    response.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    response.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    response.setHeader("Cache-Control", "private, no-store");
    ["content-length", "content-range", "accept-ranges"].forEach((header) => {
      const value = upstream.headers.get(header);
      if (value) response.setHeader(header, value);
    });
    if (!upstream.body) {
      response.end();
      return;
    }
    Readable.fromWeb(upstream.body).on("error", () => response.destroy()).pipe(response);
  } catch (error) {
    if (!response.headersSent) response.status(502).json({ error: "media_download_failed" });
    else response.destroy();
  }
};
