import { createContext, useEffect, useState, useContext } from "react";
import {
  AISettingsProviderContext,
  AppSettingsProviderContext,
  HotKeysSettingsProviderContext,
} from "@renderer/context";
import i18next, { t } from "i18next";
import {
  DEFAULT_CHAT_AGENT_TEMPLATE_KEY,
  DEFAULT_GPT_CONFIG,
  chatAgentTemplateToDto,
  getChatAgentPresetSource,
  getDefaultChatAgentTemplate,
} from "@/constants";
import { useHotkeys } from "react-hotkeys-hook";
import { ChatAgentTypeEnum, ChatTypeEnum } from "@/types/enums";

type CopilotProviderState = {
  active: boolean;
  setActive: (active: boolean) => void;
  currentChat: ChatType;
  setCurrentChat: (chat: ChatType) => void;
  occupiedChat: ChatType | null;
  setOccupiedChat: (chat: ChatType | null) => void;
  buildAgentMember: (agent: ChatAgentType) => ChatMemberDtoType;
};

const initialState: CopilotProviderState = {
  active: false,
  setActive: () => null,
  currentChat: null,
  setCurrentChat: () => null,
  occupiedChat: null,
  setOccupiedChat: () => null,
  buildAgentMember: () => null,
};

export const CopilotProviderContext =
  createContext<CopilotProviderState>(initialState);

const CACHE_KEY = "copilot-cached-chat";

export const CopilotProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [active, setActive] = useState(false);
  const [currentChat, setCurrentChat] = useState<ChatType>(null);
  const [occupiedChat, setOccupiedChat] = useState<ChatType | null>(null);
  const { EnjoyApp } = useContext(AppSettingsProviderContext);
  const { sttEngine, currentGptEngine, ttsConfig } = useContext(
    AISettingsProviderContext
  );
  const { currentHotkeys } = useContext(HotKeysSettingsProviderContext);

  const findOrCreateChat = async () => {
    if (currentChat) return;

    const cachedChatId = await EnjoyApp.cacheObjects.get(CACHE_KEY);
    let chat: ChatType;
    if (cachedChatId && cachedChatId !== occupiedChat?.id) {
      chat = await EnjoyApp.chats.findOne({
        where: { id: cachedChatId },
      });
      if (chat?.type === ChatTypeEnum.TTS) {
        chat = null;
      }
    } else if (occupiedChat) {
      const chats = await EnjoyApp.chats.findAll({});
      chat = chats.find(
        (chat) =>
          chat.id !== occupiedChat.id && chat.type !== ChatTypeEnum.TTS
      );
    } else {
      const chats = await EnjoyApp.chats.findAll({});
      chat = chats.find((chat) => chat.type !== ChatTypeEnum.TTS);
    }

    if (chat && chat.id !== occupiedChat?.id) {
      setCurrentChat(chat);
    } else {
      const agent = await findOrCreateChatAgent();
      const chat = await EnjoyApp.chats.create({
        name: t("newChat"),
        config: {
          sttEngine,
        },
        members: [buildAgentMember(agent)],
      });
      setCurrentChat(chat);
    }
  };

  const findOrCreateChatAgent = async () => {
    const defaultSource = getChatAgentPresetSource(
      DEFAULT_CHAT_AGENT_TEMPLATE_KEY
    );
    let agent = await EnjoyApp.chatAgents.findOne({
      where: { type: ChatAgentTypeEnum.GPT, source: defaultSource },
    });
    if (agent) {
      return agent;
    }

    return await EnjoyApp.chatAgents.create(
      chatAgentTemplateToDto(getDefaultChatAgentTemplate(), i18next.language)
    );
  };

  const buildAgentMember = (agent: ChatAgentType): ChatMemberDtoType => {
    const config =
      agent.type === ChatAgentTypeEnum.TTS
        ? {
            tts: {
              engine: ttsConfig.engine,
              model: ttsConfig.model,
              voice: ttsConfig.voice,
              language: ttsConfig.language,
              ...agent.config?.tts,
            },
          }
        : {
            gpt: {
              ...DEFAULT_GPT_CONFIG,
              engine: currentGptEngine.name,
              model: currentGptEngine.models.default,
            },
            tts: {
              engine: ttsConfig.engine,
              model: ttsConfig.model,
              voice: ttsConfig.voice,
              language: ttsConfig.language,
            },
          };
    return {
      userId: agent.id,
      userType: "ChatAgent",
      config,
    };
  };

  useEffect(() => {
    if (active) {
      findOrCreateChat();
    } else {
      setCurrentChat(null);
    }
  }, [active]);

  useEffect(() => {
    if (!currentChat) return;

    EnjoyApp.cacheObjects.set(CACHE_KEY, currentChat.id);
    if (!active) {
      setActive(true);
    }
  }, [currentChat]);

  useHotkeys(currentHotkeys.OpenCopilot, () => {
    setActive(!active);
  });

  return (
    <CopilotProviderContext.Provider
      value={{
        active,
        setActive,
        currentChat,
        setCurrentChat,
        occupiedChat,
        setOccupiedChat,
        buildAgentMember,
      }}
    >
      {children}
    </CopilotProviderContext.Provider>
  );
};
