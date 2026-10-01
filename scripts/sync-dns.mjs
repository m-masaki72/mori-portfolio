// Cloudflare DNS を scripts/dns-projects.json の内容に同期する。
// CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID を .env に書くか環境変数で指定する。
// 使い方: npm run sync-dns [-- --dry-run]（.env を自動で読み込む）

import { readFileSync } from 'fs';

const ROOT_DOMAIN = 'morilab-garage.com';
const CONFIG_PATH = new URL('./dns-projects.json', import.meta.url);
const API_BASE = 'https://api.cloudflare.com/client/v4';

const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const dryRun = process.argv.includes('--dry-run');

if (!token || !zoneId) {
  console.error('CLOUDFLARE_API_TOKEN と CLOUDFLARE_ZONE_ID を環境変数で指定してください。');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

async function cf(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await res.json();
  if (!body.success) {
    throw new Error(`Cloudflare API error: ${JSON.stringify(body.errors)}`);
  }
  return body.result;
}

async function listRecords() {
  const records = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `${API_BASE}/zones/${zoneId}/dns_records?type=CNAME&per_page=100&page=${page}`,
      { headers },
    );
    const body = await res.json();
    if (!body.success) throw new Error(`Cloudflare API error: ${JSON.stringify(body.errors)}`);
    records.push(...body.result);
    if (page >= body.result_info.total_pages) break;
    page += 1;
  }
  return records;
}

function validateEntry(entry) {
  if (typeof entry.subdomain !== 'string' || !entry.subdomain) {
    throw new Error(`不正な subdomain: ${JSON.stringify(entry)}`);
  }
  if (typeof entry.target !== 'string' || !entry.target) {
    throw new Error(`不正な target: ${JSON.stringify(entry)}`);
  }
  if (typeof entry.proxied !== 'boolean') {
    throw new Error(`proxied は boolean で指定してください: ${JSON.stringify(entry)}`);
  }
}

async function upsertRecord(existing, entry) {
  const name = `${entry.subdomain}.${ROOT_DOMAIN}`;
  const payload = {
    type: 'CNAME',
    name,
    content: entry.target,
    proxied: entry.proxied,
    ttl: 1,
  };

  const current = existing.find((r) => r.name === name);

  if (current) {
    if (current.content === entry.target && current.proxied === entry.proxied) {
      console.log(`= 変更なし: ${name} → ${entry.target}`);
      return;
    }
    console.log(`~ 更新: ${name} → ${entry.target} (proxied=${entry.proxied})`);
    if (!dryRun) await cf(`/zones/${zoneId}/dns_records/${current.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return;
  }

  console.log(`+ 新規作成: ${name} → ${entry.target} (proxied=${entry.proxied})`);
  if (!dryRun) await cf(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

const entries = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));

for (const entry of entries) {
  validateEntry(entry);
}

for (const entry of entries) {
  if (!entry.proxied) {
    console.warn(`! 注意: ${entry.subdomain} は proxied=false（GitHub Pages 等は DNS のみ必須）`);
  }
}

if (dryRun) console.log('--- dry-run モード: 実際の変更は行いません ---');

const existing = await listRecords();
for (const entry of entries) {
  await upsertRecord(existing, entry);
}

console.log('完了');
