export type PromptCrop = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ConversationImage = {
  src: string;
  promptCrop?: Partial<PromptCrop>;
};

export type ConversationRecord = {
  slug?: string;
  date?: string;
  title?: string;
  tags?: string[];
  model?: string;
  topic?: string;
  image?: ConversationImage;
};

export type Conversation = {
  slug: string;
  date: string;
  title: string;
  tags: string[];
  model?: string;
  topic?: string;
  image: {
    src: string;
    promptCrop: PromptCrop;
  };
  sourceFile: string;
};
