// Discord.jsの必要なクラスや関数をインポート
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChannelType,
    Client,
    EmbedBuilder,
    GatewayIntentBits,
    Interaction,
    MessageFlags,
    UserSelectMenuBuilder,
    ChatInputCommandInteraction
} from "discord.js";
import dotenv from "dotenv";
import { HiddenVoiceChannelManager } from "./HiddenVoiceChannelManager";
import cron from "node-cron";
import log4js from "log4js";
import express from "express"; // Renderスリープ防止用に追加

// ログの設定
log4js.configure({
    appenders: { out: { type: "stdout" } },
    categories: { default: { appenders: ["out"], level: "info" } }
});
const logger = log4js.getLogger();

dotenv.config();

// --- Render用Webサーバーの起動 ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("HiddenVC Bot is Running!");
});

app.listen(PORT, () => {
    logger.info(`Web server is listening on port ${PORT}`);
});
// ------------------------------

// Discord Botのクライアントを作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

// 管理クラスのインスタンス作成
const hiddenChannelManager = new HiddenVoiceChannelManager(client);

// 起動イベント
client.on("ready", async () => {
    logger.info("Bot is ready!");
});

// --- コマンド処理関数 ---

// /ping コマンド
async function handlePingCommand(interaction: ChatInputCommandInteraction) {
    logger.info(`/ping command executed by ${interaction.user.tag}`);
    await interaction.reply('Pong!');
}

// /set_hidden_vc_panel コマンド
async function handleSetHiddenVCPanelCommand(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) {
        await interaction.reply('このコマンドはサーバー内で実行してください');
        return;
    }

    const channel = interaction.channel;
    if (channel?.type !== ChannelType.GuildText) {
        await interaction.reply('このコマンドはテキストチャンネル内で実行してください');
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('裏通話')
        .setDescription('ここから裏通話の操作ができます。')
        .setColor(0x00bfff);

    const vcCreateButton = new ButtonBuilder()
        .setCustomId('hidden_vc_create')
        .setLabel('裏通話を作成')
        .setStyle(ButtonStyle.Primary);

    const vcDeleteButton = new ButtonBuilder()
        .setCustomId('hidden_vc_delete')
        .setLabel('裏通話を削除')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(vcCreateButton, vcDeleteButton);

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'パネルを作成しました。', flags: MessageFlags.Ephemeral });
    logger.info("Hidden VC panel created.");
}

// 「裏通話を作成」ボタン
async function handleHiddenVCCreateButton(interaction: ButtonInteraction) {
    logger.info(`hidden_vc_create button pressed by ${interaction.user.tag}`);
    const channel = interaction.channel;
    if (channel && channel.type == ChannelType.GuildText) {
        const parentChannelId = channel.parentId;

        const voiceChannel = await hiddenChannelManager.createHiddenVoiceChannel(channel.guild.id, parentChannelId!, interaction.user.id, `${interaction.user.displayName}の部屋`);

        if (voiceChannel) {
            const inviteButton = new ButtonBuilder()
                .setCustomId('hidden_vc_invite')
                .setLabel('ユーザ招待')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(inviteButton);

            voiceChannel.send({ content: `${interaction.user}さんの部屋を作成しました。各種設定は以下のボタンから行ってください`, components: [row] });
            interaction.reply({ content: `裏通話を作成しました: ${voiceChannel}`, flags: MessageFlags.Ephemeral });
            logger.info(`Hidden VC created for user ${interaction.user.tag}`);
            return;
        }

        if (hiddenChannelManager.exists(channel.guild.id, interaction.user.id)) {
            interaction.reply({ content: `裏通話はすでに存在します`, flags: MessageFlags.Ephemeral });
            return;
        }
    }
    interaction.reply({ content: `裏通話の作成に失敗しました`, flags: MessageFlags.Ephemeral });
}

// 「裏通話を削除」ボタン
async function handleHiddenVCDeleteButton(interaction: ButtonInteraction) {
    const channel = interaction.channel;
    if (channel && channel.type == ChannelType.GuildText) {
        if (!hiddenChannelManager.exists(channel.guild.id, interaction.user.id)) {
            interaction.reply({ content: `裏通話は存在しません`, flags: MessageFlags.Ephemeral });
            return;
        }

        const voiceChannel = await hiddenChannelManager.deleteHiddenVoiceChannel(channel.guild.id, interaction.user.id);
        if (!voiceChannel) {
            interaction.reply({ content: `裏通話を削除しました`, flags: MessageFlags.Ephemeral });
            return;
        }
    }
    interaction.reply({ content: `裏通話の削除に失敗しました`, flags: MessageFlags.Ephemeral });
}

