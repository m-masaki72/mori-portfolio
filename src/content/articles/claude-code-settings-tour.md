---
title: "私の Claude Code 設定ツアー（settings.json・グローバル CLAUDE.md・hooks・statusline）"
description: "毎日の個人開発で使っている Claude Code の設定を一通り紹介します。settings.json の permissions・hooks・モデル設定、グローバル CLAUDE.md に書いているルール、キー割り当てとプラグインまで、何をなぜそう設定しているかをまとめました。"
pubDate: 2026-10-14
updatedDate: 2026-10-21
tags: ["Claude Code", "設定"]
---
個人開発のほぼすべてを Claude Code と一緒に進めています。設定は、困ったことが起きるたびに少しずつ足してきたものです。

この記事では、今の設定を一通り紹介します。個別の設定は別の記事で詳しく書いているので、ここでは全体の地図として、**何をどこに書いているか** と **なぜそうしたか** を中心にまとめます。

**環境**：Windows 10 / Windows Terminal / Claude Code 2.1.296

## 全体像

| ファイル | 書いていること |
|---|---|
| `~/.claude/settings.json` | 権限（allow / deny）、hooks、statusline、モデルと思考の量、自動 compact |
| `~/CLAUDE.md`（ホーム直下） | 応答の言語、モデルの使い分け、Windows の落とし穴、セキュリティのルール |
| `~/.claude/keybindings.json` | Enter で改行・Ctrl+Enter で送信 |
| `~/.claude/hooks/` | 危険な git 操作を止めるスクリプト |
| `~/.claude/statusline.js` | 利用上限とコンテキストの使用率を表示 |
| 各リポジトリの `CLAUDE.md` | そのプロジェクトの構成・コマンド・決まりごと |

グローバルには **どのプロジェクトでも同じこと** だけを書き、プロジェクト固有の話は各リポジトリの CLAUDE.md に分けています。リポジトリ側の CLAUDE.md・README・PROGRESS.md の分け方は [Claude Code 向けのドキュメントは3つに分ける](/articles/claude-code-docs-split/) に書きました。

Claude Code 本体はネイティブ版で入れています。npm 版から移ったときの話は [npm 版の Claude Code は更新が遅いと思って移行したら、原因は自分の設定だった](/articles/claude-code-npm-to-native/) にあります。

## settings.json

### 権限：よく使うコマンドは許可、秘密情報は拒否

`permissions.defaultMode` は `auto` にしています。許可リストにないコマンドは、自動の判定にかけられ、危なそうなものだけ止まります。

許可リスト（`allow`）には、毎日使う開発ツールを入れています。

```json
"allow": [
  "Bash(git *)", "Bash(gh *)", "Bash(npm *)", "Bash(npx *)",
  "Bash(python *)", "Bash(python3 *)", "Bash(uv *)",
  "Bash(dotnet *)", "Bash(cmake *)", "Bash(pluginval *)",
  "Bash(gcloud builds list *)", "Bash(gcloud logging read *)",
  "WebFetch", "WebSearch"
]
```

（抜粋です）

ポイントは **gcloud だけは読み取り系のサブコマンドに限っている** ことです。`list`・`describe`・`logging read` は許可していますが、デプロイや削除は毎回確認が入ります。クラウドの変更は取り返しがつかないので、ここは細かく分けています。

拒否リスト（`deny`）には、`.env` と `credentials` フォルダを読む操作を並べています。ただ、Bash コマンドのパターン指定はすり抜けを防ぎきれません。詳しくは [Claude Code に .env を読ませない deny 設定と、その限界](/articles/claude-code-deny-env/) に書きました。

auto mode が実際に何を止めたのかは1か月分を数えました。「今後は確認しない」で増えていく許可ルールの整理も別の記事にしています。

- [Claude Code の auto mode に止められた操作を1か月分集計した](/articles/claude-code-auto-mode-denials/)
- [Claude Code の settings.local.json に許可ルールが879件溜まっていた](/articles/claude-code-settings-local-pileup/)

### hooks：危険な git 操作を止める

`PreToolUse` フックで、Bash を実行する前にスクリプトを通しています。

```json
"hooks": {
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        { "type": "command", "command": "bash C:/Users/<ユーザー名>/.claude/hooks/block-dangerous.sh", "shell": "bash" }
      ]
    }
  ]
}
```

Claude Code が実行した `git clean` で `.env` が消えたのがきっかけです。`git clean`・force push・`reset --hard` などを止めています。スクリプトの中身は [Claude Code の危険な git 操作を hooks で止める](/articles/claude-code-hooks-block-dangerous-git/) にあります。

### statusline：利用上限とコンテキストを常に見る

```json
"statusLine": { "type": "command", "command": "node C:/Users/<ユーザー名>/.claude/statusline.js" }
```

5時間・7日の利用上限の使用率、コンテキストの使用率、モデル名をバーで出しています。最初は PowerShell で書いていましたが、起動が遅くて表示が消えるので Node.js に書き直しました。

- [私の Claude Code statusline 設定](/articles/claude-code-statusline/)
- [Claude Code の statusLine が表示されない原因は PowerShell の起動遅延](/articles/claude-code-statusline-powershell-slow/)

### モデルと思考の量

```json
"model": "opus",
"effortLevel": "high",
"alwaysThinkingEnabled": false
```

