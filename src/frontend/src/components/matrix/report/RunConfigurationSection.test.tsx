import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { RunConfigEntry, TemplateFieldEntry } from '@/types/report';

import { RunConfigurationSection } from './RunConfigurationSection';

const sampleModels: RunConfigEntry[] = [
  {
    modelId: 'm1',
    displayName: 'GPT-4o',
    providerName: 'OpenAI',
    temperature: 0.7,
    maxTokens: 4096,
    reasoningEffort: 'medium',
  },
  {
    modelId: 'm2',
    displayName: 'Claude 3.5',
    providerName: 'Anthropic',
    temperature: 1.0,
    maxTokens: 8192,
    reasoningEffort: 'high',
  },
];

const sampleFields: TemplateFieldEntry[] = [
  { name: 'topic', value: 'machine learning', type: 'string' },
  { name: 'tone', value: 'casual', type: 'enum' },
];

describe('RunConfigurationSection', () => {
  it('renders model table with correct column headers', () => {
    render(<RunConfigurationSection models={sampleModels} templateFields={[]} />);

    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText('Temperature')).toBeInTheDocument();
    expect(screen.getByText('Max Tokens')).toBeInTheDocument();
    expect(screen.getByText('Reasoning Effort')).toBeInTheDocument();
  });

  it('renders model rows with correct data', () => {
    render(<RunConfigurationSection models={sampleModels} templateFields={[]} />);

    expect(screen.getByText('GPT-4o')).toBeInTheDocument();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('0.7')).toBeInTheDocument();

    expect(screen.getByText('Claude 3.5')).toBeInTheDocument();
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
  });

  it('renders template field values', () => {
    render(<RunConfigurationSection models={sampleModels} templateFields={sampleFields} />);

    expect(screen.getByText('Template Variables')).toBeInTheDocument();
    expect(screen.getByText('{{topic}}')).toBeInTheDocument();
    expect(screen.getByText('machine learning')).toBeInTheDocument();
    expect(screen.getByText('{{tone}}')).toBeInTheDocument();
    expect(screen.getByText('casual')).toBeInTheDocument();
  });

  it('does not render template section when no fields exist', () => {
    render(<RunConfigurationSection models={sampleModels} templateFields={[]} />);

    expect(screen.queryByText('Template Variables')).not.toBeInTheDocument();
  });

  it('shows (empty) for fields with no value', () => {
    const fields: TemplateFieldEntry[] = [{ name: 'missing', value: '', type: 'string' }];
    render(<RunConfigurationSection models={sampleModels} templateFields={fields} />);

    expect(screen.getByText('(empty)')).toBeInTheDocument();
  });
});
