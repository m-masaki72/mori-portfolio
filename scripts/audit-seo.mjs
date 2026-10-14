// 各サブドメインのトップページの検索向けメタ情報（OGP・JSON-LD・favicon 等）を一括チェックする
// 使い方: node scripts/audit-seo.mjs [subdomain ...]
import { readFile } from "node:fs/promises";

const ROOT = "morilab-garage.com";
const projects = JSON.parse(await readFile(new URL("./dns-projects.json", import.meta.url), "utf8"));
const args = process.argv.slice(2);
const hosts = [ROOT, ...projects.map((p) => `${p.subdomain}.${ROOT}`)].filter(
  (h) => args.length === 0 || args.some((a) => h.startsWith(a)),
);

const UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const attr = (tag, name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "is"))?.[2];
const decode = (s) => s?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

function parseHead(html) {
  const metas = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = attr(m[0], "property") ?? attr(m[0], "name");
    if (key) metas[key.toLowerCase()] = decode(attr(m[0], "content"));
  }
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => ({
    rel: attr(m[0], "rel")?.toLowerCase(),
    href: decode(attr(m[0], "href")),
    sizes: attr(m[0], "sizes"),
  }));
  const jsonld = [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => {
    try {
      return { ok: true, data: JSON.parse(m[1]) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  return {
    lang: html.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)/i)?.[1],
    title: decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()),
    metas,
    links,
    jsonld,
  };
}

// PNG / JPEG / WebP / GIF のヘッダから画像サイズを読む
function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  if (buf.length > 6 && buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1) {
    // ICO: 先頭エントリ（0 は 256px）
    return { w: buf[6] || 256, h: buf[7] || 256, ico: buf.readUInt16LE(4) };
  }
  return null;
}

async function fetchAsset(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, type: res.headers.get("content-type"), bytes: buf.length, size: res.ok ? imageSize(buf) : null, finalUrl: res.url };
  } catch (e) {
    return { status: "ERR", error: e.message };
  }
}

async function fetchText(url, redirect = "follow") {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect });
    return {
      status: res.status,
      text: await res.text(),
      finalUrl: res.url,
      type: res.headers.get("content-type"),
      location: res.headers.get("location"),
      xRobots: res.headers.get("x-robots-tag"),
    };
  } catch (e) {
    return { status: "ERR", text: "", error: e.message };
  }
}

// robots.txt の User-agent: * / Googlebot グループで path がブロックされるか（最長一致、Allow 優先）
function robotsBlocked(robotsText, path) {
  const rules = [];
  let agents = [];
  let inRules = false;
  for (const raw of robotsText.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const [k, ...rest] = line.split(":");
    const key = k?.toLowerCase();
    const val = rest.join(":").trim();
    if (key === "user-agent") {
      if (inRules) agents = [];
      inRules = false;
      agents.push(val.toLowerCase());
    } else if (key === "allow" || key === "disallow") {
      inRules = true;
      if (val && agents.some((a) => a === "*" || a === "googlebot")) rules.push({ allow: key === "allow", val });
    }
  }
  let best = null;
  for (const r of rules) {
    const re = new RegExp("^" + r.val.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    if (re.test(path) && (!best || r.val.length > best.val.length || (r.val.length === best.val.length && r.allow))) best = r;
  }
  return best && !best.allow ? best.val : null;
}

const visibleText = (html) =>
  html
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<head\b[\s\S]*?<\/head>/i, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, "")
    .length;

// sitemap（index も辿る）から loc を集める
async function sitemapLocs(url, depth = 0) {
  const sm = await fetchText(url);
  if (sm.status !== 200 || !/<(urlset|sitemapindex)/.test(sm.text)) return { ok: false, locs: [] };
  const locs = [...sm.text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => decode(m[1]));
  if (/<sitemapindex/.test(sm.text) && depth < 2) {
    const all = [];
    for (const l of locs) all.push(...(await sitemapLocs(l, depth + 1)).locs);
    return { ok: true, locs: all };
  }
  return { ok: true, locs };
}

