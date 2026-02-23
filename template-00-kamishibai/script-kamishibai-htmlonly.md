<script>
//
// === VoiceVox ===
//
const NARR_SRV = "http://localhost:8081";
let currentAudio = null;
// let currentTrack = 0;  // 未使用
// let maxTrack = 1;      // 未使用

//
// === 再生制御（一時停止/再開/ステップスキップ） ===
//
// playSceneSequential / autoplayFromCurrent 自体を一時停止・再開する仕組み。
// _pauseResolve が非null なら一時停止中。resumePlayback() で再開。
let _paused = false;
let _pauseResolve = null;

// ステップスキップ制御: 'next' | 'prev' | null
let _stepSkip = null;

function pausePlayback() {
  if (_paused) return;
  _paused = true;
  // 再生中の音声も一時停止
  if (currentAudio && !currentAudio.paused && !currentAudio.ended) {
    currentAudio.pause();
  }
  console.log('[playback] paused');
}

function resumePlayback() {
  if (!_paused) return;
  _paused = false;
  // 音声を再開
  if (currentAudio && currentAudio.paused && !currentAudio.ended) {
    currentAudio.play();
  }
  // await 待ちを解除
  if (_pauseResolve) {
    _pauseResolve();
    _pauseResolve = null;
  }
  console.log('[playback] resumed');
}

function togglePlayback() {
  if (_paused) resumePlayback();
  else pausePlayback();
}

/**
 * 一時停止中なら再開されるまで待つ。
 * ステップスキップ要求が出ていたら 'next' | 'prev' を返す。
 */
async function checkPauseAndSkip() {
  while (_paused) {
    await new Promise(r => { _pauseResolve = r; });
  }
  if (_stepSkip) {
    const dir = _stepSkip;
    _stepSkip = null;
    return dir;
  }
  return null;
}

function requestStepSkip(dir) {
  _stepSkip = dir; // 'next' | 'prev'
  // 再生中の音声を即停止
  if (currentAudio && !currentAudio.paused && !currentAudio.ended) {
    currentAudio.pause();
    currentAudio.dispatchEvent(new Event('ended'));
  }
  // 一時停止中なら解除して進める
  if (_paused) resumePlayback();
}

//
// === 音声操作 ===
//
function pauseNarration() {
  if (currentAudio && !currentAudio.paused && !currentAudio.ended) {
    currentAudio.pause();
  }
}

// キー入力 -> name の対応表
const COMMON_KEY_MAP = {
  'a': 'trouble',
};

async function playAnnounce(name){
  try{
    pauseNarration();
    const url = await ensureAnnounceUrl(name);
    currentAudio = new Audio(url);
    await currentAudio.play().catch(()=>{});
  }catch(e){ console.error('announce play error:', e); }
}

//
// === JSスクリプト実行 ===
//
function buildScriptContext() {
  return {
    NARR_SRV,
    playAnnounce, pauseNarration, gotoPage, getTotalPages, getActiveIndex,
    bgmPlay, bgmStop, bgmSetVolume,
  };
}

function applyLineText(speaker, text) {
  if (typeof window.onLineText === 'function') {
    window.onLineText(speaker, text);
    return;
  }
  const nameEl = document.querySelector('[data-line-speaker]') || document.querySelector('#line-speaker');
  const textEl = document.querySelector('[data-line-text]') || document.querySelector('#line-text');
  if (nameEl) nameEl.textContent = speaker ?? '';
  if (textEl) textEl.textContent = text ?? '';
}

async function runScriptByCode(code) {
  if (!code) return;
  const context = buildScriptContext();
  const runner = new Function('context', `"use strict"; return (async (ctx)=>{ ${code}\n })(context);`);
  return await runner(context);
}

