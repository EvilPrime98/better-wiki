import type { Wiki, WikiPage, WikiFlags } from '../types';
import { resolveCoverFromContent, resolveMultipleLimit } from '../utils';
import Fuse from 'fuse.js';

/** A single character/entity reference within a {@link WikiAppearingSection}. */
export interface WikiAppearanceEntry {
  name: string;
  pageTitle: string;
  statusNote?: string;
}

/** Characters, locations, items, and concepts appearing in a comic, grouped by role. */
export interface WikiAppearingSection {
  featuredCharacters: WikiAppearanceEntry[];
  supportingCharacters: WikiAppearanceEntry[];
  antagonists: WikiAppearanceEntry[];
  otherCharacters: WikiAppearanceEntry[];
  locations: WikiAppearanceEntry[];
  items: WikiAppearanceEntry[];
  concepts: WikiAppearanceEntry[];
}

/** Flat key/value map parsed from a page's infobox template. */
export type WikiStrContent = Record<string, string>;

/** An alternate cover for a comic issue, with its own artist credits. */
export interface WikiComicCoverVariant {
  coverNumber: number;
  artists: string[];
  imageUrl?: string;
  imageLabel?: string;
}

/** Creative credits for a comic issue, grouped by role. */
export interface WikiCredits {
  writers: string[];
  artists: string[];
  inkers: string[];
  colorists: string[];
  letterers: string[];
  editors: string[];
  executiveEditors: string[];
}

/** A single comic-book issue, as returned by {@link marvelFandomPlugin}'s `getComic`/`getComicById`. */
export interface WikiComic {
  title: string;
  volume: string;
  issue: string;
  cover: string;
  pageId: number;
  credits: WikiCredits;
  releaseDate: WikiReleaseDate;
  synopsis: string;
  rating: string;
  event: string;
  storyTitles: string[];
  appearing: WikiAppearingSection;
  quotation?: { quote?: string; speaker?: string };
  coverVariants: WikiComicCoverVariant[];
  notes: string[];
  trivia: string[];
  /** Base URL of the wiki this comic was fetched from, e.g. `https://marvel.fandom.com`. */
  sourceWiki: string;
}

/** A comic's release date, as separate day/month/year strings from the infobox. */
export interface WikiReleaseDate {
  releaseDay: string;
  releaseMonth: string;
  releaseYear: string;
}

/** A comic-book volume/series, as returned by {@link marvelFandomPlugin}'s `getVolume`/`getVolumeById`. */
export interface WikiVolume {
  title: string;
  thumbnail: string;
  pageId: number;
  type: string;
  startDate: {
    month: string;
    year: string;
  };
  endDate: {
    month: string;
    year: string;
  };
  previousVolume: string;
  nextVolume: string;
  creators: string[];
  featured: string[];
  storyArcs: string[];
  crossovers: string[];
  history: string;
  totalIssues: string;
  annualIssues: {
    title: string;
    year: string;
  }[];
  specialIssues: {
    title: string;
    year: string;
  }[];
  issueList: string[];
  /** Fetches the comics that are part of this volume, resolved from `issueList`. */
  getComics(
    flags?: Pick<WikiFlags, 'thumbnailSize' | 'includeCollections' | 'category' | 'sorted'>,
  ): Promise<WikiComic[]>;
  /** Base URL of the wiki this volume was fetched from, e.g. `https://marvel.fandom.com`. */
  sourceWiki: string;
}

/** A single heading/text block from a character's "History" section. */
export interface WikiCharacterHistorySection {
  heading: string;
  text: string;
}

/** A character, as returned by {@link marvelFandomPlugin}'s `getCharacter`/`getCharacterById`. */
export interface WikiCharacter {
  name: string;
  image: string;
  thumbnail: string;
  pageId: number;
  realName: string;
  mainAlias: string;
  aliases: string[];
  alignment: string;
  identity: string;
  affiliation: string;
  relatives: string;
  universe: string;
  baseOfOperations: string;
  alienRace: string;
  gender: string;
  height: string;
  weight: string;
  eyes: string;
  hair: string;
  citizenship: string;
  maritalStatus: string;
  occupation: string;
  creators: string[];
  first: string;
  last: string;
  quotation?: { quote?: string; speaker?: string; source?: string };
  overview: string;
  history: WikiCharacterHistorySection[];
  powers: string[];
  abilities: string[];
  weaknesses: string[];
  equipment: string[];
  transportation: string[];
  weapons: string[];
  notes: string[];
  trivia: string[];
  /** Fetches the comics this character appears in, via its `Category:.../Appearances` category. */
  getAppearances(flags?: Pick<WikiFlags, 'sorted'>): Promise<WikiComic[]>;
  /** Base URL of the wiki this character was fetched from, e.g. `https://marvel.fandom.com`. */
  sourceWiki: string;
}

