import type {
  CharacterAppearance,
  ComicCredits,
  CoverVariant,
  ReleaseDate,
  AppearanceEntry,
  AppearingSection,
  ComicExtras,
} from './types';

const CONNECTORS = ['of', 'the', 'from', 'to'];

export const normalizeTitle = (title: string, addUnderscore = true): string => {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => {
      return CONNECTORS.includes(word.toLowerCase())
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('_');

  if (normalized.endsWith('_')) {
    return normalized;
  }

  return addUnderscore ? `${normalized}_` : normalized;
};

export const capitalize = (str: string): string => {
  return str
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const chunkArray = <T>(arr: T[], chunkSize = 50): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }

  return chunks;
};

export const removeCoverRevision = (url: string | null): string | undefined => {
  return url?.split('/revision')[0];
};

export const extractYear = (candidate: string): string | undefined => {
  return candidate.match(/\(([0-9]{4})\)/)?.[1];
};

export const normalizeQueryString = (candidate: string): string => {
  return candidate
    .split('.')[0]! // remove extension
    .replace(/\b0+(\d)/g, '$1') // remove leading zeroes
    .replace(/\s+/g, ' ') // collapse double spaces
    .replace(/\(.+\)/, '') // remove parenthesised content
    .trim();
};

export const stripWikiMarkup = (text: string): string => {
  return text
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/'{2,3}/g, '')
    .trim();
};

export const getInnerText = (html: string): string => {
  return html.replace(/<[^>]+>/g, '').trim();
};

export const buildComicPageTitle = (title: string, volume: string, issue: string): string => {
  const normalizedTitle = capitalize(title.trim().replace(/\s+/g, ' ')).replaceAll(' ', '_');
  const normalizedVolume = volume.trim().replace(/\s+/g, ' ');
  const normalizedIssue = issue.trim().replace(/\s+/g, ' ');
  return `${normalizedTitle}_Vol_${normalizedVolume}_${normalizedIssue}`;
};

const MONTH_MAP = new Map([
  ['january', '01'],
  ['february', '02'],
  ['march', '03'],
  ['april', '04'],
  ['may', '05'],
  ['june', '06'],
  ['july', '07'],
  ['august', '08'],
  ['september', '09'],
  ['october', '10'],
  ['november', '11'],
  ['december', '12'],
]);

export const normalizeDates = (appearances: CharacterAppearance[]): CharacterAppearance[] => {
  return appearances.map((element) => {
    const releaseMonth = element.releaseDate?.releaseMonth?.toLowerCase();

    const month =
      releaseMonth && MONTH_MAP.has(releaseMonth)
        ? MONTH_MAP.get(releaseMonth)
        : element.releaseDate?.releaseMonth?.padStart(2, '0');

    return {
      ...element,
      releaseDate: {
        ...element.releaseDate,
        releaseMonth: month,
      },
    } as CharacterAppearance;
  });
};

export const sortAppearances = (appearances: CharacterAppearance[]): CharacterAppearance[] => {
  return appearances.sort((a, b) => {
    const r1 =
      parseInt(a.releaseDate?.releaseYear || '0') - parseInt(b.releaseDate?.releaseYear || '0');
    if (r1 !== 0) return r1;

    const r2 =
      parseInt(a.releaseDate?.releaseMonth || '0') - parseInt(b.releaseDate?.releaseMonth || '0');
    if (r2 !== 0) return r2;

    const r3 =
      parseInt(a.releaseDate?.releaseDay || '0') - parseInt(b.releaseDate?.releaseDay || '0');
    if (r3 !== 0) return r3;

    return a.title.localeCompare(b.title);
  });
};

export const parseReleaseDate = (pageContent: string | undefined): ReleaseDate => {
  const lines = pageContent?.split('\n') ?? [];
  let releaseDay = '';
  let releaseMonth = '';
  let releaseYear = '';

  for (const line of lines) {
    if (line.startsWith('| Day')) releaseDay = line.split('=')[1]?.trim() || '';
    else if (line.startsWith('| Month')) releaseMonth = line.split('=')[1]?.trim() || '';
    else if (line.startsWith('| Year')) releaseYear = line.split('=')[1]?.trim() || '';
  }

  return { releaseDay, releaseMonth, releaseYear };
};

