" ------------------------------------------------------------
" ファイル保存後に外部コマンドを非同期で実行する autocmd
" 対象: *.md, *.js, *.html, *.css
" ------------------------------------------------------------
echo "loaded: .vimrc.local"

" 1. コールバック関数本体
function! s:LocalRunSlideCommand()
  " バッファの絶対ディレクトリパスを取得
  let l:buf_dir = expand('%:p:h')
  echo "loaded: runrunrunrunrunrunrunrunrunrunrun"

  " OS 判定 → macOS か Windows か
  if has('mac')
    " macOS 用コマンド（リスト形式で渡すと job_start が安全に扱える）
    let l:cmd = ['../slide-make.sh']
  elseif has('wsl') ||
    \ (filereadable('/proc/version') &&
    \  match(readfile('/proc/version')[0], 'Microsoft') >= 0)
    " WSL (Linux 上の Windows) 用 → macOS と同じシェルを走らせる
    echo "loaded: wslwslwslwslwslwslwslwslwslwslwsl"
    let l:cmd = ['../slide-make.sh']
  elseif has('win32') || has('win64')
    " Windows 用コマンド（文字列でも可。引数はすべて一つの文字列にまとめる）
    " call job_start(['C:\WINDOWS\system32\cmd.exe', '/c', 'your_script.bat'])
    " let l:cmd = ['cmd.exe', '/c', '..\slide-make2.bat']
    let l:cmd = ['cmd2.exe']
    call job_start(['start', 'cmd2.exe'])
    " call job_start(['cmd.exe', '/c', '..\slide-make.bat'])
    " let l:cmd = 'start "marp-convert" /i /min /b /d '
    "       \ . shellescape(l:buf_dir, 1)
    "       \ . ' cmd /c "..\slide-make.bat && exit 0"'
  else
    " 予期しないプラットフォームの場合は何もしない
    return
  endif

  " 非同期ジョブを開始（detach オプションでバックグラウンド実行）
  " Vim8 以降は job_start() が利用可能
  if type(l:cmd) == type([])
    " リスト（テーブル）形式の場合
    call job_start(l:cmd)
    " call job_start(l:cmd, {'detach': v:true})
  else
    " 文字列の場合
    call job_start(l:cmd)
  endif
endfunction

" 2. autocmd の登録
augroup SlideOnSave
  autocmd!
  " BufWritePost で対象パターンにマッチしたらコールバックを呼ぶ
  autocmd BufWritePost *.md,*.js,*.html,*.css call s:LocalRunSlideCommand()
augroup END
