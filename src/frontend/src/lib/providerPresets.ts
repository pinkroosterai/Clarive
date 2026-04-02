import Anthropic from '@lobehub/icons/es/Anthropic/components/Mono';
import Azure from '@lobehub/icons/es/Azure/components/Mono';
import Groq from '@lobehub/icons/es/Groq/components/Mono';
import Ollama from '@lobehub/icons/es/Ollama/components/Mono';
import OpenAI from '@lobehub/icons/es/OpenAI/components/Mono';
import OpenRouter from '@lobehub/icons/es/OpenRouter/components/Mono';
import Together from '@lobehub/icons/es/Together/components/Mono';
import { Server, Settings } from 'lucide-react';
import type { ComponentType } from 'react';

type IconComponent = ComponentType<{ size?: number; className?: string }>;

export interface ProviderPreset {
  id: string;
  name: string;
  label: string;
  endpointUrl: string;
  apiMode: string;
  customHeaders: Record<string, string>;
  useProviderPricing: boolean;
  description: string;
  icon: IconComponent;
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
    icon: OpenAI,
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
    icon: Anthropic,
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
    icon: OpenRouter,
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
    icon: Groq,
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
    icon: Together,
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
    icon: Ollama,
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
    icon: Azure,
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

const PROVIDER_ICON_MAP: Record<string, IconComponent> = {
  openai: OpenAI,
  anthropic: Anthropic,
  claude: Anthropic,
  openrouter: OpenRouter,
  groq: Groq,
  'together ai': Together,
  together: Together,
  ollama: Ollama,
  'azure openai': Azure,
  azure: Azure,
};

export function getProviderIcon(name: string): IconComponent {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(PROVIDER_ICON_MAP)) {
    if (lower.includes(key)) return icon;
  }
  return Server;
}
