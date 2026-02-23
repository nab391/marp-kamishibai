<!-- mermaid.jsを読み込む -->
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true });
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
