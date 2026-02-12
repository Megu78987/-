import { SlashCommandBuilder, REST, Routes } from "discord.js";
import dotenv from "dotenv";
import log4js from "log4js";
dotenv.config();

log4js.configure({
    appenders: { out: { type: "stdout" } },
    categories: { default: { appenders: ["out"], level: "info" } }
});
const logger = log4js.getLogger();

// スラッシュコマンドの定義
const commands = [
    new SlashCommandBuilder()
        .setName('set_hidden_vc_panel')
        .setDescription('裏通話の管理パネルを設定します')
        .setDefaultMemberPermissions(8n), // 管理者権限を持つユーザーのみ実行可能
].map(command => command.toJSON());

// コマンドをDiscordに登録
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

async function main() {
    try {
        logger.info(commands);
        await rest.put(
            Routes.applicationCommands(process.env.BOT_CLIENT_ID!),
            { body: commands }
        );
        logger.info("スラッシュコマンドを登録しました");
    } catch (error) {
        logger.error("コマンド登録エラー:", error);
    }
}

main();