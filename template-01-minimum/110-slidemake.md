## ◆スライド生成の手順

直接`docker run`もできますが簡便にするためスクリプトを用意しています。  
各テンプレートフォルダ内に`slide-make.sh|bat`という名前で保存しています。  
以下、フォルダ構成と使い方です。

- 入力：==markdownファイルは`src`フォルダに格納==します。
  - `slide-make`実行時に自動で結合されます。（拡張子`md`が対象、名前順）
  - ==`css`や`img`など参照ファイルは`dist`フォルダに格納==しておきます。
- 出力：==生成されたスライドは`dist`フォルダに保存==されます。
  - デフォルトファイル名は`slide.html`です。
- 生成：==ターミナルから`slide-make.sh|bat`を実行==すればOKです。
- 備考：`templates-01.minimum`で実行するとこのスライドが生成されます。

実行時のオプションとその内容は次ページ以降で説明します。

## ◆スライド生成のオプション1
オプションと機能を列挙します。動作は実際に実行して確かめてください。

- 基本(HTML生成、自動結合)：`slide-make.sh`
- ==結合時、一部ファイルを除外==（ファイル名に指定文字列を含むかで判定）
  - `pdfonly`を含むファイルを除外：`slide-make.sh --exclude=pdfonly`
  - 複数指定はカンマ区切り：例）`slide-make.sh --exclude=pdfonly,htmlonly`
  - ==デフォルトで`-exclude`が組み込まれている==：例）`作成用メモ-exclude.md`
- PDF生成：`slide-make.sh --pdf`
- PDF生成（htmlonlyを除外）：`slide-make.sh --pdf --exclude=htmlonly`
- テーマ設定（CSS指定）: `slide-make.sh --css=<cssファイル名>`
    - デフォルトは`./css/style.css`（普段はこのまま）

次ページでもちょっと例示

## ◆スライド生成のオプション2
- フィルター処理の入れ替え：`slide-make.sh --filter=<filter名>`
    - デフォルトはDocker内の`filter4mapr.py`
    - filterはPythonスクリプトのみ。配置場所は`src`内。
    - 標準入力で結合mdを受け取り。標準出力でフィルター後mdを出力

以下はデバッグ用のオプションです。普通は使わないですが一応。

- markdownの結合をしない。marpによる変換のみ実行する
  - `slide-make.sh --convert`
  - 結合後のファイルは`dist/__merged.md`に保存されます。  
    これを手動修正して確認したい場合のオプションです。
- デバッグモード（環境変数を表示。marpをデバッグモードで実行）
  - `slide-make.sh --debug`


