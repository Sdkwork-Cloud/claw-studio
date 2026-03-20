import type { ChatModel } from '../types/index.ts';

export type ChatComposerModelStatus =
  | 'idle'
  | 'streaming-current-model'
  | 'streaming-next-model-selected';

export interface ChatComposerModelState {
  selectedModelName: string;
  inFlightModelName: string | null;
  nextModelName: string | null;
  status: ChatComposerModelStatus;
}

interface DeriveChatComposerModelStateParams {
  activeModel?: Pick<ChatModel, 'name'> | null;
  inFlightModelName?: string | null;
  isLoading: boolean;
}

const UNKNOWN_MODEL_NAME = 'Unknown Model';

export function deriveChatComposerModelState({
  activeModel,
  inFlightModelName = null,
  isLoading,
}: DeriveChatComposerModelStateParams): ChatComposerModelState {
  const selectedModelName = activeModel?.name || UNKNOWN_MODEL_NAME;

  if (!isLoading || !inFlightModelName) {
    return {
      selectedModelName,
      inFlightModelName: null,
      nextModelName: null,
      status: 'idle',
    };
  }

  if (inFlightModelName === selectedModelName) {
    return {
      selectedModelName,
      inFlightModelName,
      nextModelName: null,
      status: 'streaming-current-model',
    };
  }

  return {
    selectedModelName,
    inFlightModelName,
    nextModelName: selectedModelName,
    status: 'streaming-next-model-selected',
  };
}
