---
title: "YouTube への動画アップロードを API で自動化し、OAuth クライアントを複数のアプリで使い回す"
description: "自作アプリの紹介動画を、YouTube Data API で予約投稿しています。OAuth クライアントは1つだけ作って全アプリで共有し、トークンはアプリごとに分けました。クォータ（1日10,000ユニット）の範囲で何本まで上げられるか、二重アップロードの防ぎ方、Claude Code に覚えさせた置き場所のルールをまとめます。"
pubDate: 2026-10-17
tags: ["YouTube", "Python", "Google API", "Claude Code"]
---
自作アプリの紹介動画（Remotion で作ったもの）を YouTube に上げています。[HeatDesk](/projects/heatdesk/) の紹介動画、TaktKey のショート9本、別のアプリのショート4本です。

ショートを数日おきに1本ずつ手で上げるのは面倒なので、YouTube Data API で **アップロードと予約公開** をまとめてやるスクリプトを Claude Code に書いてもらいました。アプリが増えるたびに同じことをするので、認証情報を使い回す形に落ち着いています。

**環境**：Windows 10 / Python 3 / google-api-python-client・google-auth-oauthlib / Claude Code

## 認証情報の置き方

YouTube に動画を上げるには、OAuth の認証が要ります。最初は、アプリごとに GCP で OAuth クライアントを作るつもりでした。でも、投稿先のチャンネルが同じなら、クライアントは1つで足ります。

そこで、次の置き方にしました。

| ファイル | 中身 | 数 |
|---|---|---|
| `~/.claude/credentials/youtube_client_secret.json` | OAuth クライアント（デスクトップアプリ） | 1つ（全アプリ共通） |
| `~/.claude/credentials/youtube_token_<アプリ名>.json` | 許可したあとのトークン | アプリごと |

- **クライアントは共通**：GCP のコンソールで作るのは1回だけ
- **トークンはアプリごと**：アプリによって投稿先のチャンネルを変えられます。スコープ（権限）を変えたいときも、そのアプリのトークンだけ作り直せば済みます
- **リポジトリの外に置く**：どのリポジトリにも入らないので、うっかりコミットする心配がありません

HeatDesk のスクリプトは、最初はリポジトリの中にクライアントを置く作りでした。あとから共通の場所を読むように直し、`.gitignore` の除外も要らなくなりました。

## Claude Code にルールとして覚えさせる

新しいアプリで動画を上げるとき、Claude Code は放っておくと「GCP で OAuth クライアントを作ってください」と案内してきます。そこで、置き場所のルールを **スキル**（`~/.claude/skills/youtube-credentials/SKILL.md`）に書きました。

```md
---
name: youtube-credentials
description: YouTube Data API v3 の既存OAuthクライアント・トークン配置ルール。YouTube動画アップロード等を実装するときに参照する
---

- OAuthクライアント（デスクトップアプリ種別）は ~/.claude/credentials/youtube_client_secret.json に既存。
  新規プロジェクトでもまずこれを参照し、GCPコンソールでの新規作成は行わない
- トークンはプロジェクトごとに分離: ~/.claude/credentials/youtube_token_<project>.json
- 参照実装: （既存のアップロードスクリプトのパス）
- このディレクトリの一覧表示・cat は auto mode の認証情報保護でブロックされる。
  パスの存在を前提にコードを書き、実行時に検証すること
```

グローバルの `CLAUDE.md` にも「YouTube API の認証情報は `youtube-credentials` スキル参照（新規 OAuth クライアントは作らない）」と1行だけ書いています。これで、3つ目のアプリからは何も言わなくても共通のクライアントを使うようになりました。

最後の行は、実際に困ったことです。Claude が「ファイルがあるか確かめます」と `ls` しようとすると、auto mode に止められます。認証情報のフォルダを覗く操作として扱われるからです。「中は見なくていいので、パスがある前提で書いて、実行時に確かめて」と書いておくと、止められずに進みます。

## アップロードの最小コード

基本の形はこうです（実際のスクリプトを短くしたものです）。

```python
import os, tempfile
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

CRED_DIR = os.path.expanduser("~/.claude/credentials")
CLIENT_SECRET = os.path.join(CRED_DIR, "youtube_client_secret.json")
TOKEN = os.path.join(CRED_DIR, "youtube_token_myapp.json")  # アプリごとに変える
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]

def get_service():
    creds = Credentials.from_authorized_user_file(TOKEN, SCOPES) if os.path.exists(TOKEN) else None
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # 初回だけブラウザが開く。投稿先チャンネルのアカウントで許可する
            creds = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET, SCOPES).run_local_server(port=0)
        fd, tmp = tempfile.mkstemp(dir=CRED_DIR)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(creds.to_json())
        os.replace(tmp, TOKEN)  # 書きかけのトークンを残さない
    return build("youtube", "v3", credentials=creds)

def upload(youtube, path, title, description, publish_at):
    body = {
        "snippet": {"title": title, "description": description, "categoryId": "28"},
        # 予約公開は private ＋ publishAt（UTC）
        "status": {"privacyStatus": "private", "publishAt": publish_at, "selfDeclaredMadeForKids": False},
    }
    media = MediaFileUpload(path, mimetype="video/mp4", resumable=True)
    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)
    response = None
    while response is None:
        _, response = request.next_chunk()
    return response["id"]
```

