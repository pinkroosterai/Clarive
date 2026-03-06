import { describe, it, expect } from 'vitest';

import { parseTemplateTags, TAG_PATTERN } from './templateParser';

describe('TAG_PATTERN', () => {
  it('matches a simple tag', () => {
    expect('{{name}}').toMatch(new RegExp(TAG_PATTERN));
  });

  it('matches a typed tag', () => {
    expect('{{count|int}}').toMatch(new RegExp(TAG_PATTERN));
  });

  it('matches a typed tag with options', () => {
    expect('{{temp|float:0-1}}').toMatch(new RegExp(TAG_PATTERN));
  });

  it('matches an enum tag', () => {
    expect('{{style|enum:formal,casual,technical}}').toMatch(new RegExp(TAG_PATTERN));
  });

  it('does not match malformed tags', () => {
    expect('{{ name }}').not.toMatch(new RegExp(TAG_PATTERN));
    expect('{name}').not.toMatch(new RegExp(TAG_PATTERN));
    expect('{{}}').not.toMatch(new RegExp(TAG_PATTERN));
  });
});

describe('parseTemplateTags', () => {
  it('returns empty array for content with no tags', () => {
    expect(parseTemplateTags('Hello world')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseTemplateTags('')).toEqual([]);
  });

  it('parses a simple string tag', () => {
    const fields = parseTemplateTags('Hello {{name}}!');
    expect(fields).toHaveLength(1);
    expect(fields[0]).toEqual({
      name: 'name',
      type: 'string',
      enumValues: [],
      defaultValue: null,
      min: null,
      max: null,
    });
  });

  it('parses an explicitly typed string tag', () => {
    const fields = parseTemplateTags('{{topic|string}}');
    expect(fields[0].type).toBe('string');
  });

  it('parses an int tag with range', () => {
    const fields = parseTemplateTags('{{count|int:1-10}}');
    expect(fields).toHaveLength(1);
    expect(fields[0]).toEqual({
      name: 'count',
      type: 'int',
      enumValues: [],
      defaultValue: null,
      min: 1,
      max: 10,
    });
  });

  it('parses a float tag with range', () => {
    const fields = parseTemplateTags('{{temperature|float:0-1.5}}');
    expect(fields[0]).toMatchObject({
      name: 'temperature',
      type: 'float',
      min: 0,
      max: 1.5,
    });
  });

  it('parses negative range values', () => {
    const fields = parseTemplateTags('{{offset|int:-10-10}}');
    expect(fields[0]).toMatchObject({ min: -10, max: 10 });
  });

  it('parses an enum tag with values', () => {
    const fields = parseTemplateTags('{{tone|enum:formal,casual,technical}}');
    expect(fields[0]).toEqual({
      name: 'tone',
      type: 'enum',
      enumValues: ['formal', 'casual', 'technical'],
      defaultValue: null,
      min: null,
      max: null,
    });
  });

  it('trims whitespace from enum values', () => {
    const fields = parseTemplateTags('{{x|enum: a , b , c }}');
    expect(fields[0].enumValues).toEqual(['a', 'b', 'c']);
  });

  it('deduplicates tags by name', () => {
    const fields = parseTemplateTags('{{name}} and {{name}} again');
    expect(fields).toHaveLength(1);
  });

  it('parses multiple distinct tags', () => {
    const fields = parseTemplateTags('{{first}} {{second|int:1-5}} {{third|enum:a,b}}');
    expect(fields).toHaveLength(3);
    expect(fields.map((f) => f.name)).toEqual(['first', 'second', 'third']);
  });

  it('treats unknown types as string', () => {
    const fields = parseTemplateTags('{{value|boolean}}');
    expect(fields[0].type).toBe('string');
  });

  it('handles int tag without range options', () => {
    const fields = parseTemplateTags('{{count|int}}');
    expect(fields[0]).toMatchObject({ type: 'int', min: null, max: null });
  });

  it('handles enum tag without values', () => {
    const fields = parseTemplateTags('{{style|enum}}');
    expect(fields[0]).toMatchObject({ type: 'enum', enumValues: [] });
  });

  it('parses tags embedded in multi-line content', () => {
    const content = `Line one {{a}}\nLine two {{b|int:0-100}}\nLine three`;
    const fields = parseTemplateTags(content);
    expect(fields).toHaveLength(2);
  });
});
