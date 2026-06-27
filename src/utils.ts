export const chunkArray = <T>(arr: T[], chunkSize = 50): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }

  return chunks;
};

export const getInnerText = (html: string): string => {
  return html.replace(/<[^>]+>/g, '').trim();
};
