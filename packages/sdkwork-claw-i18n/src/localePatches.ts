type TranslationValue =
  | null
  | boolean
  | number
  | string
  | TranslationValue[]
  | { [key: string]: TranslationValue };

type TranslationTree = { [key: string]: TranslationValue };

export type { TranslationTree, TranslationValue };

function isTranslationTree(value: unknown): value is TranslationTree {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneTranslationValue(value: TranslationValue): TranslationValue {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneTranslationValue(entry));
  }

  if (isTranslationTree(value)) {
    return mergeTranslationTree({}, value);
  }

  return value;
}

export function mergeTranslationTree<T extends TranslationTree>(
  base: T,
  patch: TranslationTree,
): T {
  const result: TranslationTree = { ...base };

  for (const [key, patchValue] of Object.entries(patch)) {
    const currentValue = result[key];

    if (isTranslationTree(currentValue) && isTranslationTree(patchValue)) {
      result[key] = mergeTranslationTree(currentValue, patchValue);
      continue;
    }

    result[key] = cloneTranslationValue(patchValue);
  }

  return result as T;
}

export const zhLocalePatch: TranslationTree = {
  modelPurchase: {
    providerProfiles: {
      vendors: {
        nvidia: {
          tagline: '\u9762\u5411 GPU \u4f18\u5148\u5e73\u53f0\u56e2\u961f\u7684\u63a8\u7406\u578b\u5957\u9910\u3002',
          heroDescription: '\u9002\u5408\u5173\u6ce8\u541e\u5410\u3001\u90e8\u7f72\u5f39\u6027\u4e0e\u6df7\u5408\u67b6\u6784\u80fd\u529b\u7684\u5e73\u53f0\u56e2\u961f\u3002',
          audience: '\u63a8\u7406\u5e73\u53f0\u56e2\u961f',
          modelHighlights: ['NIM', 'GPU \u541e\u5410', '\u6df7\u5408\u90e8\u7f72'],
        },
        deepseek: {
          tagline: '\u9ad8\u6027\u4ef7\u6bd4\u7684\u63a8\u7406\u4e0e\u7f16\u7801\u5957\u9910\u3002',
          heroDescription: '\u9002\u5408\u5de5\u7a0b\u7814\u53d1\u3001\u5206\u6790\u63a8\u7406\u4e0e\u6ce8\u91cd\u6210\u672c\u6548\u7387\u7684\u4e1a\u52a1\u573a\u666f\u3002',
          audience: '\u5de5\u7a0b\u4e0e\u63a8\u7406\u8d1f\u8f7d',
          modelHighlights: ['DeepSeek \u63a8\u7406', '\u7f16\u7801\u80fd\u529b', 'Token \u6027\u4ef7\u6bd4'],
        },
        qwen: {
          tagline: '\u9002\u5408\u591a\u8bed\u8a00\u4f01\u4e1a AI \u7684\u5747\u8861\u578b\u56fd\u4ea7\u5957\u9910\u3002',
          heroDescription: '\u9002\u5408\u901a\u7528\u4e1a\u52a1\u7cfb\u7edf\u3001\u5ba2\u670d\u3001\u77e5\u8bc6\u52a9\u624b\u4e0e\u4f01\u4e1a\u7ea7\u5de5\u4f5c\u6d41\u3002',
          audience: '\u901a\u7528\u4f01\u4e1a\u5e94\u7528',
          modelHighlights: ['Qwen \u63a8\u7406', '\u591a\u8bed\u8a00', '\u4f01\u4e1a\u5c31\u7eea'],
        },
        zhipu: {
          tagline: '\u91c7\u8d2d\u7ed3\u6784\u6e05\u6670\u7684\u56fd\u4ea7 GLM \u5957\u9910\u3002',
          heroDescription: '\u9002\u5408\u4f01\u4e1a\u90e8\u7f72\u3001\u5408\u89c4\u8981\u6c42\u8f83\u9ad8\u7684\u91c7\u8d2d\u4e0e\u4ea4\u4ed8\u573a\u666f\u3002',
          audience: '\u56fd\u5185\u4f01\u4e1a\u56e2\u961f',
          modelHighlights: ['GLM', '\u56fd\u5185\u5408\u89c4', '\u5f00\u53d1\u8005\u6d41\u7a0b'],
        },
        baidu: {
          tagline: '\u9002\u5408\u641c\u7d22\u4e0e\u77e5\u8bc6\u7cfb\u7edf\u7684\u4f01\u4e1a\u53cb\u597d\u578b\u5957\u9910\u3002',
          heroDescription: '\u9002\u5408\u52a9\u624b\u3001\u68c0\u7d22\u3001\u77e5\u8bc6\u5e93\u4e0e\u95ee\u7b54\u5de5\u4f5c\u6d41\u3002',
          audience: '\u641c\u7d22\u4e0e\u77e5\u8bc6\u56e2\u961f',
          modelHighlights: ['ERNIE', '\u641c\u7d22\u539f\u751f', '\u4f01\u4e1a\u652f\u6301'],
        },
        'tencent-hunyuan': {
          tagline: '\u9762\u5411\u5927\u89c4\u6a21\u670d\u52a1\u5e73\u53f0\u7684\u817e\u8baf\u751f\u6001 AI \u5957\u9910\u3002',
          heroDescription: '\u9002\u5408\u9ad8\u6d41\u91cf\u52a9\u624b\u3001\u5e73\u53f0\u5316\u80fd\u529b\u4e0e\u751f\u6001\u534f\u540c\u573a\u666f\u3002',
          audience: '\u6d88\u8d39\u4e0e\u670d\u52a1\u5e73\u53f0',
          modelHighlights: ['\u6df7\u5143', '\u817e\u8baf\u751f\u6001', '\u5927\u6d41\u91cf\u573a\u666f'],
        },
        doubao: {
          tagline: '\u9762\u5411\u6d88\u8d39\u7ea7\u4e0e\u521b\u4f5c\u8005\u573a\u666f\u7684\u9ad8\u901f\u589e\u957f\u578b\u5957\u9910\u3002',
          heroDescription: '\u9002\u5408\u9ad8 DAU \u4ea7\u54c1\u3001\u5185\u5bb9\u751f\u6210\u4e0e\u521b\u4f5c\u8005\u5de5\u5177\u94fe\u3002',
          audience: '\u6d88\u8d39\u7ea7 AI \u56e2\u961f',
          modelHighlights: ['\u8c46\u5305', '\u6d88\u8d39\u7ea7\u89c4\u6a21', '\u521b\u4f5c\u8005\u5de5\u4f5c\u6d41'],
        },
        moonshot: {
          tagline: '\u9002\u5408\u957f\u6587\u6863\u4e0e\u7814\u7a76\u578b\u52a9\u624b\u7684\u957f\u4e0a\u4e0b\u6587\u5957\u9910\u3002',
          heroDescription: '\u5f53\u957f\u6587\u6863\u7406\u89e3\u3001\u8d44\u6599\u6574\u5408\u4e0e\u7814\u7a76\u534f\u4f5c\u662f\u6838\u5fc3\u9700\u6c42\u65f6\u66f4\u5408\u9002\u3002',
          audience: '\u7814\u7a76\u4e0e\u91cd\u6587\u6863\u56e2\u961f',
          modelHighlights: ['\u957f\u4e0a\u4e0b\u6587', '\u7814\u7a76\u80fd\u529b', '\u6587\u6863\u526f\u9a7e'],
        },
        minimax: {
          tagline: '\u9762\u5411\u591a\u6a21\u6001\u4ea7\u54c1\u4f53\u9a8c\u7684\u8868\u8fbe\u578b AI \u5957\u9910\u3002',
          heroDescription: '\u9002\u5408\u957f\u5bf9\u8bdd\u3001\u591a\u6a21\u6001\u5e94\u7528\u4e0e\u5185\u5bb9\u751f\u4ea7\u573a\u666f\u3002',
          audience: '\u591a\u6a21\u6001\u4ea7\u54c1\u56e2\u961f',
          modelHighlights: ['\u591a\u6a21\u6001', '\u957f\u4e0a\u4e0b\u6587', '\u5a92\u4f53\u751f\u6210'],
        },
      },
    },
  },
  providerCenter: {
    page: {
      eyebrow: 'Provider \u914d\u7f6e\u4e2d\u5fc3',
      title: 'Provider \u914d\u7f6e\u4e2d\u5fc3',
      description:
        '\u5728\u5e94\u7528\u5185\u7edf\u4e00\u7ba1\u7406\u5185\u7f6e Provider \u9884\u8bbe\u3001\u9ed8\u8ba4\u6a21\u578b\u5217\u8868\u3001API Key \u4e0e Base URL\uff0c\u65e0\u9700\u4f9d\u8d56\u5916\u90e8 router \u63a7\u5236\u53f0\u3002',
      storageHint:
        '\u5b58\u5728\u53ef\u5199 SQLite \u5b58\u50a8\u914d\u7f6e\u65f6\uff0cProvider \u914d\u7f6e\u4f1a\u4f18\u5148\u6301\u4e45\u5316\u5230\u8be5\u914d\u7f6e\u6587\u4ef6\u3002',
    },
    searchPlaceholder: '\u641c\u7d22 provider\u3001Base URL\u3001\u6a21\u578b\u6216 API \u5bc6\u94a5',
    summary: {
      routeConfigs: '\u8def\u7531\u914d\u7f6e',
      llmReady: 'LLM \u5c31\u7eea',
      embeddingReady: 'Embedding \u5c31\u7eea',
    },
    table: {
      name: '\u540d\u79f0',
      provider: 'Provider',
      endpoint: 'Base URL',
      selection: '\u6a21\u578b\u9009\u62e9',
      apiKey: 'API Key',
      updatedAt: '\u66f4\u65b0\u65f6\u95f4',
      actions: '\u64cd\u4f5c',
      models: '\u4e2a\u6a21\u578b',
      llmDefault: 'LLM',
      reasoning: '\u63a8\u7406',
      embedding: 'Embedding',
    },
    states: {
      loading: '\u6b63\u5728\u52a0\u8f7d Provider \u914d\u7f6e...',
      emptyTitle: '\u8fd8\u6ca1\u6709\u8def\u7531\u914d\u7f6e',
      emptyDescription:
        '\u65b0\u589e\u4e00\u6761\u8def\u7531\u914d\u7f6e\uff0c\u628a\u9ed8\u8ba4\u6a21\u578b\u5217\u8868\u3001API Key \u4e0e Base URL \u7edf\u4e00\u6536\u7eb3\u5230\u5185\u7f6e\u914d\u7f6e\u4e2d\u5fc3\u3002',
      searchEmptyDescription: '\u6ca1\u6709\u7b26\u5408\u641c\u7d22\u6761\u4ef6\u7684 Provider \u914d\u7f6e\u3002',
      noNotes: '\u6682\u65e0\u5907\u6ce8',
      notSet: '\u672a\u8bbe\u7f6e',
      noInstances: '\u5f53\u524d\u6ca1\u6709\u53ef\u5199\u7684 OpenClaw \u5b9e\u4f8b\u3002',
      selectInstance: '\u8bf7\u9009\u62e9\u4e00\u4e2a\u5b9e\u4f8b\u4ee5\u9884\u89c8\u53ef\u5e94\u7528\u7684 Agent\u3002',
      noAgents: '\u5f53\u524d\u5b9e\u4f8b\u6ca1\u6709\u53ef\u5e94\u7528\u7684 Agent\u3002',
    },
    actions: {
      refresh: '\u5237\u65b0',
      addRouteConfig: '\u65b0\u589e\u8def\u7531\u914d\u7f6e',
      quickApply: '\u5feb\u901f\u5e94\u7528',
      edit: '\u7f16\u8f91',
      delete: '\u5220\u9664',
      cancel: '\u53d6\u6d88',
      saveChanges: '\u4fdd\u5b58\u4fee\u6539',
      createConfig: '\u521b\u5efa\u914d\u7f6e',
      selectAllAgents: '\u5168\u9009 Agent',
      clearAgentSelection: '\u6e05\u7a7a\u9009\u62e9',
      applyConfig: '\u5e94\u7528\u914d\u7f6e',
    },
    dialogs: {
      editor: {
        createTitle: '\u65b0\u589e\u8def\u7531\u914d\u7f6e',
        editTitle: '\u7f16\u8f91\u8def\u7531\u914d\u7f6e',
        description:
          '\u914d\u7f6e Provider \u5143\u4fe1\u606f\u3001\u9ed8\u8ba4\u6a21\u578b\u3001Embedding \u6a21\u578b\u548c\u8fd0\u884c\u53c2\u6570\uff0c\u6ee1\u8db3 OpenClaw \u517c\u5bb9\u5b9e\u4f8b\u7684\u63a5\u5165\u8981\u6c42\u3002',
        preset: '\u5185\u7f6e\u9884\u8bbe',
        presetPlaceholder: '\u9009\u62e9\u4e00\u4e2a\u5185\u7f6e\u9884\u8bbe',
        customPreset: '\u81ea\u5b9a\u4e49',
        name: '\u914d\u7f6e\u540d\u79f0',
        providerId: 'Provider ID',
        baseUrl: 'Base URL',
        apiKey: 'API Key',
        defaultModel: '\u9ed8\u8ba4 LLM',
        reasoningModel: '\u63a8\u7406\u6a21\u578b',
        embeddingModel: 'Embedding \u6a21\u578b',
        models: '\u6a21\u578b\u5217\u8868',
        modelsHint: '\u6bcf\u884c\u4e00\u4e2a\u6a21\u578b\uff0c\u683c\u5f0f\u4e3a `model-id=\u663e\u793a\u540d\u79f0`\u3002',
        notes: '\u5907\u6ce8',
        runtimeTitle: '\u8fd0\u884c\u53c2\u6570',
        temperature: 'Temperature',
        topP: 'Top P',
        maxTokens: 'Max Tokens',
        timeoutMs: '\u8d85\u65f6\uff08\u6beb\u79d2\uff09',
        streaming: '\u6d41\u5f0f\u8f93\u51fa',
        streamingHint: '\u5f00\u542f\u540e\uff0cProvider \u8def\u7531\u4f1a\u6309\u6d41\u5f0f\u54cd\u5e94\u5de5\u4f5c\u3002',
      },
      apply: {
        title: '\u5feb\u901f\u5e94\u7528\u6a21\u578b\u914d\u7f6e',
        description:
          '\u628a\u9009\u4e2d\u7684\u8def\u7531\u914d\u7f6e\u540c\u6b65\u5230 OpenClaw \u5b9e\u4f8b\u9ed8\u8ba4 Provider \u9009\u62e9\uff0c\u5e76\u6309\u9700\u66f4\u65b0 Agent \u7684\u6a21\u578b\u7ed1\u5b9a\u3002',
        instance: '\u76ee\u6807\u5b9e\u4f8b',
        instancePlaceholder: '\u9009\u62e9\u4e00\u4e2a\u5b9e\u4f8b',
        configPath: '\u914d\u7f6e\u6587\u4ef6\u8def\u5f84',
        targetSummary: '\u914d\u7f6e\u6458\u8981',
        agents: 'Agent \u5217\u8868',
        agentHint:
          '\u52fe\u9009\u7684 Agent \u4f1a\u628a\u4e3b\u6a21\u578b\u5207\u6362\u4e3a\u9ed8\u8ba4 LLM\uff1b\u5982\u679c\u914d\u7f6e\u4e86\u63a8\u7406\u6a21\u578b\uff0c\u4f1a\u81ea\u52a8\u5199\u5165 fallback\u3002',
        defaultAgent: '\u9ed8\u8ba4 Agent',
        currentModel: '\u5f53\u524d\u6a21\u578b',
      },
      delete: {
        title: '\u5220\u9664\u8def\u7531\u914d\u7f6e',
        description:
          '\u786e\u8ba4\u4ece\u672c\u5730\u914d\u7f6e\u4e2d\u5fc3\u5220\u9664 `{{name}}` \u5417\uff1f\u5220\u9664\u540e\u4e0d\u4f1a\u81ea\u52a8\u4fee\u6539\u4efb\u4f55\u5b9e\u4f8b\uff0c\u9664\u975e\u91cd\u65b0\u5e94\u7528\u5176\u4ed6\u914d\u7f6e\u3002',
      },
    },
    toasts: {
      loadFailed: '\u52a0\u8f7d Provider \u914d\u7f6e\u5931\u8d25\u3002',
      loadInstancesFailed: '\u52a0\u8f7d\u53ef\u5e94\u7528\u5b9e\u4f8b\u5931\u8d25\u3002',
      loadInstanceTargetFailed: '\u52a0\u8f7d\u5b9e\u4f8b\u5e94\u7528\u76ee\u6807\u5931\u8d25\u3002',
      saveFailed: '\u4fdd\u5b58 Provider \u914d\u7f6e\u5931\u8d25\u3002',
      deleteFailed: '\u5220\u9664 Provider \u914d\u7f6e\u5931\u8d25\u3002',
      applyFailed: '\u5e94\u7528 Provider \u914d\u7f6e\u5931\u8d25\u3002',
      saved: 'Provider \u914d\u7f6e\u5df2\u4fdd\u5b58\u3002',
      deleted: 'Provider \u914d\u7f6e\u5df2\u5220\u9664\u3002',
      applied: 'Provider \u914d\u7f6e\u5df2\u5e94\u7528\u3002',
    },
  },
  settings: {
    apiKeys: {
      searchPlaceholder: '\u641c\u7d22\u5bc6\u94a5\u540d\u79f0\u3001\u4ee4\u724c\u6216 ID',
      searchEmpty: '\u6ca1\u6709\u7b26\u5408\u641c\u7d22\u6761\u4ef6\u7684 API Key\u3002',
    },
  },
  apiRouterPage: {
    quickSetup: {
      reasons: {
        requiresGoogleIssuedGeminiKey:
          '\u5982\u679c\u4f60\u8981\u8d70 Google \u5b98\u65b9\u76f4\u8fde\u51ed\u8bc1\u6a21\u5f0f\uff0c\u8bf7\u6539\u7528 Google \u76f4\u63a5\u7b7e\u53d1\u7684 Gemini API Key\uff1b\u901a\u8fc7\u7edf\u4e00 API Key \u7684\u8def\u7531\u5316\u5b89\u88c5\u8bf7\u4f7f\u7528 Gemini-compatible gateway\u3002',
      },
    },
  },
};