export const parseCredits = (pageContent: string | undefined): ComicCredits => {
  const lines = pageContent?.split('\n') ?? [];

  const credits: ComicCredits = {
    writers: [],
    artists: [],
    inkers: [],
    colorists: [],
    letterers: [],
    editors: [],
    executiveEditors: [],
  };

  lines.forEach((line) => {
    const val = () => line.split('=')[1]?.trim() ?? '';

    if (line.startsWith('| Writer')) {
      const v = val();
      if (v) credits.writers.push(v);
    }

    if (line.startsWith('| Penciler')) {
      const v = val();
      if (v) credits.artists.push(v);
    }

    if (line.startsWith('| Inker')) {
      const v = val();
      if (v) credits.inkers.push(v);
    }

    if (line.startsWith('| Colorist')) {
      const v = val();
      if (v) credits.colorists.push(v);
    }

    if (line.startsWith('| Letterer')) {
      const v = val();
      if (v) credits.letterers.push(v);
    }

    if (line.startsWith('| Editor')) {
      const v = val();
      if (v) credits.editors.push(v);
    }

    if (line.startsWith('| Executive Editor')) {
      const v = val();
      if (v) credits.executiveEditors.push(v);
    }
  });

  return credits;
};

export const parseComicMetadata = (
  pageContent: string | undefined,
): {
  volume: string;
  issue: string;
} => {
  const lines = pageContent?.split('\n') ?? [];
  const info = { volume: '', issue: '' };
  let volFound = false;
  let issueFound = false;

  for (const line of lines) {
    if (line.startsWith('| Vol')) {
      info.volume = line.split('=')[1]?.trim() ?? '';
      volFound = true;
    }

    if (line.startsWith('| Issue')) {
      info.issue = line.split('=')[1]?.trim() ?? '';
      issueFound = true;
    }

    if (volFound && issueFound) break;
  }

  return info;
};

export const parseSynopsis = (pageContent: string | undefined): string => {
  const match = pageContent?.match(/\|\s*Synopsis1\s*=\s*([\s\S]*?)\n\|/);
  return match?.[1]?.trim() || '';
};

export const parseAppearanceEntry = (line: string): AppearanceEntry | null => {
  const content = line.replace(/^\*+\s*/, '');

  const linkMatch = content.match(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/);
  if (!linkMatch) return null;

  const pageTitle = linkMatch[1]!.trim();
  const name = (linkMatch[2] ?? linkMatch[1]!).trim();
  const colorTemplates = new Set(['green', 'red', 'blue', 'orange']);

  let statusNote: string | undefined;
  for (const match of content.matchAll(/\{\{([^{}|]+)(?:\|([^{}]*))?\}\}/g)) {
    const tmpl = match[1]!.trim();
    const arg = match[2]?.trim();

    if (tmpl.toLowerCase() === 'a') continue;

    if (colorTemplates.has(tmpl.toLowerCase())) {
      statusNote = arg ? stripWikiMarkup(arg) : undefined;
    }
  }

  return { name, pageTitle, statusNote };
};

export const getAppearing = (pageContent: string): AppearingSection | null => {
  const blockMatch = pageContent.match(/\|\s*Appearing\d+\s*=\s*([\s\S]*?)(?=\n\s*\||\n\s*\}\})/);
  if (!blockMatch) return null;

  const result: AppearingSection = {
    featuredCharacters: [],
    supportingCharacters: [],
    antagonists: [],
    otherCharacters: [],
    locations: [],
    items: [],
    concepts: [],
  };

  const sectionMap: Record<string, keyof AppearingSection> = {
    'featured characters': 'featuredCharacters',
    'supporting characters': 'supportingCharacters',
    antagonists: 'antagonists',
    'other characters': 'otherCharacters',
    locations: 'locations',
    items: 'items',
    concepts: 'concepts',
  };

  let currentSection: keyof AppearingSection = 'otherCharacters';
  for (const line of blockMatch[1]!.split('\n')) {
    const trimmed = line.trim();
    const headerMatch = trimmed.match(/^'''([^']+):?'''/);

    if (headerMatch) {
      const key = headerMatch[1]!.toLowerCase().trim().replace(/:$/, '');
      currentSection = sectionMap[key] ?? 'otherCharacters';
      continue;
    }

    if (trimmed.startsWith('*')) {
      const entry = parseAppearanceEntry(trimmed);
      if (entry) result[currentSection].push(entry);
    }
  }

  return result;
};

