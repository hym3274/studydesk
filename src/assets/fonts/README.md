# Noto Sans JP

`noto-sans-jp-ui.woff` はNoto Sans JP（Version 2.04、可変weight 100–900）のUI用サブセットです。駒と盤の座標以外の、メニュー・ダイアログ・手番・棋譜・ロゴ等で使用します。

元フォント：既存の `NotoSansJP-VF.ttf`。この作業ではWindowsにインストール済みのNoto Sans JPを使用しました。サブセット前後でフォントのfamily名・文字の収録・ライセンス情報を検証しています。

Copyright 2014–2021 Adobe, with Reserved Font Name 'Source'. SIL Open Font License 1.1に従います。全文は [`public/fonts/OFL-NotoSansJP.txt`](../../../public/fonts/OFL-NotoSansJP.txt) にあり、ビルド後も `fonts/OFL-NotoSansJP.txt` に含まれます。

公式情報：[Google Fontsのフォント情報](https://github.com/google/fonts/tree/main/ofl/notosansjp)、[Noto CJK](https://github.com/notofonts/noto-cjk)。元フォントの入手先を変更する場合も、その配布物のライセンスを確認してください。

## 文言の追加・再生成

現在の `src` 内のTS / TSX / CSS / SVGと `index.html` の文字、ASCII、仮名、日本語句読点、全半角文字を収録しています。現在の文言に必要な文字が欠けていないことは、生成スクリプトで検証します。未収録の文字はシステム書体にフォールバックするため、新しいUI文言やゲームを追加した場合は以下で再生成してください。

```sh
python scripts/subset-ui-font.py /path/to/NotoSansJP-VF.ttf
```

再生成にはPythonとFontToolsが必要です。今回の環境には既に入っているものを使用し、新たなパッケージは導入していません。生成済みWOFFをGit管理するので、通常の `npm ci` / テスト / ビルド / GitHub ActionsにはPythonもFontToolsも不要です。

WOFFはzlib圧縮を使い、外部のBrotliライブラリを必要としません。文字の形やweightは変更せず、未使用の文字を削って全体約9.6MBの元TTFから約240KBに縮小しています。フォントファイルの名前をCSSのURL参照で指定し、Viteがサブパス対応のアセットとしてビルドします。`font-display: swap` により、初回のフォント読み込み中もUIテキストを表示します。