const byReleaseDate = (a: WikiComic, b: WikiComic): number => {
  const r1 = Number(a.releaseDate.releaseYear) - Number(b.releaseDate.releaseYear);
  if (r1 !== 0) return r1;
  const r2 = Number(a.releaseDate.releaseMonth) - Number(b.releaseDate.releaseMonth);
  if (r2 !== 0) return r2;
  return Number(a.releaseDate.releaseDay) - Number(b.releaseDate.releaseDay);
};

/**
 * Extends a base {@link Wiki} client with Marvel Fandom-specific lookups for comics,
 * volumes, and characters, built on top of the base client's generic page search.
 *
 * Parsing here is coupled to Marvel Fandom's own infobox field names (e.g. `Image`,
 * `RealName`, `StoryArcs`) and category names (e.g. `Category:Comics`,
 * `Category:Characters`). Pointing this plugin at a different wiki via
 * `wiki({ plugin: 'marvel-fandom', url: ... })` will run without error, but on a wiki
 * whose schema doesn't follow the same conventions, results may come back partially
 * or entirely empty rather than throwing.
 *
 * @param wikiClient - The base client to build on, typically for `https://marvel.fandom.com`.
 * @returns An object with `getComic`, `getComicById`, `getVolume`, `getVolumeById`,
 *   `getCharacter`, `getCharacterById`, and `getCharacterAppearances`.
 */
