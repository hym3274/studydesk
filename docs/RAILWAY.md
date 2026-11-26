# Railwayで将棋の通信対戦を動かす

1. Railwayで空のサービスを作り、Public Networkingでドメインを発行します。ターゲットポートは `8080` です。
2. サービス変数に `PORT=8080` と `RAILWAY_DOCKERFILE_PATH=Dockerfile.railway` を設定し、Healthcheck Pathに `/health` を設定します。
3. GitHubの `hym3274/studydesk` を接続し、`codex/rooms-railway` ブランチを1レプリカでデプロイします。ビルドはRailwayが設定する `RAILWAY_PUBLIC_DOMAIN` を単体HTMLの接続先に使います。
4. 公開URLの `/health` が `ok` を返すことを確認します。対戦する2人は、同じ公開URLの `/desk.html` からHTMLをダウンロードします。

部屋はサーバーのメモリに保存されます。サービスの停止や再起動で進行中の部屋は失われます。

[公開ドメインの設定](https://docs.railway.com/networking/domains/working-with-domains) ・ [Dockerfileの設定](https://docs.railway.com/builds/dockerfiles)