// 個別ページの検索向けチェック（sitemap 内の全ページに適用）
async function checkPage(url, host, robotsText) {
  const issues = [];
  const p = new URL(url).pathname;
  const res = await fetchText(url, "manual");
  if (new URL(url).host !== host) issues.push(`✗ ${p}: sitemap に別ホストの URL (${url})`);
  if (res.status >= 300 && res.status < 400) return { issues: [...issues, `✗ ${p}: sitemap の URL がリダイレクト (${res.status} → ${res.location})`] };
  if (res.status !== 200) return { issues: [...issues, `✗ ${p}: ${res.status}`] };
  const h = parseHead(res.text);
  const canonical = h.links.find((l) => l.rel === "canonical")?.href;
  if (canonical && new URL(canonical, url).href !== url) issues.push(`✗ ${p}: canonical が sitemap の URL と不一致 (${canonical})`);
  if (h.metas.robots && /noindex/i.test(h.metas.robots)) issues.push(`✗ ${p}: meta robots noindex なのに sitemap に載っている`);
  if (res.xRobots && /noindex/i.test(res.xRobots)) issues.push(`✗ ${p}: X-Robots-Tag noindex`);
  if (robotsText && robotsBlocked(robotsText, p)) issues.push(`✗ ${p}: robots.txt でブロック (${robotsBlocked(robotsText, p)})`);
  if (!h.title) issues.push(`✗ ${p}: <title> なし`);
  if (!h.metas.description) issues.push(`⚠ ${p}: meta description なし`);
  if (!h.metas.viewport) issues.push(`⚠ ${p}: meta viewport なし（モバイル対応と見なされない）`);
  const h1 = (res.text.match(/<h1\b/gi) ?? []).length;
  if (h1 === 0) issues.push(`⚠ ${p}: <h1> なし（JS 描画のみの可能性）`);
  const textLen = visibleText(res.text);
  if (textLen < 200) issues.push(`⚠ ${p}: 初期 HTML の本文が ${textLen} 字（JS 描画依存。Google は描画するが評価が遅れ・弱くなりやすい）`);
  return { issues, title: h.title, description: h.metas.description };
}

const flatTypes = (data) => {
  const out = [];
  const walk = (d) => {
    if (Array.isArray(d)) return d.forEach(walk);
    if (d && typeof d === "object") {
      if (d["@type"]) out.push(d);
      if (d["@graph"]) walk(d["@graph"]);
    }
  };
  walk(data);
  return out;
};

