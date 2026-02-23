## ◆Dockerのビルド手順

一般的な[Dockerの手順](https://docs.docker.com/engine/reference/builder/)と同様です。スクリプト化してます。
1. ==Githubからダウンロード==（clone）
2. ==build-marp.sh\|batを実行==

この手順で、markdownファイルの分割＆結合、markdownの書式の拡張、  
独自書式対応のフィルター、の全てが組み込まれています。

##### 補足
なぜ、marpをフォルダ分けしているかの理由ですが、  
marpと並行して使いたい他のツールもあるためです。  
つまり、将来の拡張のために事前に分けてます。

