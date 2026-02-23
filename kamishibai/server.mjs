// server.mjs — Marp Narration Server (新仕様: @command形式 / scene名ベース)
import express from "express";
import fs from "node:fs/promises";
import fssync from "fs";
import path from "node:path";
import { spawn, spawnSync } from "child_process";

// ---------- 設定 ----------
const KAMISHIBAI_DIR = path.resolve(process.env.KAMISHIBAI_DIR || "./kamishibai");
const SCENES_DIR     = path.join(KAMISHIBAI_DIR, "scenes");
const ANNOUNCE_DIR   = path.join(KAMISHIBAI_DIR, "announce");
const PROFILES_DIR   = path.join(KAMISHIBAI_DIR, "profiles");
const VOICES_DIR     = path.join(KAMISHIBAI_DIR, "voices");
const PORT           = Number(process.env.PORT || 8081);
const VOICEVOX       = process.env.VOICEVOX_URL || "http://localhost:50021";
const DEFAULT_SPEAKER = Number(process.env.VOICEVOX_SPEAKER || 1);
const FFMPEG         = process.env.FFMPEG || "ffmpeg";

// ---------- 正規表現 ----------
const SCENE_RE = /^[a-zA-Z0-9_-]+$/;     // シーン名: 英数字・ハイフン・アンダースコア
const STEP_RE  = /^\d+$/;
const ANNOUNCE_NAME_RE = /^[a-zA-Z0-9_-]+$/;

// ---------- ユーティリティ ----------
const exists   = (p) => fssync.existsSync(p);
const ensureDir = (p) => fs.mkdir(p, { recursive: true });

async function readJsonIfExists(p) {
  try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return null; }
}
async function readProfile(name) {
  return readJsonIfExists(path.join(PROFILES_DIR, `${name}.json`));
}

function applyOverridesToQuery(queryObj, override) {
  if (!override) return queryObj;
  const keys = [
    "speedScale", "pitchScale", "intonationScale", "volumeScale",
    "prePhonemeLength", "postPhonemeLength",
    "pauseLength", "pauseLengthScale",
    "outputSamplingRate", "outputStereo", "kana",
  ];
  for (const k of keys) if (override[k] !== undefined) queryObj[k] = override[k];
  if (override.accent_phrases) queryObj.accent_phrases = override.accent_phrases;
  return queryObj;
}

function haveFfmpegLame() {
  try {
    const p = spawnSync(FFMPEG, ["-encoders"], { encoding: "utf8" });
    return p.status === 0 && /libmp3lame/i.test(p.stdout);
  } catch { return false; }
}

function ffmpegToMp3(wavPath, mp3Path) {
  return new Promise((resolve, reject) => {
    const args = ["-y", "-i", wavPath, "-codec:a", "libmp3lame", "-q:a", "2", mp3Path];
    const p = spawn(FFMPEG, args, { stdio: "inherit" });
    p.on("error", reject);
    p.on("close", code => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)));
  });
}

// ==========================================================
//  新パーサー: @command 形式
// ==========================================================

/**
 * トリプルクォート or ダブルクォートで囲まれた文字列を抽出する。
 * `rest` は @command <speaker?> の後の残り部分。
 * 複数行 (""") の場合は後続行も消費する。
 *
 * 返り値: { value: string, nextIndex: number }
 *   nextIndex は lines 配列上で次に読むべき行番号。
 */
