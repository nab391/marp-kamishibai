<script>
//
// === VoiceVox ===
//
const NARR_SRV = "http://localhost:8081";
let currentAudio = null;
let currentPage = 1;
let currentTrack = 0;
let maxTrack = 1;

//
// === 音声操作 ===
//
function pauseNarration() {
  if (currentAudio && !currentAudio.paused && !currentAudio.ended) {
    currentAudio.pause();
    // ここでUI更新したい場合は任意に（例：アイコンを一時停止表示へ）
  }
}
function toggleNarration() {
  if (!currentAudio) return;
  if (currentAudio.paused && !currentAudio.ended) currentAudio.play();
  else if (!currentAudio.paused) currentAudio.pause();
}

async function playCommon(key){
  try{
    pauseNarration();
    const url = await ensureCommonUrl(key, 'mp3'); // lame無ければwavで返る
    currentAudio = new Audio(url);
    await currentAudio.play().catch(()=>{});
  }catch(e){ console.error('common play error:', e); }
}

//
// === JSスクリプト実行 ===
//
async function runScriptByUrl(url) {
  const code = await fetch(url, { cache:'no-store' }).then(r => r.text());
  // 安全な最低限の依存を渡して async IIFE で実行（await 可能）
  const context = {
    NARR_SRV,
    playCommon, pauseNarration, gotoPage, getTotalPages, getActiveIndex,
    bgmPlay, bgmStop, bgmSetVolume,
  };
  const runner = new Function('context', `"use strict"; return (async (ctx)=>{ ${code}\n })(context);`);
  return await runner(context); // scriptのawait待ち
}

