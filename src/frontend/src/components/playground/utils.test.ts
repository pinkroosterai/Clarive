import { describe, it, expect } from 'vitest';

import { addPinToList, removePinFromList } from './utils';

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
