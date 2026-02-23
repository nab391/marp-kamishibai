#!/bin/sh
# 0) 初期値
# markdown結合用の変数
SRC_DIR="/src" # 結合前のmd格納場所
EXCLUDE="-exclude" # md結合時に除外するファイル名パターン
MERGED="__merged.tmp"

# スライド生成用の変数
DIST_DIR="/dist"
EXT="html"
FORMAT="--html"
OUTPUT_FILE="slide.html"
CSS="./css/style.css"
# CSS="default"
ENGINE="--engine engine.js"
ARGS=""
FILTER="/src/filter4marp.py"
WATCH_MODE=""
CONVERT_MODE=""
DEBUG=""
PYTHON_LOG="/dev/null"
MARP_LOG="/dev/null"

# 1) 引数処理
arg_process () {
  for arg in "$@"; do
    case "$arg" in
      --html)
        EXT="html"
        FORMAT="--html"
        ;;
      --pdf)
        EXT="pdf"
        FORMAT="--pdf --allow-local-files --pdf-outlines --pdf-outlines.pages=false"
        ;;
      --ppt|--pptx)
        EXT="pptx"
        FORMAT="--pptx --allow-local-files"
        ;;
      # --src-dir=*)  SRC_DIR="${arg#--src-dir=}" ;; # docker化に伴い固定化
      # --dist-dir=*) DIST_DIR="${arg#--dist-dir=}" ;; # docker化に伴い固定化
      --exclude=*) EXCLUDE="${EXCLUDE},${arg#--exclude=}" ;;
      # --input-file=*) MERGED="${arg#--input-file=}" ;; # docker化に伴い削除
      --merged-file=*) MERGED="${arg#--merged-file=}" ;;
      --output-file=*) OUTPUT_FILE="${arg#--output-file=}" ;;
      --css=*)    CSS="${arg#--css=}" ;;
      --filter=*) FILTER="${arg#--filter=}" ;;
      --convert)  CONVERT_MODE="TRUE" ;;
      --watch)    WATCH_MODE="-w" ;;
      --debug)
        DEBUG="debug=true"
        PYTHON_LOG="__python.log"
        MARP_LOG="__marp.log"
        ;;
      --*) ;; # 他のオプションは無視
      *)
        ARGS="${ARGS} ${arg}"
        ;; # 他の引数はそのままmarpに渡す
    esac
  done
}
arg_process "$@"

# 2) Docker化に伴い変数調整（適当）
MERGED=${DIST_DIR}/${MERGED}
OUTPUT_FILE=${DIST_DIR}/${OUTPUT_FILE%.*}.${EXT}
if [ -f ${DIST_DIR}/${CSS} ]; then
  CSS=${DIST_DIR}/${CSS}
fi
if [ ! -f ${FILTER} ]; then
  if [ -f ${SRC_DIR}/${FILTER} ]; then
    FILTER=${SRC_DIR}/${FILTER}
  else
    # default
    FILTER="/app/bin/filter4marp.py"
  fi
fi

# 3) debugモード
if [ -n "${DEBUG}" ]; then
  PYTHON_LOG=${DIST_DIR}/${PYTHON_LOG}
  MARP_LOG=${DIST_DIR}/${MARP_LOG}
  . /app/bin/print_env.sh
fi

# 4) /src/*.mdを結合→フィルタ→/dist/__slide.md
if [ -z "${CONVERT_MODE}" ]; then
  python3 /app/bin/join-files.py ${SRC_DIR} --exclude \"${EXCLUDE}\" \
  | python3 ${FILTER} -o "${MERGED}" 2>&1 \
  >> ${PYTHON_LOG}
  # | python3 /app/bin/filter4marp.py -o "${MERGED}" 2>&1 \
fi

# 5) marp変換（CSS等はdist配下）
npx --yes @marp-team/marp-cli ${DEBUG} ${WATCH_MODE} ${ARGS} --no-stdin ${ENGINE} \
  --theme ${CSS} ${FORMAT} ${MERGED} -o ${OUTPUT_FILE} \
  >> ${MARP_LOG}
echo Done.

