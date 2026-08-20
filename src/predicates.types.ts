import type { WikiSearchGeneratorPageItem } from './types.js';

/**
 * Type guard for a MediaWiki generator-query result page that resolved successfully
 * (as opposed to a "missing" page placeholder).
 *
 * @param candidate - The value to check, typically an entry from a `query.pages` map.
 * @returns `true` if `candidate` is a {@link WikiSearchGeneratorPageItem}.
 */
export function isGeneratorPageItem(candidate: unknown): candidate is WikiSearchGeneratorPageItem {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    !Object.hasOwn(candidate, 'missing') &&
    Object.hasOwn(candidate, 'categories')
  );
}