async function audit(host, origin) {
  const base = `https://${host}/`;
  const issues = [];
  const warn = (s) => issues.push(`⚠ ${s}`);
  const ng = (s) => issues.push(`✗ ${s}`);
  const lines = [];

  const page = await fetchText(base);
  lines.push(`status: ${page.status}${page.finalUrl !== base ? ` → ${page.finalUrl}` : ""}`);
  if (page.status !== 200) {
    ng(`トップページ取得失敗 (${page.status} ${page.error ?? ""})`);
    return { host, lines, issues };
  }
  const h = parseHead(page.text);
  const m = h.metas;
  const abs = (u) => (u ? new URL(u, page.finalUrl).href : undefined);

  lines.push(`lang: ${h.lang ?? "-"}`);
  lines.push(`title: ${h.title ?? "-"} (${h.title?.length ?? 0}字)`);
  lines.push(`description: ${m.description ? `${m.description.slice(0, 60)}… (${m.description.length}字)` : "-"}`);
  if (!h.lang) warn("<html lang> なし");
  if (!h.title) ng("<title> なし");
  if (!m.description) ng("meta description なし");
  if (m.robots && /noindex/i.test(m.robots)) ng(`robots: ${m.robots}`);

  const canonical = h.links.find((l) => l.rel === "canonical")?.href;
  lines.push(`canonical: ${canonical ?? "-"}`);
  if (!canonical) warn("canonical なし");
  else if (new URL(canonical, base).host !== host) ng(`canonical が別ホスト (${canonical})`);

  // OGP
  for (const k of ["og:title", "og:description", "og:url", "og:type", "og:site_name", "twitter:card"]) {
    if (!m[k]) warn(`${k} なし`);
  }
  if (m["og:url"] && new URL(m["og:url"], base).host !== host) ng(`og:url が別ホスト (${m["og:url"]})`);
  lines.push(`og:title: ${m["og:title"] ?? "-"} / og:site_name: ${m["og:site_name"] ?? "-"} / twitter:card: ${m["twitter:card"] ?? "-"}`);

  const ogImage = m["og:image"];
  if (!ogImage) ng("og:image なし");
  else {
    if (!/^https?:\/\//.test(ogImage)) ng(`og:image が相対パス (${ogImage})`);
    const a = await fetchAsset(abs(ogImage));
    const sz = a.size ? `${a.size.w}x${a.size.h}` : "?";
    lines.push(`og:image: ${ogImage} → ${a.status} ${a.type ?? ""} ${sz} ${a.bytes ? Math.round(a.bytes / 1024) + "KB" : ""}`);
    if (a.status !== 200) ng(`og:image 取得失敗 (${a.status})`);
    else {
      if (!/^image\//.test(a.type ?? "")) ng(`og:image の Content-Type が画像でない (${a.type})`);
      if (a.size && (a.size.w < 1200 || a.size.h < 630)) warn(`og:image が小さい (${sz}, 推奨 1200x630 以上)`);
      if (a.bytes > 5 * 1024 * 1024) warn("og:image が 5MB 超");
    }
    if (m["twitter:card"] && m["twitter:card"] !== "summary_large_image") warn(`twitter:card が ${m["twitter:card"]}`);
  }

  // favicon（Google 検索結果の favicon は 48px の倍数推奨）
  const icons = h.links.filter((l) => l.rel && /(^|\s)icon(\s|$)|apple-touch-icon/.test(l.rel));
  const iconUrls = icons.length ? icons : [{ rel: "(default)", href: "/favicon.ico" }];
  let has48 = false;
  for (const ic of iconUrls) {
    const a = await fetchAsset(abs(ic.href));
    const svg = /svg/.test(a.type ?? "") || /\.svg($|\?)/.test(ic.href);
    const sz = a.size ? `${a.size.w}x${a.size.h}` : svg ? "svg" : "?";
    if (a.status === 200 && (!a.size || a.size.w === a.size.h) && (svg || (a.size && a.size.w >= 48 && a.size.w % 48 === 0) || (a.size && a.size.w >= 144))) has48 = true;
    lines.push(`icon[${ic.rel}${ic.sizes ? " " + ic.sizes : ""}]: ${ic.href} → ${a.status} ${sz}`);
    if (a.status !== 200) ng(`favicon 取得失敗 (${ic.href} ${a.status})`);
  }
  if (!has48) warn("48px の倍数で正方形（または SVG）の favicon がない（検索結果で表示されない可能性）");

  // JSON-LD
  if (h.jsonld.length === 0) warn("JSON-LD なし");
  else if (!h.jsonld.some((j) => j.ok && flatTypes(j.data).some((n) => /WebSite/.test([].concat(n["@type"]).join())))) warn("WebSite JSON-LD なし（検索結果のサイト名に使われる）");
  for (const j of h.jsonld) {
    if (!j.ok) {
      ng(`JSON-LD パースエラー: ${j.error}`);
      continue;
    }
    for (const node of flatTypes(j.data)) {
      const t = [].concat(node["@type"]).join(",");
      const keys = Object.keys(node).filter((k) => !k.startsWith("@"));
      lines.push(`JSON-LD ${t}: ${keys.join(", ")}`);
      if (/WebSite/.test(t) && !node.name) warn("WebSite に name なし（検索結果のサイト名）");
      if (/WebSite/.test(t) && node.url && new URL(node.url, base).host !== host) warn(`WebSite.url が別ホスト (${node.url})`);
      if (/Application/.test(t)) {
        if (!node.name) ng(`${t} に name なし`);
        if (!node.offers) warn(`${t} に offers なし（リッチリザルト必須）`);
        if (!node.applicationCategory) warn(`${t} に applicationCategory なし`);
        if (!node.operatingSystem) warn(`${t} に operatingSystem なし`);
      }
      if (/FAQPage/.test(t) && !Array.isArray(node.mainEntity)) ng("FAQPage に mainEntity 配列なし");
      if (node.image) {
        const img = typeof node.image === "string" ? node.image : node.image.url ?? [].concat(node.image)[0];
        if (typeof img === "string") {
          const a = await fetchAsset(abs(img));
          if (a.status !== 200) ng(`JSON-LD image 取得失敗 (${img} ${a.status})`);
        }
      }
    }
  }

  // robots.txt / sitemap
  const robots = await fetchText(`${base}robots.txt`);
  const sitemapRef = robots.text.match(/^sitemap:\s*(\S+)/im)?.[1];
  lines.push(`robots.txt: ${robots.status}${sitemapRef ? ` (Sitemap: ${sitemapRef})` : ""}`);
  if (robots.status !== 200 || /<html/i.test(robots.text)) warn("robots.txt なし");
  else if (/^disallow:\s*\/\s*$/im.test(robots.text)) ng("robots.txt に Disallow: / がある");
  else if (!sitemapRef) warn("robots.txt に Sitemap: の記載なし");
  const robotsText = robots.status === 200 && !/<html/i.test(robots.text) ? robots.text : "";

  // robots.txt で検索に必要なリソースがブロックされていないか
  const scripts = [...page.text.matchAll(/<(?:script|link)\b[^>]*(?:src|href)\s*=\s*["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi)].map((x) => x[1]);
  for (const u of [ogImage, ...iconUrls.map((i) => i.href), ...scripts].filter(Boolean)) {
    const url = new URL(u, page.finalUrl);
    if (url.host !== host) continue;
    const rule = robotsBlocked(robotsText, url.pathname);
    if (rule) ng(`robots.txt で ${url.pathname} がブロック (${rule})`);
  }

  // ヘッダ・ビューポート・本文
  if (page.xRobots) lines.push(`X-Robots-Tag: ${page.xRobots}`);
  if (page.xRobots && /noindex/i.test(page.xRobots)) ng(`X-Robots-Tag: ${page.xRobots}`);
  if (!m.viewport) warn("meta viewport なし（モバイル対応と見なされない）");
  if (!/charset/i.test(page.type ?? "") && !/<meta\b[^>]*charset/i.test(page.text)) warn("charset 指定なし");

  // http → https
  const http = await fetchText(`http://${host}/`, "manual");
  lines.push(`http://: ${http.status}${http.location ? ` → ${http.location}` : ""}`);
  if (!(http.status >= 300 && http.status < 400 && http.location?.startsWith("https://"))) warn(`http が https にリダイレクトされない (${http.status})`);
  else if (![301, 308].includes(http.status)) warn(`http→https が恒久リダイレクトでない (${http.status})`);

  // ソフト 404（存在しない URL に 200 を返すと、Google が大量の重複ページと見なす）
  const nf = await fetchText(`${base}this-page-does-not-exist-${Date.now()}`, "manual");
  lines.push(`存在しないURL: ${nf.status}${nf.location ? ` → ${nf.location}` : ""}`);
  if (nf.status === 200) {
    const nh = parseHead(nf.text);
    const nfCanonical = nh.links.find((l) => l.rel === "canonical")?.href;
    warn(`存在しない URL が 200 を返す（ソフト404）${nfCanonical ? ` canonical=${nfCanonical}` : ""}`);
  }

  // 公開元（*.pages.dev / github.io）がカスタムドメインと重複してインデックスされないか
  if (origin && origin.endsWith(".pages.dev")) {
    const o = await fetchText(`https://${origin}/`, "manual");
    if (o.status === 200) {
      const oc = parseHead(o.text).links.find((l) => l.rel === "canonical")?.href;
      const noindex = /noindex/i.test(o.xRobots ?? "");
      const canonicalOk = oc && new URL(oc, `https://${origin}/`).host === host;
      lines.push(`公開元 ${origin}: 200 (canonical=${oc ?? "-"}${noindex ? ", X-Robots-Tag: noindex" : ""})`);
      if (!noindex && !canonicalOk) ng(`${origin} が同じ内容を 200 で配信し canonical もカスタムドメインを向いていない（重複インデックス）`);
      else if (!noindex) warn(`${origin} に X-Robots-Tag: noindex がない（canonical で回避済み。_headers で付けると確実）`);
    } else lines.push(`公開元 ${origin}: ${o.status}${o.location ? ` → ${o.location}` : ""}`);
  }

  // sitemap と、そこに載っている全ページ
  const smUrl = sitemapRef ?? `${base}sitemap.xml`;
  const sm = await sitemapLocs(smUrl);
  lines.push(`sitemap: ${smUrl} → ${sm.ok ? `${sm.locs.length} URL` : "なし"}`);
  if (!sm.ok) warn("sitemap なし");
  else {
    if (!sm.locs.some((l) => l === base || l === base.slice(0, -1))) warn("sitemap にトップページがない");
    const pages = [];
    for (const loc of sm.locs.slice(0, 100)) pages.push(await checkPage(loc, host, robotsText));
    for (const pg of pages) issues.push(...pg.issues);
    for (const key of ["title", "description"]) {
      const seen = new Map();
      for (const [i, pg] of pages.entries()) if (pg[key]) seen.set(pg[key], [...(seen.get(pg[key]) ?? []), new URL(sm.locs[i]).pathname]);
      for (const [v, ps] of seen) if (ps.length > 1) warn(`${key} が ${ps.length} ページで重複「${v.slice(0, 30)}」 (${ps.join(", ")})`);
    }
  }

  return { host, lines, issues: [...new Set(issues)] };
}

const origins = Object.fromEntries(projects.map((p) => [`${p.subdomain}.${ROOT}`, p.target]));
const results = await Promise.all(hosts.map((h) => audit(h, origins[h])));
let total = 0;
for (const r of results) {
  console.log(`\n=== ${r.host} ===`);
  for (const l of r.lines) console.log(`  ${l}`);
  if (r.issues.length === 0) console.log("  ✓ 問題なし");
  for (const i of r.issues) console.log(`  ${i}`);
  total += r.issues.length;
}
console.log(`\n${results.length} サイト / 指摘 ${total} 件`);