普段は Opus を使い、思考の量（effort）は high にしています。軽い作業では、会話の中でモデルを切り替えます。使い分けの基準は CLAUDE.md に表で書いています（後述）。特定のバージョンに固定したいときの設定は [Claude Code でモデルバージョンを固定する方法まとめ](/articles/claude-code-pin-model-version/) にあります。

### 自動 compact を少し遅らせる

```json
"env": { "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "85" },
"autoCompactEnabled": true
```

コンテキストが埋まると、会話が自動で要約（compact）されます。要約のたびに細かい経緯は落ちるので、**85% まで使ってから要約する** ようにしています。何を残してほしいかは、CLAUDE.md の「Compact」の節に書いています。compact で何が残って何が落ちるかは [Claude Code の会話は30日で消え、compact で要約される](/articles/claude-code-memory-compact/) で確かめました。

### 見た目

```json
"tui": "fullscreen",
"theme": "dark-daltonized"
```

画面全体を使う表示にしています。テーマは、色覚の違いに配慮した `dark-daltonized` です。差分の赤と緑が見分けやすくなります。

### プラグイン

公式のプラグインのうち、有効にしているのは2つだけです。

- **pr-review-toolkit**：コードレビュー用のエージェントがまとまっている。実装のあとに見てもらう
- **security-guidance**：危なそうなコードを書いたときに注意を出す。ただし誤反応も多い → [security-guidance フックは何に反応したか](/articles/claude-code-security-guidance-false-positives/)

レビューの強度（effort）は省略すると前回の値が使われます → [/code-review は、強度を省略すると前回の値を使う](/articles/claude-code-code-review-effort/)

ほかにも入れてはいますが、普段は切っています。有効にするほど、毎回の会話に読み込まれる説明が増えるからです。

## グローバル CLAUDE.md

`~/CLAUDE.md` はホーム直下に置いています。Claude Code は作業ディレクトリの親フォルダにある `CLAUDE.md` も読むので、ホームの下にあるプロジェクトならどれでも最初に読まれます（ユーザー共通の置き場所として公式に案内されているのは `~/.claude/CLAUDE.md` です）。書いているのは次のような内容です。

| 節 | 内容 |
|---|---|
| 絶対ルール | 応答はすべて日本語。途中の短い報告も含めて |
| Model Selection | 作業の種類と難しさで Haiku / Sonnet / Opus を選ぶ表 |
| Conventions | 実行してほしいコマンドは1行で示す。git の commit・push は確認なしでよい。完了報告の前にビルドやテストで確かめる |
| Environment & Shell Gotchas | ヒアドキュメントを使わない、CRLF に注意、止めたはずの子プロセスを確認する |
| Security | `.env` を読まない、機密データはディスクに保存しない、書き込みは一時ファイル＋置き換え |
| Auto Mode 許可リスト運用 | 止められたコマンドを、汎用的なパターンにして許可リストへ足すか確認する |
| Compact | 要約のときに残してほしいもの（今の目的・変更内容・未解決のエラー） |

特に効いているのは次の3つです。

**「完了報告の前に確かめる」**：これを書く前は、ビルドを通さずに「できました」と言われることがありました。今はビルドやテストの結果まで付けて報告してくれます。

**Windows の落とし穴**：Claude Code の Bash ツールは Git Bash なので、Windows ならではの失敗が起きます。同じ失敗を繰り返さないよう、踏んだものを書き足しています。→ [Windows で Claude Code を使うときのハマりどころ](/articles/claude-code-windows-pitfalls/)

**モデルの使い分け**：→ [Claude Code でタスクの難しさによってモデルを使い分ける](/articles/claude-code-model-selection/)

ちなみに、応答の口調をキャラクターに寄せる指定も入れています。長時間の作業でも、報告を読むのが少し楽しくなります。

## キー割り当て

`~/.claude/keybindings.json` で、Enter を改行、Ctrl+Enter を送信にしています。ほかのチャットツールと送信キーをそろえたかったからです。

```json
{
  "bindings": [
    {
      "context": "Chat",
      "bindings": {
        "enter": "chat:newline",
        "ctrl+enter": "chat:submit"
      }
    }
  ]
}
```

経緯とハマりどころは [Claude Code を「Ctrl+Enter / Cmd+Enter で送信」にする](/articles/claude-code-ctrl-enter-send/) にまとめています。

## スキルとメモリ

- **スキル**：複数のリポジトリで使う手順は `~/.claude/skills/` にスキルとして置いています。たとえば YouTube API の認証情報の扱いは、スキルにまとめて「新しい OAuth クライアントは作らない」と書いています。アプリごとに認証情報が増えていくのを防ぐためです
- **メモリ**：プロジェクトごとのメモリ（`~/.claude/projects/<プロジェクト>/memory/`）に、コードからは分からない状況を残してもらっています。「このリポジトリは非公開のまま」「AdSense の審査状況」などです。会話が変わっても前提を説明し直さずに済みます

## 設定を育てるときの考え方

- **困ったら、その場で設定に足す**：同じ注意を2回したら CLAUDE.md に書く。危ない操作が起きたら hooks か deny で止める
- **グローバルとプロジェクトを分ける**：どこでも同じことだけをグローバルに書く
- **言葉のルールと仕組みの制限を重ねる**：CLAUDE.md の「.env を読まない」は守られないこともあります。deny や hooks の仕組みと組み合わせています

設定はこれからも変わっていくので、大きく変わったらまた書きます。
