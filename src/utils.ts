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
