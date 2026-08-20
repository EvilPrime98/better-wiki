import type { Wiki } from './types.js';

/**
 * Resolves the `limit` flag to forward to {@link Wiki.getPage} for `multiple`-capable plugin
 * methods (`getComic`, `getVolume`, `getCharacter`, etc). An explicit caller-supplied `limit`
 * always wins; otherwise, when `multiple` is requested, raises the raw MediaWiki search window
 * to `defaultMultipleLimit` — the un-raised default (20 raw hits) is applied *before* category
 * filtering, so broad/generic queries can lose real matches after filtering even though more
 * exist. Single-best-match calls (`multiple` falsy) are left unraised.
 *
 * @param flags - The `limit` and `multiple` values from the caller's flags.
 * @param defaultMultipleLimit - The raised limit to use when `multiple` is true and no explicit
 * `limit` was supplied.
 * @returns `{ limit }` to spread into the {@link Wiki.getPage} call, or `{}` to omit it entirely.
 */
export const resolveMultipleLimit = (
  flags: { limit?: number; multiple?: boolean },
  defaultMultipleLimit = 50,
): { limit?: number } => {
  if (flags.limit !== undefined) return { limit: flags.limit };
  if (flags.multiple === true) return { limit: defaultMultipleLimit };
  return {};
};

/**
 * Resolves a cover image URL from an infobox content map by filename field (e.g. `Image`,
 * `Image1`), falling back to `undefined` — letting the caller fall back to `page.thumbnail` —
 * when the field is absent or the file can't be resolved.
 *
 * @param wikiClient - The base client used to resolve the filename to a URL.
 * @param content - The page's structured infobox content.
 * @param fieldName - The infobox key holding the cover filename (plugin-specific).
 * @param width - Optional width to scale the resolved URL to.
 */
export const resolveCoverFromContent = async (
  wikiClient: Wiki,
  content: Record<string, string>,
  fieldName: string,
  width?: number,
): Promise<string | undefined> => {
  const fileName = content[fieldName];
  if (!fileName) return undefined;
  const url = await wikiClient.getFileUrl(fileName, width);
  return url || undefined;
};

/**
 * Splits an array into consecutive chunks of at most `chunkSize` elements.
 * The last chunk may be smaller if `arr.length` isn't a multiple of `chunkSize`.
 *
 * @param arr - The array to split.
 * @param chunkSize - Maximum number of elements per chunk.
 * @returns The array split into chunks, in original order.
 */
export const chunkArray = <T>(arr: T[], chunkSize = 50): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }

  return chunks;
};

/**
 * Strips HTML tags from a string and trims the result.
 *
 * @param html - HTML markup to strip.
 * @returns The plain-text content, with all tags removed.
 */
export const getInnerText = (html: string): string => {
  return html.replace(/<[^>]+>/g, '').trim();
};
