import {
  BrainCircuit,
  Cloud,
  Cpu,
  Globe,
  MessageSquare,
  Server,
  Zap,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface ProviderPreset {
  id: string;
  name: string;
  label: string;
  endpointUrl: string;
  apiMode: string;
  customHeaders: Record<string, string>;
  useProviderPricing: boolean;
  description: string;
  icon: LucideIcon;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    label: 'OpenAI',
    endpointUrl: '',
    apiMode: 'ResponsesApi',
    customHeaders: {},
    useProviderPricing: false,
    description: 'GPT-4o, o3, and other OpenAI models',
    icon: BrainCircuit,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    label: 'Anthropic',
    endpointUrl: 'https://api.anthropic.com/v1',
    apiMode: 'ChatCompletions',
    customHeaders: {},
    useProviderPricing: false,
    description: 'Claude Opus, Sonnet, and Haiku models',
    icon: MessageSquare,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    label: 'OpenRouter',
    endpointUrl: 'https://openrouter.ai/api/v1',
    apiMode: 'ChatCompletions',
    customHeaders: {
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
      'X-OpenRouter-Title': 'Clarive',
    },
    useProviderPricing: true,
    description: '300+ models from all providers via a single API',
    icon: Globe,
  },
  {
    id: 'groq',
    name: 'Groq',
    label: 'Groq',
    endpointUrl: 'https://api.groq.com/openai/v1',
    apiMode: 'ChatCompletions',
    customHeaders: {},
    useProviderPricing: false,
    description: 'Ultra-fast inference for Llama, Mixtral, and more',
    icon: Zap,
  },
  {
    id: 'together',
    name: 'Together AI',
    label: 'Together AI',
    endpointUrl: 'https://api.together.xyz/v1',
    apiMode: 'ChatCompletions',
    customHeaders: {},
    useProviderPricing: false,
    description: 'Open-source models with serverless or dedicated GPUs',
    icon: Cpu,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    label: 'Ollama',
    endpointUrl: 'http://localhost:11434/v1',
    apiMode: 'ChatCompletions',
    customHeaders: {},
    useProviderPricing: false,
    description: 'Local models — no API key required',
    icon: Server,
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    label: 'Azure OpenAI',
    endpointUrl: 'https://{resource}.openai.azure.com/openai/deployments/{deployment}/v1',
    apiMode: 'ResponsesApi',
    customHeaders: {},
    useProviderPricing: false,
    description: 'OpenAI models via Azure — update the endpoint URL',
    icon: Cloud,
  },
];

export const CUSTOM_PRESET: ProviderPreset = {
  id: 'custom',
  name: '',
  label: 'Custom',
  endpointUrl: '',
  apiMode: '',
  customHeaders: {},
  useProviderPricing: false,
  description: 'Any OpenAI-compatible provider',
  icon: Settings,
};

const PROVIDER_ICON_MAP: Record<string, LucideIcon> = {
  openai: BrainCircuit,
  anthropic: MessageSquare,
  openrouter: Globe,
  groq: Zap,
  'together ai': Cpu,
  together: Cpu,
  ollama: Server,
  'azure openai': Cloud,
  azure: Cloud,
};

export function getProviderIcon(name: string): LucideIcon {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(PROVIDER_ICON_MAP)) {
    if (lower.includes(key)) return icon;
  }
  return Server;
}
