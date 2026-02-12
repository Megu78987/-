# HiddenVC

Discordサーバー向け「隠しボイスチャンネル」自動管理BOT

## 概要

HiddenVCは、ユーザーごとに一時的な「隠しボイスチャンネル」を作成・削除できるDiscord BOTです。  
管理パネルから簡単に裏通話の作成・削除・招待ができます。

## 必要要件

- Node.js v18以上
- Discord BOTアカウント

## インストール

1. このリポジトリをクローン
2. 依存パッケージをインストール

```sh
npm install
```

## .envファイルの設定

ルートディレクトリに`.env`ファイルを作成し、以下の内容を記入してください。  
（`.env_example`も参考にできます）

```
DISCORD_TOKEN=あなたのDiscordBotトークン
BOT_CLIENT_ID=あなたのBotのクライアントID
```

## スラッシュコマンドの登録

初回のみ、以下のコマンドでスラッシュコマンドを登録します。

```sh
npx ts-node src/slashCommand.ts
```

## BOTの起動

TypeScriptのまま起動する場合：

```sh
npx ts-node src/hiddenVC.ts
```

ビルドしてから起動する場合：

```sh
npx tsc
node dist/hiddenVC.js
```

## 使い方

1. サーバー管理者が `/set_hidden_vc_panel` コマンドを実行し、管理パネルを設置
2. パネルの「裏通話を作成」ボタンで自分専用の隠しボイスチャンネルを作成
3. 「ユーザ招待」ボタンで他のユーザーを招待可能
4. 誰もいなくなったチャンネルは自動で削除されます

## 注意事項

- `guildChannels.json`はチャンネル管理用の一時ファイルです。  
- `.env`や`guildChannels.json`は`.gitignore`で管理されています。

## ライセンス

MIT License
