import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

import { TemplateVariablesSection } from './TemplateVariablesSection';

// Radix Slider uses ResizeObserver which isn't available in jsdom
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

import { TooltipProvider } from '@/components/ui/tooltip';
import type { TemplateField } from '@/types';

const stringField: TemplateField = {
  name: 'topic',
  type: 'string',
  enumValues: [],
  defaultValue: null,
  description: null,
  min: null,
  max: null,
};

const enumField: TemplateField = {
  name: 'tone',
  type: 'enum',
  enumValues: ['formal', 'casual', 'humorous'],
  defaultValue: null,
  description: null,
  min: null,
  max: null,
};

const sliderField: TemplateField = {
  name: 'temperature',
  type: 'float',
  enumValues: [],
  defaultValue: null,
  description: null,
  min: 0,
  max: 2,
};

function renderSection(overrides: {
  templateFields?: TemplateField[];
  fieldValues?: Record<string, string>;
  onFillTemplateFields?: (() => void) | undefined;
  isFillingTemplateFields?: boolean;
} = {}) {
  const defaults = {
    templateFields: [stringField, enumField],
    fieldValues: {} as Record<string, string>,
    setFieldValues: vi.fn(),
    onFillTemplateFields: vi.fn(),
    isFillingTemplateFields: false,
    ...overrides,
  };
  return {
    ...render(
      <TooltipProvider>
        <TemplateVariablesSection template={defaults} />
      </TooltipProvider>,
    ),
    props: defaults,
  };
}

describe('TemplateVariablesSection', () => {
  it('renders nothing when templateFields is empty', () => {
    const { container } = renderSection({ templateFields: [] });
    expect(container.firstChild).toBeNull();
  });

  it('renders pill inputs with labels', () => {
    renderSection();
    expect(screen.getByText('topic')).toBeInTheDocument();
    expect(screen.getByText('tone')).toBeInTheDocument();
  });

  it('shows empty badge when fields are unfilled', () => {
    renderSection();
    expect(screen.getByText(/2\s*empty/)).toBeInTheDocument();
  });

  it('shows 1 empty when one field filled', () => {
    renderSection({ fieldValues: { topic: 'AI' } });
    expect(screen.getByText(/1\s*empty/)).toBeInTheDocument();
  });

  it('hides empty badge when all fields are filled', () => {
    renderSection({ fieldValues: { topic: 'AI', tone: 'casual' } });
    expect(screen.queryByText(/empty/)).not.toBeInTheDocument();
  });

  it('string pill has inline input', () => {
    renderSection();
    const input = screen.getByPlaceholderText('value');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('string input onChange calls setFieldValues', () => {
    const { props } = renderSection();
    const input = screen.getByPlaceholderText('value');
    fireEvent.change(input, { target: { value: 'quantum' } });
    expect(props.setFieldValues).toHaveBeenCalled();
  });

  it('enum pill shows current value', () => {
    renderSection({ fieldValues: { topic: 'AI', tone: 'formal' } });
    expect(screen.getByText('formal')).toBeInTheDocument();
  });

  it('enum pill shows Select... when empty', () => {
    renderSection();
    expect(screen.getByText('Select tone')).toBeInTheDocument();
  });

  it('fill button has aria-label and no visible text', () => {
    renderSection();
    const button = screen.getByRole('button', { name: /fill template fields/i });
    expect(button).toBeInTheDocument();
    // Should not contain visible text like "Fill with examples"
    expect(button.textContent).toBe('');
  });

  it('fill button not rendered when onFillTemplateFields is undefined', () => {
    renderSection({ onFillTemplateFields: undefined });
    expect(screen.queryByRole('button', { name: /fill template fields/i })).not.toBeInTheDocument();
  });

  it('renders slider pill with numeric value', () => {
    renderSection({
      templateFields: [sliderField],
      fieldValues: { temperature: '0.7' },
    });
    expect(screen.getByText('temperature')).toBeInTheDocument();
    expect(screen.getByText('0.7')).toBeInTheDocument();
  });
});
