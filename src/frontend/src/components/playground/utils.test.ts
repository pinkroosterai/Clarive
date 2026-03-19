import { describe, it, expect } from 'vitest';

import { addPinToList, removePinFromList, safeSessionGet } from './utils';

type Run = { id: string; name: string };

const run1: Run = { id: '1', name: 'Run 1' };
const run2: Run = { id: '2', name: 'Run 2' };
const run3: Run = { id: '3', name: 'Run 3' };

describe('addPinToList', () => {
  it('adds a run to an empty array', () => {
    expect(addPinToList([], run1)).toEqual([run1]);
  });

  it('appends a run to the end', () => {
    expect(addPinToList([run1], run2)).toEqual([run1, run2]);
  });

  it('is idempotent — does not add a duplicate', () => {
    const list = [run1, run2];
    const result = addPinToList(list, run1);
    expect(result).toBe(list); // same reference, not a new array
  });

  it('maintains insertion order', () => {
    let list: Run[] = [];
    list = addPinToList(list, run2);
    list = addPinToList(list, run1);
    list = addPinToList(list, run3);
    expect(list.map((r) => r.id)).toEqual(['2', '1', '3']);
  });
});

describe('removePinFromList', () => {
  it('removes a run by id', () => {
    expect(removePinFromList([run1, run2, run3], '2')).toEqual([run1, run3]);
  });

  it('preserves order of remaining items', () => {
    const result = removePinFromList([run1, run2, run3], '1');
    expect(result.map((r) => r.id)).toEqual(['2', '3']);
  });

  it('returns a new array even if id not found', () => {
    const list = [run1];
    const result = removePinFromList(list, 'nonexistent');
    expect(result).toEqual([run1]);
  });

  it('returns empty array when removing the last item', () => {
    expect(removePinFromList([run1], '1')).toEqual([]);
  });
});

describe('batch queue pinning scenarios', () => {
  it('sequential auto-pin builds up comparison set', () => {
    // Simulates: batch of 3 models, each auto-pinned on completion
    let pins: Run[] = [];
    pins = addPinToList(pins, run1); // model A completes
    expect(pins).toHaveLength(1);
    pins = addPinToList(pins, run2); // model B completes
    expect(pins).toHaveLength(2);
    pins = addPinToList(pins, run3); // model C completes
    expect(pins).toHaveLength(3);
    expect(pins).toEqual([run1, run2, run3]);
  });

  it('abort mid-batch preserves completed runs', () => {
    // Simulates: 2 of 3 complete, then abort — pinned runs stay
    let pins: Run[] = [];
    pins = addPinToList(pins, run1);
    pins = addPinToList(pins, run2);
    // run3 aborted — never pinned
    expect(pins).toEqual([run1, run2]);
  });

  it('error on one model skips it — no pin for failed run', () => {
    // Simulates: model A succeeds, model B fails (not pinned), model C succeeds
    let pins: Run[] = [];
    pins = addPinToList(pins, run1); // A succeeds
    // B fails — not added to pins
    pins = addPinToList(pins, run3); // C succeeds
    expect(pins).toEqual([run1, run3]);
  });

  it('clearing all pins resets for new batch', () => {
    let pins: Run[] = [run1, run2, run3];
    pins = []; // clearAllPins equivalent
    expect(pins).toEqual([]);
    // New batch starts fresh
    pins = addPinToList(pins, run2);
    expect(pins).toEqual([run2]);
  });
});

describe('safeSessionGet', () => {
  it('returns fallback when key does not exist', () => {
    expect(safeSessionGet('nonexistent_key_xyz', { a: 1 })).toEqual({ a: 1 });
  });

  it('returns parsed value when key exists', () => {
    sessionStorage.setItem('test_key_utils', JSON.stringify({ hello: 'world' }));
    expect(safeSessionGet('test_key_utils', {})).toEqual({ hello: 'world' });
    sessionStorage.removeItem('test_key_utils');
  });

  it('returns fallback on invalid JSON', () => {
    sessionStorage.setItem('bad_json_utils', '{invalid');
    expect(safeSessionGet('bad_json_utils', 'default')).toBe('default');
    sessionStorage.removeItem('bad_json_utils');
  });
});