// 「ユーザ招待」ボタン
async function handleHiddenVCInviteButton(interaction: ButtonInteraction) {
    if (!interaction.guildId || !interaction.channelId) return;
    
    const channelOwner = hiddenChannelManager.getChannelOwner(interaction.guildId, interaction.channelId);
    if (interaction.user.id != channelOwner) {
        interaction.reply({ content: `あなたはこのチャンネルのオーナーではありません`, flags: MessageFlags.Ephemeral });
        return;
    }

    const userSelectMenu = new UserSelectMenuBuilder()
        .setCustomId('user_select')
        .setPlaceholder('招待するユーザを選択してください');

    interaction.reply({
        content: '招待するユーザを選択してください',
        components: [new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelectMenu)],
        flags: MessageFlags.Ephemeral
    });
}

// 招待メニュー処理
async function handleUserSelectMenu(interaction: any, client: Client) {
    const selectedUser = interaction.values[0];
    const channel = interaction.channel;
    if (channel && channel.type == ChannelType.GuildVoice) {
        await channel.permissionOverwrites.edit(selectedUser, {
            ViewChannel: true,
            Connect: true
        });
        await interaction.reply({ content: `<@${selectedUser}>さんを招待しました`, flags: MessageFlags.Ephemeral });
        client.users.fetch(selectedUser).then(user => {
            user.send(`あなたは${channel}に招待されました。`);
        }).catch(err => logger.error(`DM failed:`, err));
    }
}

// インタラクション受け取り
client.on("interactionCreate", async (interaction: Interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'ping') await handlePingCommand(interaction);
            if (interaction.commandName === 'set_hidden_vc_panel') await handleSetHiddenVCPanelCommand(interaction);
        }
        if (interaction.isButton()) {
            if (interaction.customId === 'hidden_vc_create') await handleHiddenVCCreateButton(interaction);
            else if (interaction.customId === 'hidden_vc_delete') await handleHiddenVCDeleteButton(interaction);
            else if (interaction.customId === 'hidden_vc_invite') await handleHiddenVCInviteButton(interaction);
        }
        if (interaction.isUserSelectMenu()) {
            if (interaction.customId === 'user_select') await handleUserSelectMenu(interaction, client);
        }
    } catch (error) {
        logger.error("Interaction Error:", error);
    }
});

// ボイス状態監視
client.on("voiceStateUpdate", async (oldState, newState) => {
    if (oldState.channelId) {
        const channel = client.channels.cache.get(oldState.channelId);
        if (channel && channel.type === ChannelType.GuildVoice) {
            const owner = hiddenChannelManager.getChannelOwner(channel.guild.id, channel.id);
            if (channel.members.size === 0 && hiddenChannelManager.getJoined(channel.id) && owner) {
                await hiddenChannelManager.deleteHiddenVoiceChannel(channel.guild.id, owner);
                logger.info(`Deleted empty channel: ${channel.name}`);
            }
        }
    }
    if (newState.channelId) {
        if(hiddenChannelManager.existsChannel(newState.guild.id, newState.channelId)){
            hiddenChannelManager.setJoined(newState.channelId);
        }
    }
});

// ログイン
client.login(process.env.DISCORD_TOKEN).then(() => {
    logger.info("Logged in!");
}).catch((err) => {
    logger.error("Login Error:", err);
});

// 定期実行（空チャンネル削除）
cron.schedule('* * * * *', () => {
    hiddenChannelManager.getChannelArray().map(async (channelId) => {
        const voiceChannel = client.channels.cache.get(channelId);
        if (voiceChannel && voiceChannel.type === ChannelType.GuildVoice) {
            const diffMinutes = Math.floor(Math.abs(new Date().getTime() - voiceChannel.createdAt.getTime()) / (1000 * 60));
            if (voiceChannel.members.size === 0 && diffMinutes > 3) {
                const owner = hiddenChannelManager.getChannelOwner(voiceChannel.guild.id, voiceChannel.id);
                if (owner) {
                    await hiddenChannelManager.deleteHiddenVoiceChannel(voiceChannel.guild.id, owner);
                    logger.info(`Cron deleted: ${voiceChannel.name}`);
                }
            }
        }
    });
});
