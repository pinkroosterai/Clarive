import { describe, it, expect } from 'vitest';

import {
  buildConstraintStr,
  buildTagString,
  parseTemplateTags,
  TAG_PATTERN,
} from './templateParser';

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

  it('matches a tag with default and description', () => {
    expect('{{tone|enum:formal,casual:formal:Writing style}}').toMatch(new RegExp(TAG_PATTERN));
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
      description: null,
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
      description: null,
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
      description: null,
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

  // Extended syntax: default values
  it('parses int tag with default value', () => {
    const fields = parseTemplateTags('{{count|int:1-100:50}}');
    expect(fields[0]).toMatchObject({
      name: 'count',
      type: 'int',
      min: 1,
      max: 100,
      defaultValue: '50',
    });
  });

  it('parses enum tag with default value', () => {
    const fields = parseTemplateTags('{{tone|enum:formal,casual:formal}}');
    expect(fields[0]).toMatchObject({
      type: 'enum',
      enumValues: ['formal', 'casual'],
      defaultValue: 'formal',
    });
  });

  // Extended syntax: default values + descriptions
  it('parses tag with default and description', () => {
    const fields = parseTemplateTags('{{tone|enum:formal,casual:formal:Writing style}}');
    expect(fields[0]).toMatchObject({
      type: 'enum',
      enumValues: ['formal', 'casual'],
      defaultValue: 'formal',
      description: 'Writing style',
    });
  });

  it('parses string tag with no default but has description', () => {
    const fields = parseTemplateTags('{{hint|string:::A helpful hint}}');
    expect(fields[0]).toMatchObject({
      type: 'string',
      defaultValue: null,
      description: 'A helpful hint',
    });
  });

  it('parses float tag with all fields', () => {
    const fields = parseTemplateTags('{{temp|float:0-2:0.7:Temperature setting}}');
    expect(fields[0]).toMatchObject({
      type: 'float',
      min: 0,
      max: 2,
      defaultValue: '0.7',
      description: 'Temperature setting',
    });
  });

  it('handles description containing colons', () => {
    const fields = parseTemplateTags('{{name|string:::Note: this is important}}');
    expect(fields[0]).toMatchObject({
      defaultValue: null,
      description: 'Note: this is important',
    });
  });

  it('parses tag with empty default but non-empty description', () => {
    const fields = parseTemplateTags('{{x|int:0-10::Range hint}}');
    expect(fields[0]).toMatchObject({
      min: 0,
      max: 10,
      defaultValue: null,
      description: 'Range hint',
    });
  });
});

describe('buildTagString', () => {
  it('builds a simple string tag', () => {
    expect(buildTagString({ name: 'topic', type: 'string' })).toBe('{{topic}}');
  });

  it('builds a typed tag with no constraints', () => {
    expect(buildTagString({ name: 'count', type: 'int' })).toBe('{{count|int}}');
  });

  it('builds a tag with constraints', () => {
    expect(buildTagString({ name: 'count', type: 'int', constraintStr: '1-100' })).toBe(
      '{{count|int:1-100}}'
    );
  });

  it('builds a tag with constraints and default', () => {
    expect(
      buildTagString({ name: 'count', type: 'int', constraintStr: '1-100', defaultValue: '50' })
    ).toBe('{{count|int:1-100:50}}');
  });

  it('builds a tag with all fields', () => {
    expect(
      buildTagString({
        name: 'tone',
        type: 'enum',
        constraintStr: 'formal,casual',
        defaultValue: 'formal',
        description: 'Writing style',
      })
    ).toBe('{{tone|enum:formal,casual:formal:Writing style}}');
  });

  it('builds a string tag with only description', () => {
    expect(buildTagString({ name: 'hint', type: 'string', description: 'A hint' })).toBe(
      '{{hint|string:::A hint}}'
    );
  });

  it('omits trailing empty segments', () => {
    expect(buildTagString({ name: 'x', type: 'enum', constraintStr: 'a,b' })).toBe(
      '{{x|enum:a,b}}'
    );
  });
});

describe('buildConstraintStr', () => {
  it('builds int range constraint', () => {
    expect(
      buildConstraintStr({
        name: 'x',
        type: 'int',
        enumValues: [],
        defaultValue: null,
        description: null,
        min: 1,
        max: 100,
      })
    ).toBe('1-100');
  });

  it('builds enum constraint', () => {
    expect(
      buildConstraintStr({
        name: 'x',
        type: 'enum',
        enumValues: ['a', 'b', 'c'],
        defaultValue: null,
        description: null,
        min: null,
        max: null,
      })
    ).toBe('a,b,c');
  });

  it('returns empty string for string type', () => {
    expect(
      buildConstraintStr({
        name: 'x',
        type: 'string',
        enumValues: [],
        defaultValue: null,
        description: null,
        min: null,
        max: null,
      })
    ).toBe('');
  });
});