function extractQuotedString(rest, lines, currentIndex) {
  const trimmed = rest.trimStart();

  // --- トリプルクォート開始 ---
  if (trimmed.startsWith('"""')) {
    const afterOpen = trimmed.slice(3);
    // 同一行で閉じるケース: """text"""
    const closeIdx = afterOpen.indexOf('"""');
    if (closeIdx !== -1) {
      return { value: afterOpen.slice(0, closeIdx), nextIndex: currentIndex + 1 };
    }
    // 複数行
    const buf = [];
    if (afterOpen.length > 0) buf.push(afterOpen);
    let i = currentIndex + 1;
    while (i < lines.length) {
      const ln = lines[i];
      const ci = ln.indexOf('"""');
      if (ci !== -1) {
        if (ci > 0) buf.push(ln.slice(0, ci));
        return { value: buf.join("\n"), nextIndex: i + 1 };
      }
      buf.push(ln);
      i++;
    }
    // 閉じ忘れ: ファイル末尾まで取り込む
    return { value: buf.join("\n"), nextIndex: i };
  }

  // --- ダブルクォート ---
  if (trimmed.startsWith('"')) {
    const inner = trimmed.slice(1);
    const closeIdx = inner.indexOf('"');
    if (closeIdx !== -1) {
      return { value: inner.slice(0, closeIdx), nextIndex: currentIndex + 1 };
    }
    // 閉じなし → 行末までを値とする
    return { value: inner, nextIndex: currentIndex + 1 };
  }

  // --- クォートなし → 行末まで ---
  return { value: trimmed, nextIndex: currentIndex + 1 };
}

/**
 * .scr ファイル全体をパースして steps 配列を返す。
 */
