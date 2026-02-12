import { Client, ChannelType, PermissionFlagsBits } from "discord.js";
import log4js from "log4js";
log4js.configure({
    appenders: { out: { type: "stdout" } },
    categories: { default: { appenders: ["out"], level: "info" } }
});
const logger = log4js.getLogger();

// 裏通話（隠しボイスチャンネル）を管理するクラス
export class HiddenVoiceChannelManager {
    // ユーザーIDごとに作成したチャンネルIDを保存するMap
    guildChannels: Map<string, Map<string, string>>;
    //チャンネルに一人でも参加したかどうかを保存するMap
    channelJoined: Map<string, boolean>;
    // Botのクライアント
    client: Client;
    constructor(client: Client) {
        this.client = client;
        this.guildChannels = new Map();
        this.channelJoined = new Map();

        this.load();
    }

    save() {
        // guildChannelsをJSON形式で保存
        // MapをArrayに変換して保存
        const guildChannelsArray = Array.from(this.guildChannels.entries()).map(([guildID, channels]) => {
            return [guildID, Array.from(channels.entries())];
        });
        // JSON形式に変換
        const json = JSON.stringify(guildChannelsArray, null, 2);
        // ファイルに保存
        const fs = require('fs');
        fs.writeFileSync('guildChannels.json', json, 'utf-8');
        logger.info("guildChannels saved to guildChannels.json");
    }

    load() {
        // guildChannelsをJSON形式で読み込み
        const fs = require('fs');
        if (fs.existsSync('guildChannels.json')) {
            // ファイルが存在する場合は読み込む
            const data = fs.readFileSync('guildChannels.json', 'utf-8');
            // JSON形式からMapに変換
            const arr: [string, [string, string][]][] = JSON.parse(data);
            this.guildChannels = new Map(arr.map(([guildID, channels]) => {
                return [guildID, new Map(channels)];
            }));
            logger.info("guildChannels loaded from guildChannels.json");
        }
        else {
            // ファイルが存在しない場合は空のMapを作成
            this.guildChannels = new Map();
            logger.info("guildChannels.json not found, creating empty map");
        }
    }

    exists(guildID: string, userID: string) {
        // guildが存在するか確認
        const guild = this.guildChannels.get(guildID);
        if (!guild) {
            return false;
        }
        // チャンネルが存在するかどうかを確認
        return guild.has(userID);
    }

    existsChannel(guildID: string, channelID: string) {
        let guildChannels = this.guildChannels.get(guildID);
        if (!guildChannels) {
            return false;
        }
        // チャンネルが存在するかどうかを確認
        for (const [userID, id] of guildChannels) {
            if (id === channelID) {
                return true;
            }
        }
        return false;
    }
    // チャンネルに参加したかどうかを確認する関数
    // channelID: チャンネルID
    setJoined(channelID: string) {
        this.channelJoined.set(channelID, true);
    }

    getJoined(channelID: string) {
        // チャンネルが存在するか確認
        const channel = this.channelJoined.get(channelID);
        // ユーザーが参加したかどうかを確認
        return channel;
    }

    //チャンネルの一次元配列を取得する関数
    getChannelArray() {
        const channelIdArray: string[] = [];
        for (const [guildID, channels] of this.guildChannels) {
            for (const [userID, channelID] of channels) {
                channelIdArray.push(channelID);
            }
        }
        return channelIdArray;
    }

    // 裏通話を作成する関数
    async createHiddenVoiceChannel(guildID: string, parentID: string | null, userID: string, channelName: string) {
        let guildChannels = this.guildChannels.get(guildID);
        // guildが存在しない場合は新しく作成
        if (!guildChannels) {
            this.guildChannels.set(guildID, new Map());
            guildChannels = this.guildChannels.get(guildID);
        }
        if (!guildChannels) {
            logger.error("Failed to create guild map");
            return null;
        }

        // すでにチャンネルが存在する場合は何もしない
        if (guildChannels.has(userID)) {
            logger.warn(`Channel already exists for user ${userID}`);
            return null;
        }

        try {
            logger.info(`Create channel with userID ${userID}`);
            // サーバー情報を取得してチャンネルを作成
            const guild = await this.client.guilds.fetch(guildID);
            // Bot自身のIDを取得
            const botMember = await guild.members.fetchMe();
            const botID = botMember.user.id;

            const channel = await guild.channels.create({
                name: channelName, // チャンネル名
                type: ChannelType.GuildVoice, // ボイスチャンネル
                // 権限設定：サーバー全体には非表示、自分だけ見える
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: userID,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
                    },
                    {
                        id: botID,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels],
                    },
                ],
                parent: parentID, // 親カテゴリ
            });

            // 作成したチャンネルIDを記録
            guildChannels.set(userID, channel.id);
            logger.info(`Created channel ${channel.name} with ID ${channel.id}`);
            this.save();

            return channel;
        } catch (error) {
            logger.error("Error creating channel:", error);
            this.save();

            return null;
        }
    }

    // 裏通話を削除する関数
    async deleteHiddenVoiceChannel(guildID: string, userID: string) {
        let guildChannels = this.guildChannels.get(guildID);
        // guildが存在しない場合は何もしない
        if (!guildChannels) {
            logger.warn(`No channels found for guild ${guildID}`);
            return null;
        }
        // チャンネルが存在しない場合は何もしない
        if (!guildChannels.has(userID)) {
            logger.warn(`No channel found for user ${userID}`);
            return null;
        }

        try {
            // サーバー情報を取得してチャンネルを削除
            const channelID = guildChannels.get(userID);
            const channel = await this.client.channels.fetch(channelID!);
            if (channel && channel.type === ChannelType.GuildVoice) {
                // チャンネルを削除
                await channel.delete();
                logger.info(`Deleted channel ${channel.name} with ID ${channel.id}`);
                guildChannels.delete(userID);
            }
        } catch (error) {
            logger.error("Error deleting channel:", error);
        }
        this.save();
    }

    getChannelOwner(guildID: string, channelID: string) {
        // guildが存在するか確認
        const guildChannels = this.guildChannels.get(guildID);
        if (!guildChannels) {
            logger.warn(`No channels found for guild ${guildID}`);
            return null;
        }
        // チャンネルのオーナーを取得
        for (const [userID, id] of guildChannels) {
            if (id === channelID) {
                return userID;
            }
        }

        return null;
    }
}