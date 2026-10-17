---
title: "PC のスリープを Claude Code に任せる（長いジョブの間は止めて、終わったら眠らせる）"
description: "ローカル GPU の長時間ジョブが、夜中に PC がスリープして止まっていました。Claude Code に「ジョブの間だけスリープを止める」「終わったらスリープさせる」を任せたときの方法と、スリープ防止が3日間残って自動スリープが効かなくなった失敗をまとめます。"
pubDate: 2026-10-17
tags: ["Claude Code", "Windows"]
---
ローカルの GPU で、画像の大量生成や LoRA の学習を Claude Code に回してもらうことがよくあります。数時間かかるので、寝る前に始めて朝に結果を見るのが理想です。

ところが朝起きると、ジョブが途中で止まっていることがありました。原因は **PC のスリープ** です。

- 画像1000枚の生成が、781枚目のあたりで止まっていた
- LoRA の学習が、夜中の3:00から10:20まで止まっていた

そこで、スリープまわりを Claude Code に任せることにしました。やってもらっていることは2つです。

1. ジョブが動いている間だけ、スリープを止める
2. 作業が終わったら、PC をスリープさせる

**環境**：Windows 10 / Git Bash / Claude Code 2.1.302

## 1. ジョブの間だけスリープを止める

### 最初に試してうまくいかなかったこと

Claude にいくつか方法を試してもらいましたが、最初はどれもいまひとつでした。

| 方法 | 結果 |
|---|---|
| 電源設定（`powercfg`）でスリープを「なし」にする | 効くが、戻し忘れるとずっとスリープしなくなる |
| `powercfg /requestsoverride` で特定のプロセスだけ例外にする | 管理者権限が必要で、Claude からは実行できない |
| 定期的にマウスを 1px 動かす | PowerShell 7 では `System.Windows.Forms` を読み込めず失敗 |
| 別ウィンドウの PowerShell でスリープを止め続ける | 自分でウィンドウを閉じてしまい、いつの間にか止まっていた |

### 落ち着いた方法：`SetThreadExecutionState` と PID の見張り

最終的には、Windows の API `SetThreadExecutionState` を Python から呼ぶ小さなスクリプトになりました。管理者権限は要りません。

```python
"""指定した PID のプロセスが動いている間、スリープを止める。
使い方: python keep_awake.py <見張るPID>
"""
import ctypes
import subprocess
import sys
import time

ES_CONTINUOUS = 0x80000000
ES_SYSTEM_REQUIRED = 0x00000001

target_pid = int(sys.argv[1])
kernel32 = ctypes.windll.kernel32

try:
    while True:
        kernel32.SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)
        time.sleep(30)
        r = subprocess.run(["tasklist", "/FI", f"PID eq {target_pid}"],
                           capture_output=True, text=True)
        if str(target_pid) not in r.stdout:
            break  # ジョブが終わったら抜ける
finally:
    kernel32.SetThreadExecutionState(ES_CONTINUOUS)  # スリープを許可に戻す
```

ポイントは2つです。

- **見張るジョブが終わったら、自分も終わる**。スリープを止めっぱなしにしない
- **スクリプトが落ちても、Windows が自動で解除する**。`SetThreadExecutionState` の効果は呼んだプロセスが終わると消えるので、電源設定を書き換える方法より後始末が楽です

### 見張る PID がずれる問題

venv の `python.exe` から起動すると、実際に計算しているのは venv の python が起動した **子プロセス（本体の python）** でした。最初に起動したプロセスの PID を見張ると、ジョブの実体とずれてしまいます。

そこで、ジョブの起動からスリープ防止までを1つのラッパーにまとめてもらいました。やっていることは次の流れです。

1. ジョブをバックグラウンドで起動する
2. 15秒待ってから、コマンドラインにスクリプト名を含む `python.exe` を探し、その PID を取る
3. その PID を `keep_awake.py` に渡して起動する

LoRA の学習では、PID の代わりに `accelerate.exe` というプロセス名で見張る版にしています。どちらも「スリープ防止は今後も使うので、定型作業としてスクリプト化しておいて」と頼んで作ってもらいました。

## 失敗：スリープ防止が3日間残っていた

しばらくして、操作しないまま放っておいても PC が自動でスリープしなくなっていることに気づきました。Claude に調べてもらうと、原因はスリープ防止そのものでした。