//
// === API ===
//
async function fetchJSON(url){
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

async function ensureCommonUrl(key, prefer='mp3'){
  // APIエイリアスを使う場合:
  const j = await fetchJSON(`${NARR_SRV}/api/common/${key}?format=${prefer}`);
  // 既存の /api/narration を使う場合は:
  // const j = await fetchJSON(`${NARR_SRV}/api/narration/common-${key}?format=${prefer}`);
  if (!j.ok) throw new Error(j.error || '生成失敗');
  return `${NARR_SRV}${j.url}`;
}

async function ensureTrackUrl(nnn, stub, prefer='mp3'){
  const j = await fetchJSON(`${NARR_SRV}/api/narration/${nnn}/${stub}?format=${prefer}`);
  if (!j.ok) throw new Error(j.error || '生成失敗');
  console.log(j.url);
  return `${NARR_SRV}${j.url}`;
}

//
// === ページ操作 ===
//

// URLハッシュから現在のページを取得
function getCurrentPage() {
  const n = Number(location.hash.slice(1));
  return Number.isFinite(n) && n > 0 ? n : 1;
}
// 現在のアクティブスライド index(0始まり) を取得
function getActiveIndex() {
  const slides = Array.from(document.querySelectorAll('svg.bespoke-marp-slide'));
  return slides.findIndex(s => s.classList.contains('bespoke-marp-active'));
}
function getTotalPages() {
  const svgs = document.querySelectorAll('svg.bespoke-marp-slide');
  if (svgs.length) return svgs.length;
  return 1; // フォールバック
}
async function gotoPage(page1based) {
  console.log('gotoPage: ', page1based);
  document.querySelector('button[data-bespoke-marp-osc="next"]').click()
  await new Promise(r => setTimeout(r, 1500)); // 画面切替の描画待ち
}

//
// === ステップ処理（音声、スクリプトに応じて振り分けまで実施） ===
//

// ページ内のステップを取得
async function fetchPageSteps(page) {
  const nnn = String(page).padStart(3, '0');
  const j = await fetchJSON(`${NARR_SRV}/api/page/${nnn}`);
  if (!j.ok) throw new Error(j.error || 'page steps fetch failed');
  return j.steps; // [{mm, type:'scr'|'js', id?, url?}]
}

// 単ページの再生
async function playPageSequential(page) {
  const steps = await fetchPageSteps(page);
  if (!steps.length) return false;

  for (const st of steps) {
    if (st.type === 'scr') {
      // ナレーションスクリプト
      pauseNarration();
      const url = await ensureTrackUrl(st.nnn, st.stub, 'mp3'); // mp3がNGならWAV
      currentAudio = new Audio(url);
      await currentAudio.play().catch(()=>{});
      // 再生完了待ち
      await new Promise(res => currentAudio.addEventListener('ended', res, { once:true }));
      await sleep(500);
    } else if (st.type === 'js') {
      // JSスクリプト
      await runScriptByUrl(`${NARR_SRV}${st.url}`);
    }
  }
  return true;
}

// 現ページ→末尾まで自動再生
let autoplayAbort = false;
async function autoplayFromCurrent() {
  autoplayAbort = false;
  let page = getCurrentPage();
  const last = getTotalPages();

  // 時間記録
  const d1 = new Date();
  console.log('autoplayFromCurrent(begin): ', d1);

  // 本体
  while (!autoplayAbort && page <= last) {
    // ページのvoicesを順再生（無ければスキップ）
    await playPageSequential(page).catch(err => console.warn('playPageSequential err:', err));

    if (autoplayAbort) break;
    page += 1;
    if (page > last) break;

    // 次ページへ移動して続行
    await gotoPage(page);
  }

  // 時間記録
  const d2 = new Date();
  const d3 = (d2.getTime() - d1.getTime()) / 1000 / 60 % 60;
  console.log('autoplayFromCurrent(end): ', d2);
  console.log('autoplayFromCurrent(past): ', d3.toFixed(2), "min");
}
</script>
<script>
// === BGM（バックグラウンド音） ===
let bgmAudio = null;

// 内部: フェード（線形）
function __fadeTo(audio, targetVol, ms) {
  if (!audio) return Promise.resolve();
  targetVol = Math.max(0, Math.min(1, targetVol));
  if (ms <= 0) { audio.volume = targetVol; return Promise.resolve(); }

  const start = audio.volume ?? 1;
  const diff = targetVol - start;
  const t0 = performance.now();

  return new Promise(res => {
    function step(t){
      const p = Math.min(1, (t - t0) / ms);
      audio.volume = start + diff * p;
      if (p >= 1) res(); else requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

/**
 * BGM再生
 * @param {string} nameOrPath - 例) "lofi01.mp3" or "bg/soft.wav"
 * @param {object} opts - { loop=true, volume=0.3, fadeMs=0 }
 */
async function bgmPlay(nameOrPath, opts = {}) {
  const loop   = opts.loop   ?? true;
  const volume = opts.volume ?? 0.3;
  const fadeMs = opts.fadeMs ?? 0;

  const url = nameOrPath.startsWith('http')
    ? nameOrPath
    : `${NARR_SRV}/sound/${nameOrPath}`; // /sound/*.mp3|wav を想定

  // 既存BGMがあれば差し替え（フェードアウト→入れ替え）
  if (bgmAudio && !bgmAudio.ended && !bgmAudio.paused) {
    await __fadeTo(bgmAudio, 0, fadeMs);
    try { bgmAudio.pause(); } catch {}
  }

  const a = new Audio(url);
    console.log('bgmPlay:', url);
  a.loop = !!loop;
  a.volume = 1;               // フェード前提で0から
  bgmAudio = a;

  try { await a.play(); } catch { console.warn('bgmPlay err'); /* サイレント */ }
  await __fadeTo(a, Math.max(0, Math.min(1, volume)), fadeMs);
}

/**
 * BGM停止
 * @param {object} opts - { fadeMs=0 }
 */
async function bgmStop(opts = {}) {
  const fadeMs = opts.fadeMs ?? 0;
  if (!bgmAudio) return;
  await __fadeTo(bgmAudio, 0, fadeMs);
  try { bgmAudio.pause(); } catch {}
  bgmAudio = null;
}

/**
 * BGM音量変更
 * @param {number} volume - 0..1
 * @param {object} opts - { fadeMs=0 }
 */
async function bgmSetVolume(volume, opts = {}) {
  const fadeMs = opts.fadeMs ?? 0;
  if (!bgmAudio) return;
  await __fadeTo(bgmAudio, Math.max(0, Math.min(1, volume)), fadeMs);
}

// ランナー経由のページJSからも触れるように context に注入
// 既存 runScriptByUrl の直後（もしくはその定義内）で context に足す：

</script>

<script>
//
// キー操作
//
// 物理キーコードを共通キー文字に正規化
function normalizeCommonKeyFromCode(e) {
  const c = e.code || '';
  e.preventDefault();
  if (c.startsWith('Digit')) return c.slice(5); // Digit0..9 → 0..9
  if (c.startsWith('Numpad')) { // Numpad0..9 → 0..9
    const n = c.slice(6);
    if (/^[0-9]$/.test(n)) return n;
  }
  if (c.startsWith('Key')) return c.slice(3).toLowerCase(); // KeyA..Z → a..z
  return null; // それ以外は対象外
}
// オーバーレイを出してキー入力を待つ → 押されたら閉じて resolve
function waitCmdBackslash(pattern, msg="一時停止中") {
  return new Promise(resolve => {
    // 1) 画面案内のオーバーレイ
    const ov = document.createElement('div');
    let addCSS = "background: rgba(0,0,0,.35); align-items: center;";
    let msg = "一時停止中<br>再開するには <b>⌘ + \\</b> を押してください";

    if (pattern === 'demo') {
      addCSS = "background: rgba(0,0,0,.15); align-items: start";
      msg = "デモ操作中<br>再開するには <b>⌘ + \\</b> を押してください";
    }
    ov.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,.35);
      display: flex; align-items: center; justify-content: center;
      z-index: 999999; pointer-events: none; font-family: system-ui, sans-serif;
    ` + addCSS;
    ov.innerHTML = `
      <div style="
        pointer-events:auto; background: rgba(0,0,0,.75); color:#fff;
        padding: 20px 28px; border-radius: 10px; font-size: 18px;
        box-shadow: 0 6px 24px rgba(0,0,0,.3); text-align:center;">
        ` + msg + `
      </div>`;
    document.body.appendChild(ov);

    // 2) キー待ち（Cmd + Backslash）
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

      // Mac: metaKey = Cmd。配列差に強い code を使う
      if (e.metaKey && !e.ctrlKey && !e.altKey && e.code === 'Backslash') {
        e.preventDefault();
        cleanup();
        resolve();
      }
    };

    function cleanup() {
      window.removeEventListener('keydown', onKey, true);
      ov.remove();
    }
    window.addEventListener('keydown', onKey, true);
  });
}
document.body.addEventListener("keydown", (e) => {
  const t = (e.target.tagName || '').toUpperCase();
  if (t === 'INPUT' || t === 'TEXTAREA' || e.target.isContentEditable) return;

  // Ctrl + Shift + 1文字
  if (e.ctrlKey && e.shiftKey) {
    const k = normalizeCommonKeyFromCode(e);
    console.log("Ctrl-Shift-" + e.key + " => " + k);
    if (k && /^[a-z0-9]$/.test(k)) { // ファイル名OKな英数のみ採用
      e.preventDefault();
      // 特定の衝突キーを除外したいならここで if(k==='c') return; など
      playCommon(k);
      return;
    }
  }

  // Ctrl + . で一時停止&再開
  if (e.key === '.' && e.ctrlKey) {
    console.log("Ctrl-.");
    toggleNarration();
    bgmStop({ fadeMs: 800 });
    return;
  }
  // Ctrl + , で「現在ページ」を再生
  if (e.key === ',' && e.ctrlKey) {
    console.log("Ctrl-,");
    const page = Number(location.hash.slice(1)) || 1;
    playPageSequential(page, 0);
    return;
  }

  // Ctrl + / で自動再生スタート（現在ページから末尾まで）
  if (e.ctrlKey && (e.key === '/' || e.code === 'Slash')) {
    console.log("Ctrl-/");
    e.preventDefault();
    autoplayFromCurrent();
    return;
  }
});
</script>
<script>
//
// === narration/nnn/*.js用ユーティリティ ===
//
// sleep（timeはミリ秒）
const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));
// 例: await sleepUntil(2100)  // 21:00 まで待機（過ぎていたら翌日の 21:00）
async function sleepUntil(hhmm) {
  const s = String(hhmm).padStart(4, '0');
  const hh = parseInt(s.slice(0, 2), 10);
  const mm = parseInt(s.slice(2, 4), 10);

  const now = new Date();
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);

  // すでに過ぎていたら翌日に回す
  if (target <= now) target.setDate(target.getDate() + 1);

  const ms = target - now;
  await new Promise((r) => setTimeout(r, ms));
}


//
// CSSの一時適用
//
// === Marpのアクティブスライド内を優先して探索 ===
function __activeRoot() {
  const fo = document.querySelector(
    'svg.bespoke-marp-slide.bespoke-marp-active foreignObject'
  );
  return fo || document;
}

// CSS文字列を "key:value" 配列に粗く分解（最小実装）
function __parseCssText(cssText) {
  return cssText
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .map(pair => {
      const idx = pair.indexOf(':');
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      return [k, v];
    });
}

function changeText(selector, newText, duration = 1000) {
  const root = __activeRoot();
  const els = root.querySelectorAll(selector);

  els.forEach(el => {
    const prevColor = el.style.color;
    // アニメーション用のtransition設定
    el.style.transition = `color ${duration / 2}ms ease`;
    // 一旦文字色を白に
    el.style.color = '#ffffff';

    // フェードアウト
    // el.style.transition = `opacity ${duration / 2}ms ease`;
    // el.style.opacity = 0;

    // テキストを変更してフェードイン
    setTimeout(() => {
      el.textContent = newText;
      el.style.transition = `color ${duration / 2}ms ease`;
      el.style.color = prevColor;
      // el.style.opacity = 1;
    }, duration / 2);
  });
}


/**
 * 関数1：一時スタイル適用
 * @param {string} selector - "#id" or ".class" など
 * @param {string} cssText  - "background: ...; color: ...;"
 */
function applyTempStyle(selector, cssText) {
  const root = __activeRoot();
  const els = root.querySelectorAll(selector);
  const pairs = __parseCssText(cssText);

  els.forEach(el => {
    // 元のインラインstyle全体を初回だけ保存（data属性に）
    if (el.dataset.prevInlineStyle === undefined) {
      el.dataset.prevInlineStyle = el.getAttribute('style') || '';
    }
    // 指定CSSを上書き
    pairs.forEach(([k, v]) => {
      el.style.setProperty(k, v);
    });
  });
}
const cssFocus = 'color:#222; outline:8px solid rgba(255,84,42,1); outline-offset:.2em'
const cssFocusInner = 'color:#222; outline:8px solid rgba(255,84,42,1); outline-offset:-0.2em'
const cssFocusCode = 'color:#fff; outline:8px solid rgba(255,84,42,1); outline-offset:.2em'
// let cssFocus = 'background: rgba(255,230,0,.9); color:#222; outline:6px solid rgba(255,230,0,1); outline-offset:.2em'

/**
 * 関数2：一時スタイル復元
 * @param {string} selector - applyTempStyleに渡したのと同じセレクタ
 */
function restoreTempStyle(selector) {
  const root = __activeRoot();
  const els = root.querySelectorAll(selector);

  els.forEach(el => {
    if (el.dataset.prevInlineStyle !== undefined) {
      // 丸ごと復元（空ならstyle属性を消す挙動と同等）
      const prev = el.dataset.prevInlineStyle;
      if (prev) el.setAttribute('style', prev);
      else el.removeAttribute('style');
      delete el.dataset.prevInlineStyle;
    }
  });
}
/*
gotoPage(page1based) が常に next を1回クリックする実装になってるので、指定ページへ飛ぶ用途なら「現在index→目的indexまで step-by-step 進む」か「location.hash フォールバック＋OSC click」の併用にすると安定します。

playPageSequential(page) から呼ぶ ensureTrackUrl のログ console.log(j.url) は運用時は noisy になりがちなので必要なら debug フラグで出し分けると◎

autoplayFromCurrent() の page = getCurrentPage() はハッシュ依存なので、遷移直後に await gotoPage(page) する場合は MutationObserver 等で「アクティブ更新待ち」を入れると取りこぼし防止になります。
*/
</script>