//
// === API ===
//
async function fetchJSON(url){
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

async function ensureAnnounceUrl(name){
  const j = await fetchJSON(`${NARR_SRV}/announce/${name}/voice`);
  if (!j.voiceUrl) throw new Error(j.error || '生成失敗');
  const url = String(j.voiceUrl || '');
  return url.startsWith('http')
    ? url
    : `${NARR_SRV}/${url.replace(/^\/+/, '')}`;
}

async function ensureTrackUrl(scene, stepId){
  const j = await fetchJSON(`${NARR_SRV}/scenes/${scene}/${stepId}/voice`);
  if (!j.voiceUrl) throw new Error(j.error || '生成失敗');
  const url = String(j.voiceUrl || '');
  return url.startsWith('http')
    ? url
    : `${NARR_SRV}/${url.replace(/^\/+/, '')}`;
}

//
// === BGM URL解決 ===
//
// サーバーの @bgm 値:
//   - ファイル名のみ (例: "intro.mp3") → ${NARR_SRV}/kamishibai/bgm/<ファイル名>
//   - パス (例: "kamishibai/bgm/intro.mp3") → ${NARR_SRV}/<パス>
//   - http(s) URL → そのまま
//
function resolveBgmUrl(nameOrPath) {
  if (nameOrPath.startsWith('http')) return nameOrPath;
  if (nameOrPath.includes('/')) return `${NARR_SRV}/${nameOrPath.replace(/^\/+/, '')}`;
  return `${NARR_SRV}/kamishibai/bgm/${nameOrPath}`;
}

//
// === シーン・ページ操作 ===
//

// 現在アクティブなスライドのシーン名を取得
function getCurrentScene() {
  // アクティブなスライド（svg）を探す
  const activeSlide = document.querySelector('svg.bespoke-marp-active');
  if (activeSlide) {
    // その中にある section 要素を探す
    const section = activeSlide.querySelector('section');
    return section ? section.dataset.scene : null;
  }
  return null;
}

console.log("Current Scene:", getCurrentScene());

function getActiveIndex() {
  const slides = Array.from(document.querySelectorAll('svg.bespoke-marp-slide'));
  return slides.findIndex(s => s.classList.contains('bespoke-marp-active'));
}
function getTotalPages() {
  const svgs = document.querySelectorAll('svg.bespoke-marp-slide');
  if (svgs.length) return svgs.length;
  return 1;
}
async function gotoPage(page1based) {
  console.log('gotoPage: ', page1based);
  document.querySelector('button[data-bespoke-marp-osc="next"]').click()
  await new Promise(r => setTimeout(r, 1500));
}

// 全スライドからシーン名リストを順序付きで取得（重複除去なし＝スライド順）
function getAllSlideScenes() {
  const slides = Array.from(document.querySelectorAll('section.bespoke-marp-active, section[data-scene]'));
  // bespoke-marpの全sectionを取得（activeに限らず全て）
  const allSections = Array.from(document.querySelectorAll('section[data-marpit-pagination]'))
    .length > 0
    ? Array.from(document.querySelectorAll('section[data-marpit-pagination]'))
    : Array.from(document.querySelectorAll('svg.bespoke-marp-slide section'));
  return allSections.map(s => s.dataset.scene || null);
}

//
// === ステップ処理 ===
//

async function fetchSceneSteps(scene) {
  const j = await fetchJSON(`${NARR_SRV}/scenes/${scene}`);
  if (!j.steps) throw new Error(j.error || 'scene steps fetch failed');
  return j.steps;
}

/**
 * 単シーンのステップを順次再生する。
 * ステップスキップ (Ctrl+n / Ctrl+p) に対応。
 * 返り値: true=正常完了, false=ステップなし
 */
async function playSceneSequential(scene) {
  const steps = await fetchSceneSteps(scene);
  if (!steps.length) return false;

  let idx = 0;
  while (idx >= 0 && idx < steps.length) {
    // 一時停止チェック & スキップ判定
    const skip = await checkPauseAndSkip();
    if (skip === 'next') { idx++; continue; }
    if (skip === 'prev') { idx = Math.max(0, idx - 1); continue; }
    if (autoplayAbort) break;

    const st = steps[idx];

    // BGM
    if (st.bgm) {
      if (st.bgm === 'stop') await bgmStop({ fadeMs: 800 });
      else await bgmPlay(st.bgm);
    }

    // 吹き出し表示（音声なし or 1チャンクの場合はここで即表示）
    const hasVoice = st.voice && st.voice.text && st.voice.text.trim();
    const lineNeedsRotation = st.line && st.line.text.includes('\n') && hasVoice;
    if (st.line && !lineNeedsRotation) showMsgbox(st.line.text, st.line.speaker, st.line.theme);

    // ステップ開始時JS
    if (st.js) await runScriptByCode(st.js);

    // 一時停止チェック & スキップ判定（JS実行後）
    const skip2 = await checkPauseAndSkip();
    if (skip2 === 'next') { stopMsgboxRotation(); idx++; continue; }
    if (skip2 === 'prev') { stopMsgboxRotation(); idx = Math.max(0, idx - 1); continue; }
    if (autoplayAbort) break;

    // 音声再生
    if (hasVoice) {
      console.log('voice:', { scene, step: st.id, speaker: st.voice.speaker });
      pauseNarration();
      const url = await ensureTrackUrl(scene, st.id);
      currentAudio = new Audio(url);

      // duration取得のため loadedmetadata を待つ
      await new Promise(res => {
        currentAudio.addEventListener('loadedmetadata', res, { once: true });
        currentAudio.load();
      });

      // @line が複数行なら巡回表示を開始
      if (lineNeedsRotation) {
        const durationMs = (currentAudio.duration || 5) * 1000;
        startMsgboxRotation(st.line.text, st.line.speaker, durationMs, st.line.theme);
      }

      await currentAudio.play().catch(()=>{});
      await new Promise(res => currentAudio.addEventListener('ended', res, { once:true }));
      stopMsgboxRotation();

      // スキップで ended が発火された場合の判定
      const skip3 = await checkPauseAndSkip();
      if (skip3 === 'next') { idx++; continue; }
      if (skip3 === 'prev') { idx = Math.max(0, idx - 1); continue; }

      await sleep(500);
    }

    // ステップ終了時JS
    if (st.jsPost) await runScriptByCode(st.jsPost);

    // 待機
    if (Number.isFinite(st.wait) && st.wait > 0) await sleep(st.wait * 1000);

    idx++;
  }
  return true;
}

// 自動再生
let autoplayAbort = false;
async function autoplayFromCurrent() {
  autoplayAbort = false;
  _paused = false;
  _stepSkip = null;

  // 現在のスライドindexから末尾まで順に進行
  let slideIdx = Math.max(0, getActiveIndex());
  const totalSlides = getTotalPages();

  const d1 = new Date();
  console.log('autoplayFromCurrent(begin): ', d1);

  while (!autoplayAbort && slideIdx < totalSlides) {
    const scene = getCurrentScene();
    if (scene) {
      await playSceneSequential(scene).catch(err => console.warn('playSceneSequential err:', err));
    }

    if (autoplayAbort) break;
    slideIdx++;
    if (slideIdx >= totalSlides) break;

    // 次スライドへ移動
    await gotoPage(slideIdx + 1);
  }

  const d2 = new Date();
  const d3 = (d2.getTime() - d1.getTime()) / 1000 / 60 % 60;
  console.log('autoplayFromCurrent(end): ', d2);
  console.log('autoplayFromCurrent(past): ', d3.toFixed(2), "min");
}
</script>
<script>
// === BGM（バックグラウンド音） ===
let bgmAudio = null;

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

async function bgmPlay(nameOrPath, opts = {}) {
  const loop   = opts.loop   ?? true;
  const volume = opts.volume ?? 0.3;
  const fadeMs = opts.fadeMs ?? 0;

  const url = resolveBgmUrl(nameOrPath);

  if (bgmAudio && !bgmAudio.ended && !bgmAudio.paused) {
    await __fadeTo(bgmAudio, 0, fadeMs);
    try { bgmAudio.pause(); } catch {}
  }

  const a = new Audio(url);
  console.log('bgmPlay:', url);
  a.loop = !!loop;
  a.volume = 1;
  bgmAudio = a;

  try { await a.play(); } catch { console.warn('bgmPlay err'); }
  await __fadeTo(a, Math.max(0, Math.min(1, volume)), fadeMs);
}

async function bgmStop(opts = {}) {
  const fadeMs = opts.fadeMs ?? 0;
  if (!bgmAudio) return;
  await __fadeTo(bgmAudio, 0, fadeMs);
  try { bgmAudio.pause(); } catch {}
  bgmAudio = null;
}

async function bgmSetVolume(volume, opts = {}) {
  const fadeMs = opts.fadeMs ?? 0;
  if (!bgmAudio) return;
  await __fadeTo(bgmAudio, Math.max(0, Math.min(1, volume)), fadeMs);
}
</script>

<script>
//
// キー操作
//
function normalizeCommonKeyFromCode(e) {
  const c = e.code || '';
  e.preventDefault();
  if (c.startsWith('Digit')) return c.slice(5);
  if (c.startsWith('Numpad')) {
    const n = c.slice(6);
    if (/^[0-9]$/.test(n)) return n;
  }
  if (c.startsWith('Key')) return c.slice(3).toLowerCase();
  return null;
}

function waitCmdBackslash(pattern, msg="一時停止中") {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    let addCSS = "background: rgba(0,0,0,.35); align-items: center;";
    let displayMsg = "一時停止中<br>再開するには <b>⌘ + \\</b> を押してください";

    if (pattern === 'demo') {
      addCSS = "background: rgba(0,0,0,.15); align-items: start";
      displayMsg = "デモ操作中<br>再開するには <b>⌘ + \\</b> を押してください";
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
        ` + displayMsg + `
      </div>`;
    document.body.appendChild(ov);

    const onKey = (e) => {
      const tag = (e.target.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
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

  // Ctrl + Shift + 1文字 → アナウンス再生
  if (e.ctrlKey && e.shiftKey) {
    const k = normalizeCommonKeyFromCode(e);
    if (k && /^[a-z0-9]$/.test(k)) {
      e.preventDefault();
      const name = COMMON_KEY_MAP[k];
      if (!name) return;
      console.log("Ctrl+Shift+" + e.key + " => " + k + ": " + name);
      playAnnounce(name);
      return;
    }
  }

  // Ctrl + . で再生の一時停止/再開
  if (e.key === '.' && e.ctrlKey) {
    e.preventDefault();
    console.log("Ctrl-. => togglePlayback");
    togglePlayback();
    return;
  }

  // Ctrl + n で次のステップへスキップ
  if (e.ctrlKey && !e.shiftKey && (e.key === 'n' || e.code === 'KeyN')) {
    e.preventDefault();
    console.log("Ctrl-n => skip to next step");
    requestStepSkip('next');
    return;
  }

  // Ctrl + p で前のステップへ戻る
  if (e.ctrlKey && !e.shiftKey && (e.key === 'p' || e.code === 'KeyP')) {
    e.preventDefault();
    console.log("Ctrl-p => skip to prev step");
    requestStepSkip('prev');
    return;
  }

  // Ctrl + , で現在シーンを再生
  if (e.key === ',' && e.ctrlKey) {
    console.log("Ctrl-,");
    const scene = getCurrentScene();
    if (scene) playSceneSequential(scene);
    else console.warn('current slide has no data-scene');
    return;
  }

  // Ctrl + / で自動再生スタート
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
// === ユーティリティ ===
//
const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));

async function sleepUntil(hhmm) {
  const s = String(hhmm).padStart(4, '0');
  const hh = parseInt(s.slice(0, 2), 10);
  const mm = parseInt(s.slice(2, 4), 10);

  const now = new Date();
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);

  const ms = target - now;
  await new Promise((r) => setTimeout(r, ms));
}

// === Marpのアクティブスライド内を優先して探索 ===
function __activeRoot() {
  const fo = document.querySelector(
    'svg.bespoke-marp-slide.bespoke-marp-active foreignObject'
  );
  return fo || document;
}

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
    el.style.transition = `color ${duration / 2}ms ease`;
    el.style.color = '#ffffff';

    setTimeout(() => {
      el.textContent = newText;
      el.style.transition = `color ${duration / 2}ms ease`;
      el.style.color = prevColor;
    }, duration / 2);
  });
}

function applyTempStyle(selector, cssText) {
  const root = __activeRoot();
  const els = root.querySelectorAll(selector);
  const pairs = __parseCssText(cssText);

  els.forEach(el => {
    if (el.dataset.prevInlineStyle === undefined) {
      el.dataset.prevInlineStyle = el.getAttribute('style') || '';
    }
    pairs.forEach(([k, v]) => {
      el.style.setProperty(k, v);
    });
  });
}
const cssFocus = 'color:#222; outline:8px solid rgba(255,84,42,1); outline-offset:.2em'
const cssFocusInner = 'color:#222; outline:8px solid rgba(255,84,42,1); outline-offset:-0.2em'
const cssFocusCode = 'color:#fff; outline:8px solid rgba(255,84,42,1); outline-offset:.2em'

function restoreTempStyle(selector) {
  const root = __activeRoot();
  const els = root.querySelectorAll(selector);

  els.forEach(el => {
    if (el.dataset.prevInlineStyle !== undefined) {
      const prev = el.dataset.prevInlineStyle;
      if (prev) el.setAttribute('style', prev);
      else el.removeAttribute('style');
      delete el.dataset.prevInlineStyle;
    }
  });
}
</script>

<script>
//
// === メッセージボックス ===
//
let _msgboxTheme = 'theme-dark-glass'; // デフォルトテーマ

function _ensureMsgboxElement() {
  let box = document.getElementById('kami-msgbox');
  if (box) return box;

  box = document.createElement('div');
  box.id = 'kami-msgbox';
  box.className = _msgboxTheme;
  box.innerHTML = `
    <div class="msgbox-body">
      <span class="msgbox-speaker"></span>
      <div class="msgbox-text"></div>
    </div>`;
  document.body.appendChild(box);
  return box;
}

/**
 * メッセージボックスのテーマを切り替える。
 * @param {'theme-dark-glass'|'theme-light'|'theme-blue-accent'} theme
 */
function setMsgboxTheme(theme) {
  _msgboxTheme = theme;
  const box = document.getElementById('kami-msgbox');
  if (box) box.className = theme + (box.classList.contains('visible') ? ' visible' : '');
}

/**
 * メッセージボックスを表示する。
 * @param {string} text    台詞テキスト
 * @param {string} speaker 話者名
 * @param {string} [theme] テーマ名（省略時はデフォルトテーマ）
 */
function showMsgbox(text, speaker, theme) {
  const box = _ensureMsgboxElement();
  const t = theme || _msgboxTheme;
  box.className = t + ' visible';
  box.querySelector('.msgbox-speaker').textContent = speaker || '';
  box.querySelector('.msgbox-text').textContent = text || '';
}

/**
 * メッセージボックスを非表示にする。
 */
function hideMsgbox() {
  const box = document.getElementById('kami-msgbox');
  if (box) box.classList.remove('visible');
}

/**
 * テキストを改行で2行ずつのチャンクに分割する。
 */
function _splitLineChunks(text) {
  const lines = text.split('\n');
  const chunks = [];
  for (let i = 0; i < lines.length; i += 2) {
    chunks.push(lines.slice(i, i + 2).join('\n'));
  }
  return chunks;
}

let _msgboxTimer = null;

/**
 * メッセージボックスのチャンク巡回表示を開始する。
 * @param {string} text    台詞テキスト（複数行可）
 * @param {string} speaker 話者名
 * @param {number} durationMs 音声の再生時間(ms)
 * @param {string} [theme] テーマ名
 */
function startMsgboxRotation(text, speaker, durationMs, theme) {
  stopMsgboxRotation();
  const chunks = _splitLineChunks(text);
  if (chunks.length <= 1) {
    showMsgbox(text, speaker, theme);
    return;
  }
  const interval = durationMs / chunks.length;
  let ci = 0;
  showMsgbox(chunks[ci], speaker, theme);
  _msgboxTimer = setInterval(() => {
    ci++;
    if (ci >= chunks.length) { clearInterval(_msgboxTimer); _msgboxTimer = null; return; }
    showMsgbox(chunks[ci], speaker, theme);
  }, interval);
}

/**
 * チャンク巡回を停止する。
 */
function stopMsgboxRotation() {
  if (_msgboxTimer) { clearInterval(_msgboxTimer); _msgboxTimer = null; }
}
</script>
