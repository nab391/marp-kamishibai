# marp-templates

## 目的・概要

Dockerベースの Marp スライド作成テンプレートです。
Marpでのスライド作成にあたって、下記を実現＆手軽にするために構築しました。

- スライドに合わせてVoiceVoxによる音声を再生する
- 音声再生が完了したら自動でページをめくり、最終ページまで自動再生する
- Markdownファイルを分割管理する
- Pythonによるフィルター処理を挟む
- 出力フォーマットによりファイルの取捨選択を行う


## ディレクトリ構成と手順概要

ディレクトリ構成は下記の通りです。

```text
marp-kamishibai/
├─ build-marp.sh
├─ build-kamishibai.sh
│
├─ marp/           # Marpの環境
│  ├─ Dockerfile
│  ├─ <Dockerコンテナ内の環境>
│
├─ kamishibai/    # 紙芝居システムの環境
│  ├─ Dockerfile
│  ├─ <Dockerコンテナ内の環境>
│
├─ template-01-kamishibai/    # サンプル兼テンプレート
│  ├─ *.md           # スライド用原稿
│  ├─ kamishibai/    # 紙芝居システム用のファイル
│  │   ├─ scenes/   # 紙芝居のシナリオテキスト
│  │   ├─ profiles/ # VoiceVox用の音声設定
│  │   ├─ bgm/      # BGM置き場
│  │   ├─ voices/   # 生成された音声ファイル置き場
│  ├─ css/           # 紙芝居にあわせたスタイルシート
│  ├─ _make-slide.sh         # スライド生成スクリプト
│  ├─ _start-kamishibai.sh   # 紙芝居のシナリオ処理サーバー起動
│  ├─ _start-browser-sync.sh   # 紙芝居のシナリオ処理サーバー起動
```

## 環境セットアップ

下記コマンドにて環境を構築。
```
git clone https://github.com/nab391/marp-kamishibai.git
cd marp-kamishibai
./build-marp.sh
./build-kamishibai.sh
```
VOICEVOXのURLはデフォルトで`http://localhost:50021`
異なる場合は`VOICEVOX_URL`で設定変更。

## 動作確認

上記、環境セットアップからの続き。
サンプルテンプレートで動作確認。
```
cd template-00-kamishibai
./_start-kamishibai.sh
./_make-slide.sh
```

生成されたHTMLファイルをブラウザで開く。
browser-syncが未インストールの場合は下記を追加。
`npm i browser-sync`

```
./_start-browser-sync.sh
```

スライドが表示されたら`Ctrl + /`で紙芝居が開始。

## 紙芝居シナリオの書き方

スライドの各ページには`<!-- _scene: <scene-name> -->`と拡張derivativeを記述します。
そのページに対応したシナリオファイルは`kamishibai/scenes/<scene-name>.scr`となります。
以下、`<scene-name>.scr`の書式です。

```scr
##############################
# 先頭文字が#の行はコメント行

# 先頭文字が*の行はステップラベル（数字のみ）
*10

# 先頭文字が@の行はコマンド

# @voice <speaker> """<text>"""
# - `<text>` を音声合成対象として扱う（VoiceVoxに渡す原稿）
# - `<speaker>` に対応したプロファイルは `kamishibai/profiles/<speaker>.json`
# - `<speaker>` が省略された場合は `kamishibai/profiles/default.json` を適用
@voice zundamon """
こんにちは、ずんだもんなのだ。
"""

# @line <speaker> """<text>"""
# - `<text>` をメッセージボックスに表示。名前欄は `<speaker>` を使う
@line ずんだもん """
（吹き出し表示...）
"""

# @js """<code>"""
# - 演出用JS（音声再生の前に実行）
@js """
console.log('pre')
"""

# @jsPost """<code>"""
# - 演出用JS（音声再生完了後に実行）
@jsPost """
console.log('post')
"""

# @wait <seconds>
# - ステップ終了後の待ち秒数
@wait 0.8

# `@bgm <filename|stop>`
# - 指定された音楽ファイルを再生開始 → 場所は`kamishibai/bgm/`
# - `stop` で停止
@bgm intro.mp3


##############################
# 次ステップ（以後同様）
*11
@line 四国めたん """次のステップ、開始なのだわ"""
...
```

## スライド生成スクリプトのオプション一覧

スライド生成のオプションは下記の通りです。

- **基本(HTML生成、自動結合)**
    - `_make-slide.sh`
- **結合時、一部ファイルを除外**
    - `--exclude=<文字列>`
        - ファイル名に指定文字列を含むファイルは除外
    - 例）`htmlonly`を含むファイルを除外：  
      `_make-slide.sh --exclude=htmlonly`
    - デフォルトで`--exclude=-exclude`が指定されています
- **PDF生成**
    - `--pdf`
    - 例）PDF生成（htmlonlyを除外）
    - `_make-slide.sh --pdf --exclude=htmlonly`

## Markdown書式（文字装飾）

Markdownの書式について、拡張部分をメインに説明します。

| 意味       | タグ   | 記述             | 表示例         |
| ---        | ---    | ---              | ---            |
| 強調1      | mark   | `==text==`       | ==text==       |
| 強調2      | em     | `*text*`         | *text*         |
| 強調3      | strong | `**text**`       | **text**       |
| 取り消し線 | s      | `~~text~~`       | ~~text~~       |
| 下線       | u      | `_text_`         | _text_         |
| 下付       | sub    | `text~下~`       | text~下~       |
| 上付       | sup    | `text^上^`       | text^上^       |
| ルビ       | ruby   | `{漢字\|かんじ}` | {漢字\|かんじ} |

## Markdown書式（他）

文字装飾以外の書式です。

| md記述        | 変換後                         | 備考                     |
| ---           | ---                            | ---                      |
| `# text{.name}` | `<h1 class="name">text</h1>`     | 手軽にクラス付与できる |
| `[text]{.name}` | `<span class="name">text</span>` | 手軽にspanできる         |
| `:::name` ～`:::` | `<div class="name">～</div>`     | ~~手軽にdivできる~~←手軽でない    |
| `{{{name` ～`}}}` | `<div class="name">～</div>`     | 手軽にdivできる(独自フィルタ)    |


## ライセンス

好きに使ってください。
ただし **自己責任**です。

## コメント

テンプレートは整理中です。

