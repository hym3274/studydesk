# Koyebで将棋の通信対戦を動かす

Web Service のビルダーに Dockerfile を選び、パスに `Dockerfile.koyeb` を指定します。作業ディレクトリはリポジトリのルートです。

| 項目 | 設定 |
| --- | --- |
| 公開ポート | 8080（HTTP） |
| 公開パス | `/` |
| HTTPヘルスチェック | `/health` |
| 配置 | 1リージョン、最大1インスタンス |

部屋と棋譜はサーバーのメモリにあります。インスタンスの再起動や新しいデプロイで、進行中の部屋は終了します。

ビルド時に Koyeb の `KOYEB_PUBLIC_DOMAIN` を使って、対戦サーバーの HTTPS アドレスを単体HTMLに組み込みます。起動後は公開URLの `/health` が `ok` を返すことを確認し、両方の端末で同じサービスの `/desk.html` をダウンロードして対戦します。別々のサーバーで発行した部屋コードは共有されません。

[GitHubからの配置](https://www.koyeb.com/docs/build-and-deploy/deploy-with-git) ・ [Koyebの環境変数](https://www.koyeb.com/docs/reference/environment-variables)