export const getComicExtras = (pageContent: string): ComicExtras => {
  const lines = pageContent.split('\n');
  let rating = '';
  let event = '';
  let quotation = '';
  let speaker = '';
  const storyTitles: string[] = [];
  const coverMap = new Map<number, CoverVariant>();

  const getOrCreate = (n: number): CoverVariant => {
    if (!coverMap.has(n)) coverMap.set(n, { coverNumber: n, artists: [] });
    return coverMap.get(n)!;
  };

  for (const line of lines) {
    const t = line.trim();

    if (t.startsWith('| Rating')) {
      rating = t.split('=')[1]?.trim() ?? '';
      continue;
    }
    if (t.startsWith('| Event')) {
      event = t.split('=')[1]?.trim() ?? '';
      continue;
    }
    if (t.startsWith('| Quotation')) {
      quotation = stripWikiMarkup(t.split('=').slice(1).join('=').trim());
      continue;
    }
    if (t.startsWith('| Speaker')) {
      speaker = stripWikiMarkup(t.split('=').slice(1).join('=').trim());
      continue;
    }

    const storyMatch = t.match(/^\|\s*StoryTitle\d+\s*=\s*(.+)/);
    if (storyMatch?.[1]) {
      storyTitles.push(storyMatch[1].trim());
      continue;
    }

    // | Image = file.jpg  (cover 1 primary image)
    if (/^\|\s*Image\s*=\s*\S/.test(t)) {
      const val = t.split('=')[1]?.trim();
      if (val) getOrCreate(1).imageUrl = val;
      continue;
    }

    // | ImageNText = label
    const imageNTextMatch = t.match(/^\|\s*Image(\d+)Text\s*=\s*(\S.*)/);
    if (imageNTextMatch) {
      const val = imageNTextMatch[2]!.trim();
      if (val) getOrCreate(Number(imageNTextMatch[1])).imageLabel = val;
      continue;
    }

    // | ImageN = file.jpg
    const imageNMatch = t.match(/^\|\s*Image(\d+)\s*=\s*(\S.*)/);
    if (imageNMatch) {
      const val = imageNMatch[2]!.trim();
      if (val) getOrCreate(Number(imageNMatch[1])).imageUrl = val;
      continue;
    }

    // | Cover2Artist1 = Name  (cover N >= 2)
    const coverNArtistMatch = t.match(/^\|\s*Cover(\d+)Artist\d+\s*=\s*(\S.*)/);
    if (coverNArtistMatch) {
      const val = coverNArtistMatch[2]!.trim();
      if (val) getOrCreate(Number(coverNArtistMatch[1])).artists.push(val);
      continue;
    }

    // | CoverArtist1 = Name  (cover 1)
    const coverArtist1Match = t.match(/^\|\s*CoverArtist\d+\s*=\s*(\S.*)/);
    if (coverArtist1Match) {
      const val = coverArtist1Match[1]!.trim();
      if (val) getOrCreate(1).artists.push(val);
      continue;
    }
  }

  const notesMatch = pageContent.match(/\|\s*Notes\s*=\s*([\s\S]*?)(?=\n\s*\||\n\s*\}\})/);
  const triviaMatch = pageContent.match(/\|\s*Trivia\s*=\s*([\s\S]*?)(?=\n\s*\||\n\s*\}\})/);
  const notes = stripWikiMarkup(notesMatch?.[1]?.trim() ?? '');
  const trivia = stripWikiMarkup(triviaMatch?.[1]?.trim() ?? '');
  const coverVariants = Array.from(coverMap.values()).sort((a, b) => a.coverNumber - b.coverNumber);

  return {
    rating,
    event,
    storyTitles,
    quotation,
    speaker,
    notes: notes ? notes.split('\n') : [],
    trivia: trivia ? trivia.split('\n') : [],
    coverVariants,
  };
};
