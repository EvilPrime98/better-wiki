import { describe, it, expect } from 'vitest';

import { chunkArray, getInnerText } from '../utils.js';

describe('chunkArray', () => {
  it('splits into chunks of the given size', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns an empty array for empty input', () => {
    expect(chunkArray([])).toEqual([]);
  });

  it('defaults to a chunk size of 50', () => {
    expect(chunkArray(Array.from({ length: 120 }, (_, i) => i)).map((c) => c.length)).toEqual([
      50, 50, 20,
    ]);
  });
});

describe('getInnerText', () => {
  it('strips HTML tags', () => {
    expect(getInnerText('<a href="#"><b>Gotham</b></a>')).toBe('Gotham');
  });
});
