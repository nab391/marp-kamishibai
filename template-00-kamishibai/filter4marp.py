import argparse
import sys
import re
import os
import importlib.util

###### {{{classname ... }}}
# - {{{classname →<div class="classname">\n
# - }}}          →</div>
def replace_class(text):
    pattern = r'^{{{{*\s*([a-zA-Z0-9_ -]+)$'
    text = re.sub(pattern, lambda m: f'<div class="{m.group(1)}">\n',
                  text, flags=re.MULTILINE)
    text = re.sub(r'^}}}}*(.*)$', lambda m: f'</div>\n',
                  text, flags=re.MULTILINE)
    return text

###### callouts対応
def convert_callouts(text):
    icons_dict = {
        'INFO': '', # 󰋽 
        'NOTE': '',
        'TODO': '',
        'TIP': '',
        'HINT': '',
        'ABSTRACT': '',
        'SUMMARY': '󰨸',
        'TLDR': '󰨸',
        'QUESTION': '', # 󰘥 
        'SUCCESS': '',
        'IMPORTANT': '󰅾',
        'CAUTION': '󰒡',
        'ALERT': '󰀪', #  󰀪
        'WARNING': '',
        'BUG': '',
        'ERROR': '',
        'FAIL': '',
        'FAILURE': '',
        'DANGER': '⚡', # 󱐌⚡
        'QUOTE': '୨୧', #  󱆨 ୨୧
        'EXAMPLE': '󰉹', # 󰉹 
        'STICKY': '󰐃',
        'TEA': ' ',
    }

    #pattern = r"^>\s*\[!(.+?)\]\s*(.+?)\n((?:^>.*(?:\n|$))+)" # 複数行のみ対応
    pattern = r"^>\s*\[!(.+?)\]\s*(.+?)\n(?:((?:^>.*(?:\n|$))*))?" # 1行のみも対応

    def replace_func(m):
        # 1行目：アイコンとタイトル
        callout_type = m.group(1).strip().upper()
        icon = icons_dict.get(callout_type, '') # fallback=infoアイコン
        title = m.group(2).strip()

        # 2行目以降：本文
        raw_body = m.group(3)
        body_lines = raw_body.strip().splitlines() if raw_body else ""
        body = "\n".join("<p>" + line[1:].strip() + "</p>" for line in body_lines if line.startswith('>'))

        # HTMLに変換
        html = f'''
<div class="callout" data-callout="{callout_type}">
  <div class="callout-title">
    <div class="callout-title-icon">{icon}</div>&nbsp;
    <div class="callout-title-inner">{title}</div>
  </div>
  <div class="callout-content">{body}</div>
</div>'''
        # デバッグ用
        #print(m.groups())
        #print((callout_type, title, body))
        #print(html)
        return html

    return re.sub(pattern, replace_func, text, flags=re.MULTILINE)

###### ***を<hr>\nに置き換える
def replace_hr(text):
    pattern = r'^\*\*\*\**$'
    return re.sub(pattern, '<hr>\n', text, flags=re.MULTILINE)

###### H2タイトルに番号付けする
# "## marker#num#title" を "## marker{count}title" に置き換え
def replace_h2_with_count(text):
    pattern = r'^(##)\s+(.*)#num#(.*)$'
    count_dict = {}

    def replace_func(m):
        prefix, marker, title = m.groups()
        count_dict[title] = len(count_dict) + 1
        return f'{prefix} {marker}{count_dict[title]}{title}'

    return re.sub(pattern, replace_func, text, flags=re.MULTILINE)

###### headerに番号付けする
# before: <!-- header: 'marker#cond#title<post-str
# after:  <!-- header: 'marker{count}title<post-str
def replace_header_with_count(text):
    #pattern = r"^<!-- header: '(.*?)(#.*#)(.*?)(<.*)*' -->$"
    pattern = r"^<!-- (header:.*')(.*?)(#.*#)(.*?)(<[^']*)*('.*)*$"
    #                  pre       marker cond title post     end
    count_dict = {}

    def replace_func(m):
        tmp = m.groups()
        pre, marker, cond, title, post, end = [t if t else "" for t in tmp]
        #print(f"pre:{pre}, marker:{marker}, cond:{cond}, title:{title}, post:{post}, end:{end}")
        cnt = len(count_dict)
        text = marker + f"{cnt}" + title
        if cond == "#num#":
            if text not in count_dict:
                cnt += 1
                text = marker + f"{cnt}" + title
                count_dict[text] = cnt
        else:
            text = [k for k, v in count_dict.items() if v == cnt][0]

        #print(f"output:{pre}{text}{post}{end}")
        return f"<!-- {pre}<div>{text}</div>{post}{end}"

    return re.sub(pattern, replace_func, text, flags=re.MULTILINE)

###### メイン処理 ######
def main():
    # 引数処理
    parser = argparse.ArgumentParser(description='usage: filter4marp.py [-h] [--input <filepath>] [--output <filepath>]')
    parser.add_argument('-i', '--input', default=None)
    parser.add_argument('-o', '--output', default=None)
    args = parser.parse_args()

    # 入力テキスト取得
    if args.input:
        with open(args.input, encoding="UTF-8") as f:
            text = f.read()
    else:
        text = sys.stdin.read()
    #print(text) # for debug

    # フィルター通す
    text = replace_class(text)
    text = convert_callouts(text)
    text = replace_hr(text)
    #text = replace_h2_with_count(text)
    #text = replace_header_with_count(text)

    # 出力
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(text)
    else:
        sys.stdout.write(text)

if __name__ == "__main__":
    main()
