import { ipcMain, IpcMainEvent } from "electron";
import { Chat, ChatAgent, ChatMember } from "@main/db/models";
import { FindOptions, Attributes, Op } from "sequelize";
import log from "@main/logger";
import { t } from "i18next";
import { ChatAgentTypeEnum } from "@/types/enums";
import {
  CHAT_AGENT_PRESET_SOURCE_PREFIX,
  findChatAgentTemplate,
  getChatAgentTemplateKeyFromSource,
} from "@/constants/chat-agent-templates";

const logger = log.scope("db/handlers/chat-agents-handler");

class ChatAgentsHandler {
  private presetCreateTasks = new Map<string, Promise<ChatAgentType>>();

  private isPresetGptAgent(
    data: Pick<ChatAgentDtoType, "type" | "source">
  ) {
    return (
      data.type === ChatAgentTypeEnum.GPT &&
      data.source?.startsWith(CHAT_AGENT_PRESET_SOURCE_PREFIX)
    );
  }

  private assertValidPresetSource(
    data: Pick<ChatAgentDtoType, "type" | "source">
  ) {
    if (!this.isPresetGptAgent(data)) return;

    const templateKey = getChatAgentTemplateKeyFromSource(data.source);
    if (!templateKey || !findChatAgentTemplate(templateKey)) {
      throw new Error(t("models.chatAgent.invalidPresetSource"));
    }
  }

  private async findAll(
    _event: IpcMainEvent,
    options: FindOptions<Attributes<ChatAgent>> & { query?: string }
  ) {
    const { query, where = {} } = options || {};
    delete options.query;
    delete options.where;

    if (query) {
      (where as any)[Op.or] = [
        {
          name: {
            [Op.like]: `%${query}%`,
          },
        },
        {
          description: {
            [Op.like]: `%${query}%`,
          },
        },
        {
          source: {
            [Op.like]: `%${query}%`,
          },
        },
      ];
    }
    const agents = await ChatAgent.findAll({
      order: [["updatedAt", "DESC"]],
      where,
      ...options,
    });

    if (!agents) {
      return [];
    }
    return agents.map((agent) => agent.toJSON());
  }

  private async findOne(
    _event: IpcMainEvent,
    options: FindOptions<Attributes<ChatAgent>>
  ) {
    const agent = await ChatAgent.findOne(options);
    return agent?.toJSON();
  }

  private async create(
    _event: IpcMainEvent,
    data: {
      type: ChatAgentTypeEnum;
      name: string;
      description: string;
      source?: string | null;
      config: any;
    }
  ) {
    this.assertValidPresetSource(data);

    if (this.isPresetGptAgent(data)) {
      const key = `${data.type}:${data.source}`;
      const pending = this.presetCreateTasks.get(key);
      if (pending) {
        return pending;
      }

      const task = (async () => {
        const existing = await ChatAgent.findOne({
          where: { type: data.type, source: data.source },
        });
        if (existing) {
          return existing.toJSON();
        }

        const agent = await ChatAgent.create(data);
        return agent.toJSON();
      })();

      this.presetCreateTasks.set(key, task);
      try {
        return await task;
      } finally {
        this.presetCreateTasks.delete(key);
      }
    }

    const agent = await ChatAgent.create(data);
    return agent.toJSON();
  }

  private async update(
    _event: IpcMainEvent,
    id: string,
    data: {
      type: ChatAgentTypeEnum;
      name: string;
      description: string;
      source?: string | null;
      config: any;
    }
  ) {
    const agent = await ChatAgent.findByPk(id);
    if (!agent) {
      throw new Error(t("models.chatAgent.notFound"));
    }
    this.assertValidPresetSource(data);
    if (this.isPresetGptAgent(data)) {
      const existing = await ChatAgent.findOne({
        where: { type: data.type, source: data.source },
      });
      if (existing && existing.id !== id) {
        throw new Error(t("models.chatAgent.presetSourceExists"));
      }
    }
    await agent.update(data);
    return agent.toJSON();
  }

  private async destroy(_event: IpcMainEvent, id: string) {
    const agent = await ChatAgent.findByPk(id);
    if (!agent) {
      throw new Error(t("models.chatAgent.notFound"));
    }

    const transaction = await ChatAgent.sequelize.transaction();
    try {
      const chatMembers = await ChatMember.findAll({
        where: {
          userId: id,
        },
      });

      const chats = await Chat.findAll({
        where: {
          id: {
            [Op.in]: chatMembers.map((member) => member.chatId),
          },
        },
      });

      for (const chat of chats) {
        if (
          chat.members.filter((member) => member.userId !== id).length === 0
        ) {
          await chat.destroy({ transaction });
        }
      }
      await agent.destroy({ transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  register() {
    ipcMain.handle("chat-agents-find-all", this.findAll.bind(this));
    ipcMain.handle("chat-agents-find-one", this.findOne.bind(this));
    ipcMain.handle("chat-agents-create", this.create.bind(this));
    ipcMain.handle("chat-agents-update", this.update.bind(this));
    ipcMain.handle("chat-agents-destroy", this.destroy.bind(this));
  }

  unregister() {
    ipcMain.removeHandler("chat-agents-find-all");
    ipcMain.removeHandler("chat-agents-find-one");
    ipcMain.removeHandler("chat-agents-create");
    ipcMain.removeHandler("chat-agents-update");
    ipcMain.removeHandler("chat-agents-destroy");
  }
}

export const chatAgentsHandler = new ChatAgentsHandler();
