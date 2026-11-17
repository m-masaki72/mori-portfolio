"""Search Console API でインデックス状況を調べ、sitemap を送信する。

使い方:
  python scripts/search_console.py sites                 # 見られるプロパティの一覧
  python scripts/search_console.py inspect               # 本番 sitemap の全 URL のインデックス状況
  python scripts/search_console.py inspect <URL> ...     # 指定した URL だけ
  python scripts/search_console.py sitemaps              # 送信済み sitemap の状態
  python scripts/search_console.py submit                # sitemap-index.xml を送信し直す
  --site <プロパティ>  で対象を変える（既定は morilab-garage.com を含むもの。sc-domain: を優先）

認証は共有 OAuth クライアント ~/.claude/credentials/youtube_client_secret.json を使う（新規作成しない）。
トークンは youtube_token_search-console.json。初回はブラウザが開くので、Search Console の所有者のアカウントでログインする。
GCP プロジェクトで「Google Search Console API」が無効だとエラーになるので、出てきた URL から有効にする。
「インデックス登録をリクエスト」は API に無い（ブラウザの URL 検査からのみ）。
URL 検査の上限は 1プロパティ 2000件/日・600件/分。
"""

import argparse
import json
import os
import re
import sys
import tempfile
import urllib.request
from collections import Counter

import google_auth_oauthlib.flow
import googleapiclient.discovery
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

CLIENT_SECRET_FILE = os.path.expanduser("~/.claude/credentials/youtube_client_secret.json")
TOKEN_FILE = os.path.expanduser("~/.claude/credentials/youtube_token_search-console.json")
# sitemap の送信に書き込み権限が要るので webmasters（読み取り専用の .readonly では submit できない）
SCOPES = ["https://www.googleapis.com/auth/webmasters"]
ORIGIN = "https://morilab-garage.com"
SITEMAP = f"{ORIGIN}/sitemap-index.xml"


def write_json_atomic(path, data):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f)
    os.replace(tmp, path)


def get_service():
    if not os.path.exists(CLIENT_SECRET_FILE):
        sys.exit(f"client_secret が見つかりません: {CLIENT_SECRET_FILE}")
    creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES) if os.path.exists(TOKEN_FILE) else None
    if not creds or not creds.valid:
        refreshed = False
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                refreshed = True
            except RefreshError:
                print("トークンが失効しています。ブラウザで認証し直してください")
        if not refreshed:
            flow = google_auth_oauthlib.flow.InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        write_json_atomic(TOKEN_FILE, json.loads(creds.to_json()))
    return googleapiclient.discovery.build("searchconsole", "v1", credentials=creds)


def list_sites(sc):
    return sorted(s["siteUrl"] for s in sc.sites().list().execute().get("siteEntry", []))


def pick_site(sc, wanted):
    sites = list_sites(sc)
    if wanted:
        if wanted not in sites:
            sys.exit(f"プロパティ {wanted} がありません。見られるもの: {sites}")
        return wanted
    for s in ("sc-domain:morilab-garage.com", f"{ORIGIN}/"):
        if s in sites:
            return s
    sys.exit(f"morilab-garage.com のプロパティが見つかりません。ログインしたアカウントを確認してください。見られるもの: {sites}")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "mori-portfolio-search-console"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def sitemap_urls(url=SITEMAP):
    """sitemap-index なら子の sitemap も辿って、ページの URL を全部返す"""
    xml = fetch(url)
    locs = re.findall(r"<loc>([^<]+)</loc>", xml)
    if "<sitemapindex" in xml:
        return [u for child in locs for u in sitemap_urls(child)]
    return locs


def cmd_inspect(sc, site, urls):
    urls = urls or sitemap_urls()
    counts = Counter()
    rows = []
    for i, url in enumerate(urls, 1):
        res = sc.urlInspection().index().inspect(body={"inspectionUrl": url, "siteUrl": site, "languageCode": "ja"}).execute()
        idx = res["inspectionResult"].get("indexStatusResult", {})
        state = idx.get("coverageState", "?")
        counts[state] += 1
        crawled = (idx.get("lastCrawlTime") or "")[:10] or "-"
        rows.append((state, crawled, url.replace(ORIGIN, "")))
        print(f"\r{i}/{len(urls)}", end="", file=sys.stderr, flush=True)
    print(file=sys.stderr)
    for state, crawled, path in sorted(rows):
        print(f"{crawled}\t{state}\t{path}")
    print("\n--- 集計 ---")
    for state, n in counts.most_common():
        print(f"{n:4d}  {state}")


def cmd_sitemaps(sc, site):
    for s in sc.sitemaps().list(siteUrl=site).execute().get("sitemap", []):
        contents = ", ".join(f"{c.get('type')} 送信{c.get('submitted')}" for c in s.get("contents", []))
        print(f"{s['path']}\t最終送信 {s.get('lastSubmitted', '-')[:10]}\t最終読込 {s.get('lastDownloaded', '-')[:10]}"
              f"\tエラー{s.get('errors', 0)} 警告{s.get('warnings', 0)}\t{contents}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["sites", "inspect", "sitemaps", "submit"])
    ap.add_argument("urls", nargs="*")
    ap.add_argument("--site")
    args = ap.parse_args()
    sc = get_service()
    if args.command == "sites":
        print("\n".join(list_sites(sc)))
        return
    site = pick_site(sc, args.site)
    print(f"プロパティ: {site}", file=sys.stderr)
    if args.command == "inspect":
        cmd_inspect(sc, site, args.urls)
    elif args.command == "sitemaps":
        cmd_sitemaps(sc, site)
    elif args.command == "submit":
        sc.sitemaps().submit(siteUrl=site, feedpath=SITEMAP).execute()
        print(f"送信しました: {SITEMAP}")


if __name__ == "__main__":
    main()
