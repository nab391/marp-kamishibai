<!-- mermaid.jsを読み込む -->
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true });
</script>

<!-- 時計表示（独自、今回は不要） -->
<script>
  function showClock() {
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, "0");
    const minute = now.getMinutes().toString().padStart(2, "0");
    const second = now.getSeconds().toString().padStart(2, "0");
    const month = now.getMonth() + 1;
    const weekday = now.getDay();
    const dayOfWeekStr = [ "日", "月", "火", "水", "木", "金", "土" ][weekday];
    const msg = "" + hour + ":" + minute + ":" + second
    document.getElementById("clock").innerHTML = msg;
  }
  // setInterval('showClock()',1000);
</script>
<!-- 時計表示 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.10.6/dayjs.min.js"></script>
<!-- header時計：更新 -->
<script language="JavaScript">
  function watch() {
    const dt = dayjs(new Date());
    // const html = `⏰ ${dt.format('HH')}<span id="colon">:</span>${dt.format('mm')}`;
    const html = `${dt.format('HH')}<span id="colon">:</span>${dt.format('mm')}`;
    document.querySelectorAll('.watch').forEach(elm => {
      elm.innerHTML = html;
    });
  };
  setInterval(watch, 1000);
</script>
<!-- header時計：埋め込み -->
<script>
  document.querySelectorAll('h3').forEach(elm => {
    // elm.innerHTML += '<div class="watch"></div>';
    elm.innerHTML += '<div class="t">⏰ <span class="watch"></span></div>';
  });
</script>
<script>
  //
  // iframeの表示非表示を切り替える
  //
  function toggleIframeByEvent(e) {
    const btn = e.currentTarget;
    toggleIframe(btn);
  }
  function toggleIframe(btn) {
    // const btn = e.currentTarget;
    const targetSel = btn.dataset.target;
    const srcRaw    = btn.dataset.src;
    if (!targetSel || !srcRaw) return;

    const frm = document.querySelector(targetSel);
    if (!frm) return;

    const desired = new URL(srcRaw, location.href).href;
    const current = frm.src ? new URL(frm.src, location.href).href : '';

    if (current !== desired) {
      frm.src = desired;
      btn.setAttribute('aria-pressed', 'true');
      btn.textContent = ""
    } else {
      frm.src = 'about:blank';
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = ""
    }
  }
  document.querySelectorAll('.btn-iframe').forEach(btn => {
    btn.addEventListener('click', toggleIframeByEvent);
  });
</script>

<!-- 音声要素を読み込む -->
<audio id="audio_hover" preload="auto">
    <source src="./audio/hover_li.mp3" type="audio/mp3">
</audio>
<audio id="audio_click" preload="auto">
    <source src="./audio/click.mp3" type="audio/mp3">
</audio>
<audio id="audio_toc" preload="auto">
    <source src="./audio/toc.mp3" type="audio/mp3">
</audio>
<audio id="audio_nosound" preload="auto">
    <source src="./audio/nosound.mp3" type="audio/mp3">
</audio>

<script>
  // 音声コンテキストの初期化
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContext();

  // 全ての音声をプリロード
  const audioElements = document.querySelectorAll('audio');
  const audioBuffers = {};
  const audioSources = {};

  // 音声バッファを読み込む関数
  function loadAudioBuffer(audioElement, audioId) {
      // 音声ファイルのURLを取得
      const audioSrc = audioElement.querySelector('source').src;

      // 音声ファイルをフェッチしてデコード
      fetch(audioSrc)
          .then(response => response.arrayBuffer())
          .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
          .then(audioBuffer => {
              audioBuffers[audioId] = audioBuffer;
              console.log(`Audio ${audioId} loaded`);
          })
          .catch(error => console.error('Error loading audio:', error));
  }

  // 全ての音声要素をプリロード
  audioElements.forEach(audio => {
    loadAudioBuffer(audio, audio.id);
    /* const source = audiocontext.createbuffersource();
    source.buffer = audiobuffers[audio.id];
    source.connect(audiocontext.destination);
    audiosources[audio.id] = source; */
  });

  // 音声バッファを準備
  // prepareaudiobuffers();


  // 音声を再生する関数
  function playAudio(audioId) {
    // バッファが読み込まれていれば再生
    if (audioBuffers[audioId]) {
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffers[audioId];
      source.connect(audioContext.destination);
      source.start(0);
      console.log(`Audio ${audioId} played`);
      /* audioSources[audioId].start(0);
      source = audioContext.createBufferSource();
      source.buffer = audioBuffers[audioId];
      source.connect(audioContext.destination); */
      // 音声バッファを準備
      //prepareAudioBuffers();
      return;
    }
  }
</script>
<script>
document.addEventListener('DOMContentLoaded', function() {
  // 目次データをHTMLから直接構造化（h2, h3を対象）
  const tocStructure = [];
  let currentH2 = null;
  let currentH3 = null;

  document.querySelectorAll('h2, h3').forEach(el => {
    const tag = el.tagName;
    const text = el.textContent.trim();
    const href = `#${el.id}`;
    // const elId = el.id || el.getAttribute('data-id') || text;
    // const href: `#${elId}`,

    if (tag === 'H2') {
      currentH2 = { text, href, children: [] };
      tocStructure.push(currentH2);
      currentH3 = null;
    } else if (tag === 'H3' && currentH2) {
      currentH3 = { text, href, children: [] };
      currentH2.children.push(currentH3);
    } else if (tag === 'H4' && currentH3) {
      currentH3.children.push({ text, href });
    }
  });

  // 要素作成・設定関数
  const setTocElm = (elm, className, child, snd) => {
    elm.className = className;
    if (child) {
      const a = elm.appendChild(document.createElement('a'));
      a.href = child.href;
      a.textContent = (child.text || child.textContent || '').replace(/[§⏰]/g, '');
    }
    if (snd) elm.addEventListener('mouseenter', () => playAudio(snd));
  };

  // 各要素に目次メニューを追加
  document.querySelectorAll('header, h2, h1').forEach(elm => {
    const tocMenu = document.createElement('div');
    setTocElm(tocMenu, "toc-menu", null, "audio_toc");
    // tocMenu.innerHTML = '<i class="fa-solid fa-bars"></i>';
    tocMenu.innerHTML = ''; //  

    const ul = document.createElement('ul');
    ul.className = "toc-ul";
    ul.addEventListener('click', () => playAudio('audio_click'));

    // 表紙項目
    const coverLi = document.createElement('li');
    setTocElm(coverLi, "toc-li", {href: '#', text: '表紙'}, "audio_hover");
    ul.appendChild(coverLi);

    // 目次項目
    tocStructure.forEach(h2Item => {
      const h2Li = document.createElement('li');
      setTocElm(h2Li, "toc-li h2", h2Item, "audio_hover");

      if (h2Item.children.length > 0) {
        const h3Ul = document.createElement('ul');
        h2Item.children.forEach(h3Item => {
          const h3Li = document.createElement('li');
          setTocElm(h3Li, "toc-li h3", h3Item, "audio_hover");
          h3Ul.appendChild(h3Li);
        });
        h2Li.appendChild(h3Ul);
      }
      ul.appendChild(h2Li);
    });

    tocMenu.appendChild(ul);
    elm.nodeName === 'HEADER' ? elm.appendChild(tocMenu) : elm.before(tocMenu);
  });
});
</script>