調べ方は `powercfg /requests` です。いまスリープを止めているプロセスが一覧で出ます。管理者権限が要るので、ここだけは自分で管理者のターミナルを開いて実行し、結果を Claude に貼りました。

出てきたのは、**3日前から動き続けている `keep_awake.py`** でした。ある日、Claude がビルドを待つ間に、PID を渡さずに単体で起動していたのです。当時の版は PID がなければ永遠に回り続ける作りだったので、ビルドが終わっても止まりませんでした。

このプロセスを止めたら、自動スリープは元に戻りました。教訓は2つです。

- スリープ防止は **必ず終わる条件とセットで起動する**（PID を省略できる作りにしていたのが失敗のもと）
- 「最近スリープしないな」と思ったら、まず `powercfg /requests`

## 2. 終わったら PC をスリープさせる

もう1つは逆向きです。寝る前に「終わったらスリープしておいて」と頼むと、作業が終わったところで Claude が PC をスリープさせてくれます。

### 実例1：デプロイが終わったらスリープ

夜中の2時半ごろ、「寝るので終わったら自動スリープしておいてほしい」と頼みました。Claude は次の順で進めて、約30分後に PC をスリープさせていました。

1. スリープ用のスクリプトを先に用意する
2. 3つのサービスを順にデプロイし、本番で動くことを確かめる
3. スクリプトを実行してスリープ

スリープ用のスクリプトはこれです。休止状態ではなくスリープにしています。

```powershell
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false) | Out-Null
```

`powershell -NoProfile -ExecutionPolicy Bypass -File sleep_pc.ps1` で実行しています。PowerShell 7（`pwsh`）では上の表のとおり `System.Windows.Forms` で失敗したことがあるので、Windows 標準の `powershell`（5.1）で動かしています。

### 実例2：記事を push したらスリープ

このサイトの記事を書き終えたあと、「書き終わったら数秒待ってスリープして」と頼みました。Claude は commit と push を済ませてから、次のコマンドを実行しました。

```sh
sleep 5; rundll32.exe powrprof.dll,SetSuspendState 0,1,0
```

翌日の夜に PC を起こすと、Claude の画面には **「2分でタイムアウトした」** と出ていました。Claude 自身も「スリープ中に時間切れになったのか、眠れなかったのか見分けがつかない」と言っています。

確かめる方法は Windows のイベントログです。Claude に Kernel-Power のログを読んでもらいました。

```powershell
Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-Kernel-Power','Microsoft-Windows-Power-Troubleshooter'; StartTime=(Get-Date).AddHours(-12)} -MaxEvents 6 | Select-Object TimeCreated,Id,Message
```

結果は「03:04 にスリープし、20:03 に復帰」でした。スリープはちゃんと効いていて、タイムアウトは **コマンドが返ってこないまま PC が眠ったので、起きたときに時間切れになっただけ** でした。スリープさせるコマンドは、成功すると結果を返せないのが普通です。

なお、`rundll32` で `SetSuspendState` を呼ぶ方法は、休止状態（ハイバネーション）が有効な PC ではスリープではなく休止状態になる、と言われています。確実にスリープさせたいなら、実例1の PowerShell の方法のほうが引数の意味がはっきりしています。

## どこまで任せるか

スリープは取り消しの効かない操作ではありませんが、眠ったあとは Claude も何もできません。頼むときは次のことを意識しています。

- **大事なものは先に外に出す**。push・デプロイ・保存を済ませてからスリープ、の順番を頼むときに明示する
- **ほかに動いているものを確かめる**。バックグラウンドの生成や、別のセッションの作業が残っていないか
- **スリープ防止とスリープ実行を同時に頼まない**。スリープ防止が残っていても、明示的なスリープは効きます。ただ、ジョブを止めたくないから防止しているはずなので、両方を頼むときはジョブの完了を待ってから眠らせるように頼む
- **結果は翌朝に確かめる**。「タイムアウト」と出ていてもあわてず、イベントログで眠った時刻を見る

「寝る前に頼んで、朝に結果を見る」ができるようになって、長いジョブを回すのがずいぶん気楽になりました。

## 参考文献

- [SetThreadExecutionState function - Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-setthreadexecutionstate)
- [Application.SetSuspendState Method - Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/api/system.windows.forms.application.setsuspendstate)
- [Powercfg command-line options - Microsoft Learn](https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/powercfg-command-line-options)
