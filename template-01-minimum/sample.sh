# デフォルト：1. src/*.mdを全て結合。2. HTML出力
./_make-slide.sh

# 結合対象から名前にhtmlonlyを含むファイルを除外する
./_make-slide.sh --exclude=htmlonly

# テーマ設定：テーマ名を指定
./_make-slide.sh --css=gaia

# テーマ設定：CSSファイルを指定（カスタムテーマ）
./_make-slide.sh --css=./css/style.css

# PDF出力
./_make-slide.sh --exclude=htmlonly --pdf

# 組み合わせ例（HTML専用のページを除いてPDF出力。ログ出力あり）
./_make-slide.sh --exclude=htmlonly --pdf --debug

# markdownの結合をしない。marpによる変換のみ実行する
./_make-slide.sh --convert

# デバッグモード：1. 環境変数を表示。2. marpをデバッグモードで起動
./_make-slide.sh --debug

# 組み合わせ例（HTML専用のページを除いてPDF出力。ログ出力あり）
./_make-slide.sh --exclude=htmlonly --pdf --debug