export function marvelFandomPlugin(wikiClient: Wiki) {
  const APPEARING_SECTIONS: Record<string, keyof WikiAppearingSection> = {
    'featured characters': 'featuredCharacters',
    'supporting characters': 'supportingCharacters',
    antagonists: 'antagonists',
    'other characters': 'otherCharacters',
    locations: 'locations',
    items: 'items',
    concepts: 'concepts',
  };

  //HELPERS

  const preNormalization = (candidate: string): string => {
    return candidate
      .split('.')[0]! //remove extension
      .replace(/\b0+(\d)/g, '$1') //remove leading zeroes
      .replace(/\s+/g, ' ') //remove double spaces
      .replace(/\(.+\)/, '') //remove parenthesised content
      .trim();
  };

  const extractYear = (candidate: string) => {
    return candidate.match(/\(([0-9]{4})\)/)?.[1];
  };

  const selectBest = (
    candidates: { page: WikiPage; content: WikiStrContent }[],
    nQuery: string,
    queryYear?: string,
  ): { page: WikiPage; content: WikiStrContent } | undefined => {
    if (candidates.length === 0) return undefined;

    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[\W_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const fuse = new Fuse(candidates, {
      keys: ['page.title'],
      threshold: 0.4,
      includeScore: true,
    });

    const fuzzyResults = fuse.search(nQuery);
    if (fuzzyResults.length === 0) return undefined;

    const queryNumber = nQuery.match(/(\d+)$/)?.[1];

    const scored = fuzzyResults.map((r) => {
      const { page, content } = r.item;
      let score = (1 - (r.score ?? 1)) * 100;

      if (queryYear && content['Year'] === queryYear) score += 40;

      if (!queryYear) {
        const { month, day } = parseReleaseDate(content['ReleaseDate']);
        score += Number(month) * 0.5;
        score += Number(day) * 0.1;
      }

      if (queryNumber && new RegExp(`\\b${queryNumber}\\b`).test(normalize(page.title))) {
        score += 25;
      }

      return { item: r.item, score };
    });

    return scored.sort((a, b) => b.score - a.score)[0]?.item;
  };

  const collectSequential = (content: WikiStrContent, keyFn: (i: number) => string): string[] => {
    const out: string[] = [];
    for (let i = 1; content[keyFn(i)] !== undefined; i++) {
      const v = content[keyFn(i)]!.trim();
      if (v) out.push(v);
    }
    return out;
  };

  const collectCredits = (content: WikiStrContent, role: string): string[] => {
    const out: string[] = [];
    for (let s = 1; content[`${role}${s}_1`] !== undefined; s++) {
      for (let p = 1; content[`${role}${s}_${p}`] !== undefined; p++) {
        const v = content[`${role}${s}_${p}`]!.trim();
        if (v) out.push(v);
      }
    }
    return out;
  };

  const buildCredits = (content: WikiStrContent): WikiCredits => ({
    writers: collectCredits(content, 'Writer'),
    artists: collectCredits(content, 'Penciler'),
    inkers: collectCredits(content, 'Inker'),
    colorists: collectCredits(content, 'Colorist'),
    letterers: collectCredits(content, 'Letterer'),
    editors: collectCredits(content, 'Editor'),
    executiveEditors: content['Executive Editor']?.trim()
      ? [content['Executive Editor'].trim()]
      : [],
  });

  const buildCoverVariants = (content: WikiStrContent): WikiComicCoverVariant[] => {
    const indices = Object.keys(content)
      .map((k) => k.match(/^Image(\d+)$/)?.[1])
      .filter((n): n is string => n !== undefined)
      .map(Number)
      .sort((a, b) => a - b);

    return indices.map((c) => {
      const label = content[`Image${c}_Text`]?.trim();
      return {
        coverNumber: c,
        artists: collectSequential(content, (n) => `Image${c}_Artist${n}`),
        ...(label ? { imageLabel: label } : {}),
      };
    });
  };

  const parseBullets = (raw?: string): string[] => {
    if (!raw) return [];
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('*'))
      .map((l) => l.replace(/^\*+\s*/, '').trim())
      .filter(Boolean);
  };

  const parseAppearing = (raw?: string): WikiAppearingSection => {
    const section: WikiAppearingSection = {
      featuredCharacters: [],
      supportingCharacters: [],
      antagonists: [],
      otherCharacters: [],
      locations: [],
      items: [],
      concepts: [],
    };
    if (!raw) return section;

    let current: keyof WikiAppearingSection | null = null;
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();

      const header = trimmed.match(/^'''\s*(.+?):?\s*'''$/);
      if (header) {
        current = APPEARING_SECTIONS[header[1]!.toLowerCase().trim()] ?? null;
        continue;
      }

      if (!current || !trimmed.startsWith('*')) continue;

      const link = trimmed.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
      if (!link) continue;

      const notes = [...trimmed.matchAll(/\{\{(?!a\|)([^{}|]+)\}\}/g)].map((m) => m[1]!.trim());
      section[current].push({
        name: (link[2] ?? link[1]!).trim(),
        pageTitle: link[1]!.trim(),
        ...(notes.length ? { statusNote: notes.join(', ') } : {}),
      });
    }
    return section;
  };

  const serializeStories = (str: string): string[] => {
    return str?.includes('<br>')
      ? str
          ?.split('<br>')
          .map((sa) => sa.replace(/[[\]]/g, '')?.split('|')[0]?.trim())
          .filter((v): v is string => Boolean(v))
      : str
          ?.split(';')
          .map((sa) => sa.replace(/[[\]]/g, '')?.split('|')[0]?.trim())
          .filter((v): v is string => Boolean(v));
  };

  const collectNameYear = (
    content: WikiStrContent,
    prefix: string,
  ): { title: string; year: string }[] => {
    const r: { title: string; year: string }[] = [];
    for (let i = 1; content[`${prefix}Name${i}`]; i++) {
      r.push({
        title: content[`${prefix}Name${i}`]!.split('|')[1]?.replace('}}', '') || '',
        year: content[`${prefix}Year${i}`] || '',
      });
    }
    return r;
  };

  const stripWiki = (s: string): string => {
    return s
      .replace(/<ref[^>]*>.*?<\/ref>/gs, '')
      .replace(/<ref[^>]*\/>/g, '')
      .replace(/<!--.*?-->/gs, '')
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m: string, t: string, l?: string) =>
        (l ?? t).trim(),
      )
      .replace(/'''?/g, '')
      .trim();
  };

  /** Extracts the display label from a `[[Target|Label]]` wikilink, e.g. a `Speaker` field. */
  const extractSpeaker = (raw?: string): string | undefined => {
    if (!raw) return undefined;
    const link = raw.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
    if (link) return (link[2] ?? link[1])!.trim();
    return stripWiki(raw) || undefined;
  };

  const splitAliases = (raw?: string): string[] => {
    return (raw ?? '')
      .split(/;?\s*<br\s*\/?>|;/i)
      .map((a) => stripWiki(a))
      .filter(Boolean);
  };

  const parseHistory = (raw?: string): WikiCharacterHistorySection[] => {
    if (!raw) return [];
    const sections: WikiCharacterHistorySection[] = [];
    let current: WikiCharacterHistorySection = { heading: '', text: '' };
    for (const line of raw.split('\n')) {
      const header = line.trim().match(/^={2,}\s*(.+?)\s*={2,}$/);
      if (header) {
        if (current.heading || current.text.trim()) sections.push(current);
        current = { heading: stripWiki(header[1]!), text: '' };
      } else {
        current.text += (current.text ? '\n' : '') + line;
      }
    }
    if (current.heading || current.text.trim()) sections.push(current);
    return sections.map((s) => ({ ...s, text: s.text.trim() }));
  };

  const monthMap: Record<string, string> = {
    default: '00',
    January: '01',
    February: '02',
    March: '03',
    April: '04',
    May: '05',
    June: '06',
    July: '07',
    August: '08',
    September: '09',
    October: '10',
    November: '11',
    December: '12',
  };

  /** Parses Marvel's combined `ReleaseDate` infobox field (e.g. `"June 6, 2018"`) into zero-padded parts. */
  const parseReleaseDate = (raw?: string): { day: string; month: string; year: string } => {
    const [month, day, year] = raw?.split(' ') ?? [];
    return {
      day: day?.replace(',', '').padStart(2, '0') || '',
      month: monthMap[month ?? 'default'] || '',
      year: year || '',
    };
  };

  /** Falls back to parsing volume/issue from the page title (e.g. `"Immortal Hulk Vol 1 1"`), since Marvel infoboxes don't carry standalone `Volume`/`Issue` fields. */
  const parseVolumeIssueFromTitle = (title?: string): { volume: string; issue: string } => {
    const match = title?.match(/Vol\.?\s*(\d+)\s+(\d+[A-Za-z]*)\s*$/);
    return { volume: match?.[1] ?? '', issue: match?.[2] ?? '' };
  };

  //BUILDERS

  const wikiComicBuilder = (
    page: WikiPage | undefined,
    content: WikiStrContent,
    resolvedCover?: string,
  ): WikiComic => {
    const { day, month, year } = parseReleaseDate(content['ReleaseDate']);
    const speaker = extractSpeaker(content['Speaker']);
    const { volume: fallbackVolume, issue: fallbackIssue } = parseVolumeIssueFromTitle(page?.title);
    return {
      title: page?.title || '',
      volume: content['Volume'] || fallbackVolume,
      issue: content['Issue'] || fallbackIssue,
      cover: resolvedCover || page?.thumbnail || '',
      pageId: page?.id || -1,
      releaseDate: {
        releaseDay: day,
        releaseMonth: month,
        releaseYear: year,
      },
      credits: buildCredits(content),
      synopsis: collectSequential(content, (i) => `Synopsis${i}`).join('\n\n') || '',
      rating: content['Rating'] || '',
      event: content['Event1'] || '',
      storyTitles: collectSequential(content, (i) => `StoryTitle${i}`),
      appearing: parseAppearing(content['Appearing1']),
      ...(content['Quotation'] || speaker
        ? {
            quotation: {
              ...(content['Quotation'] ? { quote: content['Quotation'] } : {}),
              ...(speaker ? { speaker: speaker } : {}),
            },
          }
        : {}),
      coverVariants: buildCoverVariants(content),
      notes: parseBullets(content['Notes']),
      trivia: parseBullets(content['Trivia']),
      sourceWiki: page?.sourceWiki || '',
    };
  };

  const wikiVolumeBuilder = (page: WikiPage | undefined, content: WikiStrContent): WikiVolume => {
    const storyArcs = serializeStories(content['StoryArcs'] || '');

    const crossovers = serializeStories(content['Crossovers'] || '');

    const issueList =
      content['IssueList']
        ?.split('\n')
        .map((issue) => issue.split('|')[1]?.replaceAll('}', '') ?? '') ?? [];

    const history = content['History']?.replace(/[[\]']/g, '');

    return {
      title: page?.title ?? '',
      thumbnail: page?.thumbnail ?? '',
      pageId: page?.id ?? -1,
      type: content['Type'] ?? '',
      startDate: {
        month: content['StartMonth'] ?? '',
        year: content['StartYear'] ?? '',
      },
      endDate: {
        month: content['EndMonth'] ?? '',
        year: content['EndYear'] ?? '',
      },
      previousVolume: content['PreviousVol'] ?? '',
      nextVolume: content['NextVol'] ?? '',
      creators: content['Creators']?.split(';').map((c) => c.trim()) ?? [],
      featured: content['Featured']?.split(',').map((f) => f.trim()) ?? [],
      storyArcs: storyArcs || [],
      crossovers: crossovers || [],
      history: history ?? '',
      totalIssues: content['TotalIssues'] ?? '',
      issueList: issueList,
      annualIssues: collectNameYear(content, 'Annual'),
      specialIssues: collectNameYear(content, 'Special'),
      getComics(
        flags: Pick<WikiFlags, 'thumbnailSize' | 'includeCollections' | 'category' | 'sorted'> = {},
      ): Promise<WikiComic[]> {
        return resolveVolumeComics(issueList, flags);
      },
      sourceWiki: page?.sourceWiki || '',
    };
  };

  const wikiCharacterBuilder = (
    page: WikiPage | undefined,
    content: WikiStrContent,
  ): WikiCharacter => {
    return {
      name: page?.title ?? '',
      image: content['Image']?.replace(/<!--.*?-->/gs, '').trim() ?? '',
      thumbnail: page?.thumbnail ?? '',
      pageId: page?.id ?? -1,
      realName: content['RealName'] ?? '',
      mainAlias: content['MainAlias'] ?? '',
      aliases: splitAliases(content['Aliases']),
      alignment: stripWiki(content['Alignment'] ?? ''),
      identity: content['Identity'] ?? '',
      affiliation: content['Affiliation'] ?? '',
      relatives: content['Relatives'] ?? '',
      universe: content['Universe'] ?? '',
      baseOfOperations: content['BaseOfOperations'] ?? '',
      alienRace: content['AlienRace'] ?? '',
      gender: content['Gender'] ?? '',
      height: content['Height'] ?? '',
      weight: content['Weight'] ?? '',
      eyes: content['Eyes'] ?? '',
      hair: content['Hair'] ?? '',
      citizenship: content['Citizenship'] ?? '',
      maritalStatus: content['MaritalStatus'] ?? '',
      occupation: content['Occupation'] ?? '',
      creators:
        content['Creators']
          ?.split(';')
          .map((c) => c.trim())
          .filter(Boolean) ?? [],
      first: content['First'] ?? '',
      last: content['Last'] ?? '',
      ...(content['Quotation'] || content['Speaker'] || content['QuoteSource']
        ? {
            quotation: {
              ...(content['Quotation'] ? { quote: content['Quotation'] } : {}),
              ...(content['Speaker'] ? { speaker: content['Speaker'] } : {}),
              ...(content['QuoteSource'] ? { source: content['QuoteSource'] } : {}),
            },
          }
        : {}),
      overview: content['Overview'] ?? '',
      history: parseHistory(content['HistoryText']),
      powers: parseBullets(content['Powers']),
      abilities: parseBullets(content['Abilities']),
      weaknesses: parseBullets(content['Weaknesses']),
      equipment: parseBullets(content['Equipment']),
      transportation: parseBullets(content['Transportation']),
      weapons: parseBullets(content['Weapons']),
      notes: parseBullets(content['Notes']),
      trivia: parseBullets(content['Trivia']),
      getAppearances(flags: Pick<WikiFlags, 'sorted'> = {}): Promise<WikiComic[]> {
        return getCharacterAppearances(page?.title ?? '', flags);
      },
      sourceWiki: page?.sourceWiki || '',
    };
  };

  //PUBLIC INTERFACE

  /**
   * Finds the best-matching comic issue for `query`, fuzzy-matched against page titles.
   *
   * @param query - Comic title to search for, e.g. `"Action Comics #1000 (2018)"`.
   * @param flags - Search flags plus `multiple` to return all candidates instead of the best
   * match, and `limit` to raise the number of raw search results considered (defaults to 50 when
   * `multiple` is `true`, since broad queries can otherwise lose real matches to category
   * filtering after only 20 raw hits).
   * @returns The best match (or `null`), or all candidates when `flags.multiple` is `true`.
   */
  async function getComic(
    query: string,
    flags?: Pick<
      WikiFlags,
      'thumbnailSize' | 'includeCollections' | 'category' | 'sorted' | 'limit'
    > & {
      multiple?: false;
    },
  ): Promise<WikiComic | null>;
  async function getComic(
    query: string,
    flags?: Pick<
      WikiFlags,
      'thumbnailSize' | 'includeCollections' | 'category' | 'sorted' | 'limit'
    > & {
      multiple: true;
    },
  ): Promise<WikiComic[]>;
  async function getComic(
    query: string,
    flags?: Pick<
      WikiFlags,
      'thumbnailSize' | 'includeCollections' | 'category' | 'sorted' | 'limit'
    > & {
      multiple?: boolean;
    },
  ): Promise<WikiComic | WikiComic[] | null>;
  async function getComic(
    query: string,
    flags: Pick<
      WikiFlags,
      'thumbnailSize' | 'includeCollections' | 'category' | 'sorted' | 'multiple' | 'limit'
    > = {},
  ): Promise<WikiComic[] | WikiComic | null> {
    const nQuery = preNormalization(query);
    const categoriesOr: string[] = ['Category:Comics'];
    const categories: string[] = [];

    if (flags.includeCollections) {
      categoriesOr.push('Category:Collected Editions');
    }

    if (flags.category && flags.category.length > 0) {
      categories.push(...flags.category);
    }

    const pages = await wikiClient.getPage(nQuery, {
      category: categories,
      categoriesOr,
      ...resolveMultipleLimit(flags),
      ...(flags.thumbnailSize !== undefined ? { thumbnailSize: flags.thumbnailSize } : {}),
    });

    const candidates = await Promise.all(
      pages.map(async (p) => ({
        page: p,
        content: ((await p.getStructuredContent()) ?? {}) as WikiStrContent,
      })),
    );

    if (flags.multiple === true) {
      if (pages.length === 0) return [];
      const comics = await Promise.all(
        candidates.map(async (c) => {
          const cover = await resolveCoverFromContent(
            wikiClient,
            c.content,
            'Image1',
            flags.thumbnailSize,
          );
          return wikiComicBuilder(c.page, c.content, cover);
        }),
      );
      return flags.sorted === true ? comics.toSorted(byReleaseDate) : comics;
    }

    if (pages.length === 0) return null;

    const queryYear = extractYear(query);
    const best = selectBest(candidates, nQuery, queryYear);
    if (!best) return null;
    const bestContent = best.content ?? ({} as WikiStrContent);
    const bestCover = await resolveCoverFromContent(
      wikiClient,
      bestContent,
      'Image1',
      flags.thumbnailSize,
    );
    return wikiComicBuilder(best.page, bestContent, bestCover);
  }

  /**
   * Fetches one or more comic issues by their MediaWiki page ID.
   *
   * @param pageId - A single page ID, or an array to fetch several at once.
   * @param flags - Only `thumbnailSize` is used.
   */
  async function getComicById(
    pageId: number,
    flags?: Pick<WikiFlags, 'thumbnailSize'>,
  ): Promise<WikiComic | null>;
  async function getComicById(
    pageId: number[],
    flags?: Pick<WikiFlags, 'thumbnailSize'>,
  ): Promise<WikiComic[]>;
  async function getComicById(
    pageId: number | number[],
    flags: Pick<WikiFlags, 'thumbnailSize'> = {},
  ): Promise<WikiComic | null | WikiComic[]> {
    const thumbFlags = flags.thumbnailSize ? { thumbnailSize: flags.thumbnailSize } : {};

    const toComic = async (page: WikiPage): Promise<WikiComic> => {
      const content = (await page.getStructuredContent()) as WikiStrContent;
      const cover = await resolveCoverFromContent(
        wikiClient,
        content,
        'Image1',
        flags.thumbnailSize,
      );
      return wikiComicBuilder(page, content, cover);
    };

    if (Array.isArray(pageId)) {
      const pages = await wikiClient.getPageById(pageId, thumbFlags);
      return Promise.all(pages.map(toComic));
    }

    const page = await wikiClient.getPageById(pageId, thumbFlags);
    if (!page) return null;

    return toComic(page);
  }

  /**
   * Finds the best-matching comic-book volume for `query`, fuzzy-matched against page titles.
   *
   * @param query - Volume title to search for.
   * @param flags - Search flags plus `multiple` to return all candidates instead of the best
   * match, and `limit` to raise the number of raw search results considered (defaults to 50 when
   * `multiple` is `true`, since broad queries can otherwise lose real matches to category
   * filtering after only 20 raw hits).
   * @returns The best match (or `null`), or all candidates when `flags.multiple` is `true`.
   */
  async function getVolume(
    query: string,
    flags?: Pick<WikiFlags, 'thumbnailSize' | 'limit'> & { multiple?: false },
  ): Promise<WikiVolume | null>;
  async function getVolume(
    query: string,
    flags: Pick<WikiFlags, 'thumbnailSize' | 'limit'> & { multiple: true },
  ): Promise<WikiVolume[]>;
  async function getVolume(
    query: string,
    flags?: Pick<WikiFlags, 'thumbnailSize' | 'limit'> & { multiple?: boolean },
  ): Promise<WikiVolume | WikiVolume[] | null>;
  async function getVolume(
    query: string,
    flags: Pick<WikiFlags, 'thumbnailSize' | 'multiple' | 'limit'> = {},
  ): Promise<WikiVolume | null | WikiVolume[]> {
    const nQuery = preNormalization(query);

    const pages = await wikiClient.getPage(nQuery, {
      category: ['Category:Volumes'],
      ...resolveMultipleLimit(flags),
      ...(flags.thumbnailSize !== undefined ? { thumbnailSize: flags.thumbnailSize } : {}),
    });

    const candidates = await Promise.all(
      pages.map(async (p) => ({
        page: p,
        content: ((await p.getStructuredContent()) ?? {}) as WikiStrContent,
      })),
    );

    if (flags.multiple === true) {
      if (pages.length === 0) return [];
      return candidates.map((c) => wikiVolumeBuilder(c.page, c.content));
    }

    if (pages.length === 0) return null;
    const queryYear = extractYear(query);
    const best = selectBest(candidates, nQuery, queryYear);
    if (!best) return null;

    return wikiVolumeBuilder(best.page, best.content);
  }

  /**
   * Fetches one or more comic-book volumes by their MediaWiki page ID.
   *
   * @param pageId - A single page ID, or an array to fetch several at once.
   * @param flags - Only `thumbnailSize` is used.
   */
  async function getVolumeById(
    pageId: number,
    flags?: Pick<WikiFlags, 'thumbnailSize'>,
  ): Promise<WikiVolume | null>;
  async function getVolumeById(
    pageId: number[],
    flags?: Pick<WikiFlags, 'thumbnailSize'>,
  ): Promise<WikiVolume[]>;
  async function getVolumeById(
    pageId: number | number[],
    flags: Pick<WikiFlags, 'thumbnailSize'> = {},
  ): Promise<WikiVolume | null | WikiVolume[]> {
    const thumbFlags = flags.thumbnailSize ? { thumbnailSize: flags.thumbnailSize } : {};

    const toVolume = async (page: WikiPage): Promise<WikiVolume> => {
      const pageStrContent = (await page.getStructuredContent()) as WikiStrContent;
      return wikiVolumeBuilder(page, pageStrContent);
    };

    if (Array.isArray(pageId)) {
      const pages = await wikiClient.getPageById(pageId, thumbFlags);
      return Promise.all(pages.map(toVolume));
    }

    const page = await wikiClient.getPageById(pageId, thumbFlags);
    if (!page) return null;

    return toVolume(page);
  }

  /**
   * Resolves a volume's `issueList` (title strings) into full {@link WikiComic} objects
   * via {@link getComic}, dropping any titles that don't resolve to a page.
   */
  const resolveVolumeComics = async (
    issueList: string[],
    flags: Pick<WikiFlags, 'thumbnailSize' | 'includeCollections' | 'category' | 'sorted'> = {},
  ): Promise<WikiComic[]> => {
    const { sorted, ...getComicFlags } = flags;
    const comics = (
      await Promise.all(issueList.map((title) => getComic(title, getComicFlags)))
    ).filter((c): c is WikiComic => c !== null);

    return sorted === true ? comics.toSorted(byReleaseDate) : comics;
  };

  /**
   * Finds the best-matching character for `query`, fuzzy-matched against page titles.
   *
   * @param query - Character name to search for.
   * @param flags - Search flags plus `multiple` to return all candidates instead of the best
   * match, and `limit` to raise the number of raw search results considered (defaults to 50 when
   * `multiple` is `true`, since broad queries can otherwise lose real matches to category
   * filtering after only 20 raw hits).
   * @returns The best match (or `null`), or all candidates when `flags.multiple` is `true`.
   */
  async function getCharacter(
    query: string,
    flags?: Pick<WikiFlags, 'thumbnailSize' | 'category' | 'limit'> & { multiple?: false },
  ): Promise<WikiCharacter | null>;
  async function getCharacter(
    query: string,
    flags?: Pick<WikiFlags, 'thumbnailSize' | 'category' | 'limit'> & { multiple: true },
  ): Promise<WikiCharacter[]>;
  async function getCharacter(
    query: string,
    flags?: Pick<WikiFlags, 'thumbnailSize' | 'category' | 'limit'> & { multiple?: boolean },
  ): Promise<WikiCharacter | WikiCharacter[] | null>;
  async function getCharacter(
    query: string,
    flags: Pick<WikiFlags, 'thumbnailSize' | 'category' | 'multiple' | 'limit'> = {},
  ): Promise<WikiCharacter[] | WikiCharacter | null> {
    const nQuery = preNormalization(query);

    const pages = await wikiClient.getPage(nQuery, {
      category: flags.category ?? [],
      categoriesOr: ['Category:Characters'],
      ...resolveMultipleLimit(flags),
      ...(flags.thumbnailSize !== undefined ? { thumbnailSize: flags.thumbnailSize } : {}),
    });

    const candidates = await Promise.all(
      pages.map(async (p) => ({
        page: p,
        content: ((await p.getStructuredContent()) ?? {}) as WikiStrContent,
      })),
    );

    if (flags.multiple === true) {
      if (pages.length === 0) return [];
      return candidates.map((c) => wikiCharacterBuilder(c.page, c.content));
    }

    if (pages.length === 0) return null;
    const best = selectBest(candidates, nQuery, extractYear(query));
    if (!best) return null;
    return wikiCharacterBuilder(best.page, best.content);
  }

  /**
   * Fetches a character by its MediaWiki page ID.
   *
   * @param pageId - The character page's ID.
   * @param flags - Only `thumbnailSize` is used.
   * @returns The character, or `null` if the page doesn't exist.
   */
  const getCharacterById = async (
    pageId: number,
    flags: Pick<WikiFlags, 'thumbnailSize'> = {},
  ): Promise<WikiCharacter | null> => {
    const page = await wikiClient.getPageById(
      pageId,
      flags.thumbnailSize ? { thumbnailSize: flags.thumbnailSize } : {},
    );
    if (!page) return null;
    const content = (await page.getStructuredContent()) as WikiStrContent;
    return wikiCharacterBuilder(page, content);
  };

  /**
   * Fetches every comic a character appears in, via the wiki's `Category:<title>/Appearances` category.
   *
   * @param characterTitle - Exact page title of the character.
   * @param flags - Only `sorted` is used, to sort results by release date.
   */
  async function getCharacterAppearances(
    characterTitle: string,
    flags?: Pick<WikiFlags, 'sorted'>,
  ): Promise<WikiComic[]>;
  /**
   * Fetches every comic a character appears in, via the wiki's `Category:<title>/Appearances` category.
   *
   * @param pageId - The character page's MediaWiki page ID.
   * @param flags - Only `sorted` is used, to sort results by release date.
   */
  async function getCharacterAppearances(
    pageId: number,
    flags?: Pick<WikiFlags, 'sorted'>,
  ): Promise<WikiComic[]>;
  async function getCharacterAppearances(
    characterTitleOrId: string | number,
    flags: Pick<WikiFlags, 'sorted'> = {},
  ): Promise<WikiComic[]> {
    let characterTitle = characterTitleOrId;

    if (typeof characterTitleOrId === 'number') {
      const page = await wikiClient.getPageById(characterTitleOrId);
      if (!page) return [];
      characterTitle = page.title;
    }

    const pageIds = (
      await wikiClient.getCategoryMembers(`Category:${characterTitle}/Appearances`)
    ).map((t) => t.pageid);

    const comics = (await Promise.all(pageIds.map((id) => getComicById(id)))).filter(
      (c): c is WikiComic => c !== null,
    );

    return flags.sorted === true ? comics.toSorted(byReleaseDate) : comics;
  }

  return {
    getComic,
    getComicById,
    getVolume,
    getVolumeById,
    getCharacter,
    getCharacterById,
    getCharacterAppearances,
  };
}
