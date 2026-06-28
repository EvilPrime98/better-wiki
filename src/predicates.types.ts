import type { WikiSearchGeneratorPageItem } from './types';

export function isGeneratorPageItem(candidate: unknown): candidate is WikiSearchGeneratorPageItem {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    !Object.hasOwn(candidate, 'missing') &&
    Object.hasOwn(candidate, 'categories')
  );
}
