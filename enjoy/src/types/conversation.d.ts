type ConversationType = {
  id: string;
  type: "gpt" | "tts";
  engine: "openai" | "ollama";
  name: string;
  configuration: { [key: string]: any };
  model: string;
  language?: string;
  messages?: MessageType[];
  createdAt?: string;
};
