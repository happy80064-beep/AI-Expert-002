import type { AIModelConfig, AIProvider } from './types';

export type ManagedAIProvider = 'OpenAI' | 'Gemini' | 'Moonshot' | 'DeepSeek';

export type ProviderModelPreset = {
  label: string;
  modelId: string;
};

export const DEFAULT_PROVIDER_BASE_URLS: Record<ManagedAIProvider, string> = {
  OpenAI: 'https://api.openai.com/v1',
  Gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  Moonshot: 'https://api.moonshot.cn/v1',
  DeepSeek: 'https://api.deepseek.com/v1',
};

export const PROVIDER_ENV_KEYS: Record<ManagedAIProvider, string> = {
  OpenAI: 'OPENAI_BASE_URL',
  Gemini: 'GEMINI_BASE_URL',
  Moonshot: 'MOONSHOT_BASE_URL',
  DeepSeek: 'DEEPSEEK_BASE_URL',
};

export const PROVIDER_MODEL_PRESETS: Record<ManagedAIProvider, ProviderModelPreset[]> = {
  OpenAI: [
    { label: 'GPT-4o', modelId: 'gpt-4o' },
    { label: 'GPT-4o Mini', modelId: 'gpt-4o-mini' },
    { label: 'o3-mini', modelId: 'o3-mini' },
  ],
  Gemini: [
    { label: 'Gemini 2.0 Flash', modelId: 'gemini-2.0-flash' },
    { label: 'Gemini 2.0 Flash Lite', modelId: 'gemini-2.0-flash-lite' },
    { label: 'Gemini 1.5 Pro', modelId: 'gemini-1.5-pro' },
  ],
  Moonshot: [
    { label: 'Moonshot 8K', modelId: 'moonshot-v1-8k' },
    { label: 'Moonshot 32K', modelId: 'moonshot-v1-32k' },
    { label: 'Moonshot 128K', modelId: 'moonshot-v1-128k' },
  ],
  DeepSeek: [
    { label: 'DeepSeek Chat', modelId: 'deepseek-chat' },
    { label: 'DeepSeek Reasoner', modelId: 'deepseek-reasoner' },
  ],
};

const PROVIDER_ALIASES: Partial<Record<AIProvider, ManagedAIProvider>> = {
  Google: 'Gemini',
  Gemini: 'Gemini',
  OpenAI: 'OpenAI',
  Moonshot: 'Moonshot',
  DeepSeek: 'DeepSeek',
};

export const MANAGED_PROVIDER_OPTIONS = Object.keys(DEFAULT_PROVIDER_BASE_URLS) as ManagedAIProvider[];

export const getManagedProvider = (provider: AIProvider | string): ManagedAIProvider => {
  return PROVIDER_ALIASES[provider as AIProvider] ?? 'OpenAI';
};

export const resolveProviderBaseUrl = (provider: AIProvider | string, override?: string): string => {
  const normalizedOverride = override?.trim();
  if (normalizedOverride) {
    return normalizedOverride;
  }

  return DEFAULT_PROVIDER_BASE_URLS[getManagedProvider(provider)];
};

export const resolveDefaultModelId = (provider: AIProvider | string): string => {
  return PROVIDER_MODEL_PRESETS[getManagedProvider(provider)][0]?.modelId ?? 'gpt-4o-mini';
};

export const buildManagedModelConfig = (config: AIModelConfig): AIModelConfig => {
  const provider = getManagedProvider(config.provider);
  return {
    ...config,
    provider,
    baseUrl: resolveProviderBaseUrl(provider, config.baseUrl),
    modelId: config.modelId || resolveDefaultModelId(provider),
  };
};

export const DEFAULT_MANAGED_MODELS: AIModelConfig[] = [
  {
    id: 'm_openai_4o',
    name: 'OpenAI GPT-4o',
    provider: 'OpenAI',
    modelId: 'gpt-4o',
    isEnabled: true,
    baseUrl: DEFAULT_PROVIDER_BASE_URLS.OpenAI,
  },
  {
    id: 'm_gemini_flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Gemini',
    modelId: 'gemini-2.0-flash',
    isEnabled: true,
    baseUrl: DEFAULT_PROVIDER_BASE_URLS.Gemini,
  },
  {
    id: 'm_moonshot_32k',
    name: 'Moonshot 32K',
    provider: 'Moonshot',
    modelId: 'moonshot-v1-32k',
    isEnabled: true,
    baseUrl: DEFAULT_PROVIDER_BASE_URLS.Moonshot,
  },
  {
    id: 'm_deepseek_chat',
    name: 'DeepSeek Chat',
    provider: 'DeepSeek',
    modelId: 'deepseek-chat',
    isEnabled: true,
    baseUrl: DEFAULT_PROVIDER_BASE_URLS.DeepSeek,
  },
];
