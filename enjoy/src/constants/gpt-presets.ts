import {
  ChatAgentTemplate,
  LocalizedChatAgentTemplate,
  localizeChatAgentTemplates,
} from "./chat-agent-templates";

const DEFAULT_GPT_PRESET_CONFIGURATION = {
  type: "gpt",
  model: "gpt-4o",
  baseUrl: "",
  temperature: 0.2,
  numberOfChoices: 1,
  maxTokens: 2048,
  presencePenalty: 0,
  frequencyPenalty: 0,
  historyBufferSize: 0,
  tts: {
    baseUrl: "",
    engine: "openai",
    model: "tts-1",
    voice: "alloy",
  },
};

export const chatAgentTemplateToGptPreset = (
  template: ChatAgentTemplate | LocalizedChatAgentTemplate
) => {
  const name =
    typeof template.name === "string" ? template.name : template.name.en;

  return {
    key: template.key,
    name,
    engine: "openai",
    configuration: {
      ...DEFAULT_GPT_PRESET_CONFIGURATION,
      roleDefinition: template.prompt,
    },
  };
};

export const getGptPresets = (locale?: string) =>
  localizeChatAgentTemplates(locale).map(chatAgentTemplateToGptPreset);

export const GPT_PRESETS = getGptPresets();