function parseScript(raw) {
  const steps = [];
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  let cur = null;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimLine = line.trim();

    // 空行・コメント → スキップ
    if (trimLine === "" || trimLine.startsWith("#")) {
      i++;
      continue;
    }

    // ステップラベル: *<stepId>
    const stepMatch = trimLine.match(/^\*(\d+)$/);
    if (stepMatch) {
      if (cur) steps.push(cur);
      cur = { id: stepMatch[1] };
      i++;
      continue;
    }

    // @command 行
    const cmdMatch = trimLine.match(/^@(\S+)\s*(.*)/s);
    if (cmdMatch && cur) {
      const cmd = cmdMatch[1];
      const argPart = cmdMatch[2];

      switch (cmd) {
        case "voice": {
          const { speaker, remainder } = extractSpeakerAndRemainder(argPart);
          const { value, nextIndex } = extractQuotedString(remainder, lines, i);
          cur.voice = { speaker: speaker || "default", text: value.trim() };
          i = nextIndex;
          continue;
        }
        case "line": {
          // @line <speaker>[, <theme>] """<text>"""
          const quoteStart = argPart.search(/"""|"/);
          const metaPart   = (quoteStart >= 0 ? argPart.slice(0, quoteStart) : argPart).trim();
          const quotePart  = quoteStart >= 0 ? argPart.slice(quoteStart) : "";
          const { value, nextIndex } = extractQuotedString(quotePart, lines, i);

          let speaker = "";
          let theme;
          if (metaPart.includes(",")) {
            const parts = metaPart.split(",").map(s => s.trim());
            speaker = parts[0] || "";
            if (parts[1]) theme = parts[1];
          } else {
            speaker = metaPart;
          }

          cur.line = { speaker, text: value.trim() };
          if (theme) cur.line.theme = theme;
          i = nextIndex;
          continue;
        }
        case "js": {
          const { value, nextIndex } = extractQuotedString(argPart, lines, i);
          cur.js = value.trim();
          i = nextIndex;
          continue;
        }
        case "jsPost": {
          const { value, nextIndex } = extractQuotedString(argPart, lines, i);
          cur.jsPost = value.trim();
          i = nextIndex;
          continue;
        }
        case "wait": {
          const v = parseFloat(argPart.trim());
          if (Number.isFinite(v)) cur.wait = v;
          i++;
          continue;
        }
        case "bgm": {
          cur.bgm = argPart.trim();
          i++;
          continue;
        }
        case "jump": {
          const jm = argPart.trim().match(/^\*?(\d+)$/);
          if (jm) cur.jump = jm[1];
          i++;
          continue;
        }
        default: {
          cur[cmd] = argPart.trim();
          i++;
          continue;
        }
      }
    }

    i++;
  }

  if (cur) steps.push(cur);
  return steps;
}

/**
 * argPart から speaker と残りの文字列部分を分離する。
 */
function extractSpeakerAndRemainder(argPart) {
  const trimmed = argPart.trimStart();
  if (trimmed.startsWith('"')) {
    return { speaker: null, remainder: trimmed };
  }
  if (trimmed === "") {
    return { speaker: null, remainder: "" };
  }
  const spaceIdx = trimmed.search(/\s/);
  if (spaceIdx === -1) {
    return { speaker: null, remainder: trimmed };
  }
  const token = trimmed.slice(0, spaceIdx);
  const rest  = trimmed.slice(spaceIdx);
  if (/[""]/.test(rest)) {
    return { speaker: token, remainder: rest };
  }
  return { speaker: null, remainder: trimmed };
}

// ---------- ファイル読み込み ----------

async function loadSceneSteps(sceneName) {
  const scrPath = path.join(SCENES_DIR, `${sceneName}.scr`);
  const raw = await fs.readFile(scrPath, "utf8");
  return parseScript(raw);
}

async function loadAnnounceSteps(name) {
  const scrPath = path.join(ANNOUNCE_DIR, `${name}.scr`);
  const raw = await fs.readFile(scrPath, "utf8");
  return parseScript(raw);
}

// ---------- 音声合成 ----------

function pickSpeaker(conf) {
  return Number.isFinite(Number(conf)) ? Number(conf) : null;
}

async function synthWavFromVoice(voiceObj) {
  const text = (voiceObj?.text ?? "").trim();
  if (!text) throw new Error("voice is empty");

  const speakerName = voiceObj?.speaker || "default";
  const globalConf  = await readProfile("default");
  const personConf  = speakerName !== "default"
    ? await readProfile(speakerName)
    : null;

  const speaker = pickSpeaker(personConf?.speaker)
    ?? pickSpeaker(globalConf?.speaker)
    ?? DEFAULT_SPEAKER;

  const qRes = await fetch(
    `${VOICEVOX}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`,
    { method: "POST" }
  );
  if (!qRes.ok) throw new Error(`VOICEVOX audio_query failed: ${qRes.status}`);
  let query = await qRes.json();

  query = applyOverridesToQuery(query, globalConf);
  query = applyOverridesToQuery(query, personConf);

  const sRes = await fetch(`${VOICEVOX}/synthesis?speaker=${speaker}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!sRes.ok) throw new Error(`VOICEVOX synthesis failed: ${sRes.status}`);
  return Buffer.from(await sRes.arrayBuffer());
}

async function ensureMp3(outSubDir, fileBaseName, voiceObj) {
  if (!haveFfmpegLame()) throw new Error("ffmpeg with libmp3lame is required");

  const outDir = path.join(VOICES_DIR, outSubDir);
  await ensureDir(outDir);

  const mp3Out = path.join(outDir, `${fileBaseName}.mp3`);
  if (exists(mp3Out)) return mp3Out;

  const wavOut = path.join(outDir, `${fileBaseName}.wav`);
  const wavBuf = await synthWavFromVoice(voiceObj);
  await fs.writeFile(wavOut, wavBuf);
  await ffmpegToMp3(wavOut, mp3Out);
  await fs.unlink(wavOut).catch(() => {});

  return mp3Out;
}

// ==========================================================
//  Express アプリケーション
// ==========================================================
const app = express();

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// 静的ファイル配信: /kamishibai/ で KAMISHIBAI_DIR 全体を配信
// → /kamishibai/voices/..., /kamishibai/bgm/..., etc.
app.use("/kamishibai", express.static(KAMISHIBAI_DIR));

// =====================
//  /scenes/ — シーン一覧
// =====================
app.get("/scenes", async (req, res) => {
  try {
    const files = await fs.readdir(SCENES_DIR);
    const scenes = [];
    for (const f of files) {
      const m = f.match(/^(.+)\.scr$/);
      if (m && SCENE_RE.test(m[1])) scenes.push(m[1]);
    }
    scenes.sort();
    res.json({ scenes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// =====================
//  /scenes/:scene — 全ステップ
// =====================
app.get("/scenes/:scene", async (req, res) => {
  try {
    const sceneName = String(req.params.scene || "");
    if (!SCENE_RE.test(sceneName)) return res.status(400).json({ error: "invalid scene name" });
    const scrPath = path.join(SCENES_DIR, `${sceneName}.scr`);
    if (!exists(scrPath)) return res.status(404).json({ error: "not found" });

    const steps = await loadSceneSteps(sceneName);
    res.json({ scene: sceneName, steps });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// =====================
//  /scenes/:scene/:step — 特定ステップ
// =====================
app.get("/scenes/:scene/:step", async (req, res) => {
  try {
    const sceneName = String(req.params.scene || "");
    const stepId    = String(req.params.step || "");
    if (!SCENE_RE.test(sceneName)) return res.status(400).json({ error: "invalid scene name" });
    if (!STEP_RE.test(stepId))     return res.status(400).json({ error: "invalid step" });

    const scrPath = path.join(SCENES_DIR, `${sceneName}.scr`);
    if (!exists(scrPath)) return res.status(404).json({ error: "not found" });

    const steps = await loadSceneSteps(sceneName);
    const step = steps.find(s => s.id === stepId);
    if (!step) return res.status(404).json({ error: "step not found" });
    res.json(step);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// =====================
//  /scenes/:scene/:step/voice — 音声変換
// =====================
app.get("/scenes/:scene/:step/voice", async (req, res) => {
  try {
    const sceneName = String(req.params.scene || "");
    const stepId    = String(req.params.step || "");
    if (!SCENE_RE.test(sceneName)) return res.status(400).json({ error: "invalid scene name" });
    if (!STEP_RE.test(stepId))     return res.status(400).json({ error: "invalid step" });

    const scrPath = path.join(SCENES_DIR, `${sceneName}.scr`);
    if (!exists(scrPath)) return res.status(404).json({ error: "not found" });

    const steps = await loadSceneSteps(sceneName);
    const step = steps.find(s => s.id === stepId);
    if (!step) return res.status(404).json({ error: "step not found" });

    const voiceText = (step.voice?.text ?? "").trim();
    if (!voiceText) {
      return res.status(404).json({ error: "voice is empty" });
    }

    await ensureMp3(sceneName, stepId, step.voice);
    res.json({ voiceUrl: `kamishibai/voices/${sceneName}/${stepId}.mp3` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// =====================
//  /announce/:name — アナウンス内容
// =====================
app.get("/announce/:name", async (req, res) => {
  try {
    const name = String(req.params.name || "");
    if (!ANNOUNCE_NAME_RE.test(name)) return res.status(400).json({ error: "invalid name" });
    const scrPath = path.join(ANNOUNCE_DIR, `${name}.scr`);
    if (!exists(scrPath)) return res.status(404).json({ error: "not found" });

    const steps = await loadAnnounceSteps(name);
    res.json({ name, steps });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// =====================
//  /announce/:name/voice — アナウンス音声変換
// =====================
app.get("/announce/:name/voice", async (req, res) => {
  try {
    const name = String(req.params.name || "");
    if (!ANNOUNCE_NAME_RE.test(name)) return res.status(400).json({ error: "invalid name" });
    const scrPath = path.join(ANNOUNCE_DIR, `${name}.scr`);
    if (!exists(scrPath)) return res.status(404).json({ error: "not found" });

    const steps = await loadAnnounceSteps(name);
    const step = steps[0];
    if (!step) return res.status(404).json({ error: "no steps" });

    const voiceText = (step.voice?.text ?? "").trim();
    if (!voiceText) {
      return res.status(404).json({ error: "voice is empty" });
    }

    await ensureMp3(`_announce/${name}`, step.id, step.voice);
    res.json({ voiceUrl: `kamishibai/voices/_announce/${name}/${step.id}.mp3` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ---------- 起動 ----------
app.listen(PORT, () => {
  console.log(`Narration Server ▶ http://localhost:${PORT}`);
  console.log(`VOICEVOX         ▶ ${VOICEVOX} (default speaker=${DEFAULT_SPEAKER})`);
  console.log(`KAMISHIBAI_DIR   ▶ ${KAMISHIBAI_DIR}`);
  console.log(`FFMPEG           ▶ ${FFMPEG} (lame=${haveFfmpegLame()})`);
});