ポイントは次のとおりです。

- **予約公開は `privacyStatus: "private"` と `publishAt` の組み合わせ**。`publishAt` は UTC で書きます。日本時間の18時なら `09:00:00Z` です
- **トークンは一時ファイルに書いてから置き換える**。書いている途中で落ちても、壊れたトークンが残りません
- **カテゴリ 28** は「科学と技術」です

## 何本まで上げられるか（クォータ）

YouTube Data API には、1日あたりのクォータ（既定で10,000ユニット）があります。スクリプトを書いた時点のドキュメントでは、動画のアップロードは **1本で1,600ユニット** でした。

つまり、**1日に上げられるのは6本まで**（9,600ユニット）です。TaktKey のショートは9本あったので、1回では上げきれません。

そこで、スクリプトに次の仕組みを入れてもらいました。

- **1回の実行で6本までにして、そこで止める**
- **上げ終わった動画は記録する**（動画ごとに `.uploaded` ファイルを作り、動画 ID と公開予定日時を書く）
- **再実行すると、記録のない動画から続ける**

翌日にもう一度実行すれば、残りの3本が上がります。

ひとつ気をつけたいのは、公開日時の決め方です。このスクリプトは「実行した時刻＋3日×何本目か」で公開日時を決めていました。翌日に続きを実行すると基準の時刻が1日ずれるので、6本目と7本目の間だけ4日空きます。間隔をきっちりそろえたいなら、公開日時は最初から固定の日付で書いておくほうが安全です。別のアプリのショート4本では、公開日時を動画ごとに固定で書く形にしました。

## 二重アップロードを防ぐ

アップロードの途中でエラーになったり、スクリプトを2回実行してしまったりすると、同じ動画が2本上がります。YouTube は同じファイルでも別の動画として受け付けるので、気づかないうちに重複します。

そこで、上がった動画の ID をすぐに記録して、記録があるものは飛ばすようにしています。

```python
state = json.load(open(STATE_FILE, encoding="utf-8")) if os.path.exists(STATE_FILE) else {}
for v in variants:
    if v in state:
        print(f"{v}: 登録済み https://youtu.be/{state[v]}（スキップ）")
        continue
    state[v] = upload(youtube, ...)
    atomic_write_json(STATE_FILE, state)  # 1本ごとに保存する
```

1本ごとに保存しておけば、途中で落ちても、上がった分だけが記録に残ります。

この記録は、あとでサムネイルを設定するスクリプトでも使います。動画 ID を探し直さずに済みます。

## 予約が生きているかを確かめる

ドキュメントには、**未審査の API プロジェクトからアップロードした動画は、非公開に制限される** という注意があります（2020年7月28日以降に作ったプロジェクトが対象）。予約したつもりでも、公開日時になっても非公開のまま、ということが起こりえます。

そこで、アップロードのあとに動画の状態を読み出して表示するようにしました。スコープに `youtube.readonly` を足して、`videos().list` で `privacyStatus`・`publishAt`・`rejectionReason` を見ます。

```python
items = youtube.videos().list(part="status,snippet", id=",".join(ids)).execute().get("items", [])
for item in items:
    s = item["status"]
    print(item["id"], s.get("privacyStatus"), s.get("publishAt"), s.get("rejectionReason"))
```

`publishAt` が空になっていたら、予約が外れています。

なお、スコープを足すと、既存のトークンでは足りなくなります。そのアプリのトークンだけを作り直せばいいので、トークンをアプリごとに分けておいてよかったところです。

## サムネイル

サムネイルは、アップロードのあとに `thumbnails().set` で設定します。画像は Remotion の `npx remotion still` で、動画の代表的なコマを書き出しました。

ただ、ショートのフィードでは、カスタムサムネイルより動画のコマが優先されることがあります。カスタムサムネイルが効くのは、主にチャンネルページ・検索・関連動画です。

## まとめ

- OAuth クライアントは1つだけ作って全アプリで共有し、トークンはアプリごとに分ける
- 置き場所のルールはスキルに書いて、Claude Code に新しいクライアントを作らせない
- 予約公開は `private` ＋ `publishAt`（UTC）
- アップロードは1本1,600ユニットなので、1日6本まで。上げた動画を記録して、翌日に続きから再開する
- 動画 ID は1本ごとに保存して、二重アップロードを防ぐ
- 未審査プロジェクトの制限に備えて、予約後に状態を読み出して確かめる

## 参考文献

- [Videos: insert - YouTube Data API](https://developers.google.com/youtube/v3/docs/videos/insert)
- [Quota Calculator - YouTube Data API](https://developers.google.com/youtube/v3/determine_quota_cost)
- [Thumbnails: set - YouTube Data API](https://developers.google.com/youtube/v3/docs/thumbnails/set)
- [Skills - Claude Code Docs](https://code.claude.com/docs/en/skills)
