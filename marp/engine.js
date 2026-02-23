import mdItAnchor       from 'markdown-it-anchor' // # str → <h1 id="#str">str</h1>
import mdItAttrs        from 'markdown-it-attrs' // {.name} → <* class="name">
import mdItCjkBreaks    from 'markdown-it-cjk-breaks'
import mdItContainer    from 'markdown-it-container' // :::name → <div class="name">
import mdItFootnote     from 'markdown-it-footnote' // [^1] & [^1]: str
import mdItMark         from 'markdown-it-mark' // == → <mark>
// import mdItMermaid      from '@wekanteam/markdown-it-mermaid'
import mdItNamedCodeBlocks from 'markdown-it-named-code-blocks' // ```js:hello.js
import mdItRuby         from 'markdown-it-ruby' // ruby for Kanji
import mdItSpans        from 'markdown-it-bracketed-spans' // [str]{.name} → <span class="name">str</span>
import mdItSub          from 'markdown-it-sub' // a~str~ → a<sub>str</sub>
import mdItSup          from 'markdown-it-sup' // a^str^ → a<sup>str</sup>
import mdItUnderline    from 'markdown-it-underline' // _str_ → <u>

export default ({ marp }) => {
    // 1. カスタムディレクティブ 'scene' を登録
    // これを記述することで が解析対象になります
    marp.customDirectives.local.scene = (value) => {
        return { scene: value };
    };

    // 2. 解析された scene を <section> の data-scene 属性に付与するフック
    marp.markdown.core.ruler.push('scene_to_section', (state) => {
        state.tokens.forEach((token) => {
            if (token.meta && token.meta.marpitDirectives && token.meta.marpitDirectives.scene) {
                const sceneValue = token.meta.marpitDirectives.scene;
                // marpit は 'marpit_slide_open' トークン等に属性を集約します
                token.attrSet('data-scene', sceneValue);
            }
        });
    });

    // const originalRender = marp.markdown.render;
    marp
    .use(mdItAnchor, {
        level: [2, 3],
        slugify: s => s.trim().toLowerCase().replace(/[^\w一-龠ぁ-んァ-ン]/g, '-'),
        permalink: false
    })
    .use(mdItAttrs)
    .use(mdItCjkBreaks)
    .use(mdItContainer, '_')
    .use(mdItContainer, '__')
    .use(mdItContainer, 'yoko')
    .use(mdItContainer, 'float')
    .use(mdItContainer, 'info')
    .use(mdItContainer, 'note', { validate: params => params.trim().startsWith('note:') })
    .use(mdItContainer, 'stamp')
    .use(mdItFootnote)
    .use(mdItMark)
    // .use(mdItMermaid)
    .use(mdItNamedCodeBlocks)
    .use(mdItRuby)
    .use(mdItSpans)
    .use(mdItSub)
    .use(mdItSup)
    .use(mdItUnderline)

    return marp;
};
