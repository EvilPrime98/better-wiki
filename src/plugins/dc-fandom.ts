import type { Wiki, WikiPage } from '../types';
import Fuse from 'fuse.js';

export interface WikiAppearanceEntry {
  name: string;
  pageTitle: string;
  statusNote?: string;
}

export interface WikiAppearingSection {
  featuredCharacters: WikiAppearanceEntry[];
  supportingCharacters: WikiAppearanceEntry[];
  antagonists: WikiAppearanceEntry[];
  otherCharacters: WikiAppearanceEntry[];
  locations: WikiAppearanceEntry[];
  items: WikiAppearanceEntry[];
  concepts: WikiAppearanceEntry[];
}

export type WikiStrContent = Record<string, string>;

export interface WikiComicCoverVariant {
  coverNumber: number;
  artists: string[];
  imageUrl?: string;
  imageLabel?: string;
}

export interface WikiCredits {
  writers: string[];
  artists: string[];
  inkers: string[];
  colorists: string[];
  letterers: string[];
  editors: string[];
  executiveEditors: string[];
}

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
}

export interface WikiReleaseDate {
  releaseDay: string;
  releaseMonth: string;
  releaseYear: string;
}

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
}

interface WikiFandomFlags {
  thumbnailSize?: number;
  multiple?: boolean;
}

export function dcFandomPlugin(wikiClient: Wiki) {
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
      s.toLowerCase().replace(/[\W_]+/g, ' ').replace(/\s+/g, ' ').trim();

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
        score += parseInt(content['Month'] ?? '0', 10) * 0.5;
        score += parseInt(content['Day'] ?? '0', 10) * 0.1;
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
    const variants: WikiComicCoverVariant[] = [];
    for (let c = 1; ; c++) {
      const prefix = c === 1 ? 'CoverArtist' : `Cover${c}Artist`;
      if (content[`${prefix}1`] === undefined) break;
      variants.push({
        coverNumber: c,
        artists: collectSequential(content, (n) => `${prefix}${n}`),
      });
    }
    return variants;
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

  //BUILDERS

  const wikiComicBuilder = (page: WikiPage | undefined, content: WikiStrContent): WikiComic => {
    return {
      title: page?.title || '',
      volume: content['Volume'] || '',
      issue: content['Issue'] || '',
      cover: page?.thumbnail || '',
      pageId: page?.id || -1,
      releaseDate: {
        releaseDay: content['Day'] || '',
        releaseMonth: content['Month'] || '',
        releaseYear: content['Year'] || '',
      },
      credits: buildCredits(content),
      synopsis: collectSequential(content, (i) => `Synopsis${i}`).join('\n\n') || '',
      rating: content['Rating'] || '',
      event: content['Event'] || '',
      storyTitles: collectSequential(content, (i) => `StoryTitle${i}`),
      appearing: parseAppearing(content['Appearing1']),
      ...(content['Quotation'] || content['Speaker']
        ? {
            quotation: {
              ...(content['Quotation'] ? { quote: content['Quotation'] } : {}),
              ...(content['Speaker'] ? { speaker: content['Speaker'] } : {}),
            },
          }
        : {}),
      coverVariants: buildCoverVariants(content),
      notes: parseBullets(content['Notes']),
      trivia: parseBullets(content['Trivia']),
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
    };
  };

  //PUBLIC INTERFACE

  async function getComic(query: string, flags?: { multiple?: false; thumbnailSize?: number }): Promise<WikiComic | null>;
  async function getComic(query: string, flags: { multiple: true; thumbnailSize?: number }): Promise<WikiComic[]>;
  async function getComic(
    query: string,
    flags: WikiFandomFlags = {},
  ): Promise<WikiComic[] | WikiComic | null> {
    const nQuery = preNormalization(query);

    const pages = await wikiClient.getPage(nQuery, {
      categoriesOr: ['Category:Comics', 'Category:Collected Editions'],
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
      return candidates.map((c) => wikiComicBuilder(c.page, c.content));
    }

    const queryYear = extractYear(query);
    const best = selectBest(candidates, nQuery, queryYear);
    return wikiComicBuilder(best?.page, best?.content ?? ({} as WikiStrContent));
  }

  const getComicById = async (
    pageId: number,
    flags: WikiFandomFlags = {},
  ): Promise<WikiComic | null> => {
    const page = await wikiClient.getPageById(
      pageId,
      flags.thumbnailSize ? { thumbnailSize: flags.thumbnailSize } : {},
    );

    if (!page) return null;

    const pageStrContent = (await page.getStructuredContent()) as WikiStrContent;

    return wikiComicBuilder(page, pageStrContent);
  };

  async function getVolume(query: string, flags?: { multiple?: false; thumbnailSize?: number }): Promise<WikiVolume | null>;
  async function getVolume(query: string, flags: { multiple: true; thumbnailSize?: number }): Promise<WikiVolume[]>;
  async function getVolume(
    query: string,
    flags: WikiFandomFlags = {},
  ): Promise<WikiVolume | null | WikiVolume[]> {
    const nQuery = preNormalization(query);

    const pages = await wikiClient.getPage(nQuery, {
      category: ['Category:Volumes'],
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

  const getVolumeById = async (
    pageId: number,
    thumbnailSize?: number,
  ): Promise<WikiVolume | null> => {
    const page = await wikiClient.getPageById(
      pageId,
      thumbnailSize !== undefined ? { thumbnailSize } : {},
    );

    if (!page) return null;

    const content = (await page.getStructuredContent()) as WikiStrContent;

    return wikiVolumeBuilder(page, content);
  };

  return {
    getComic,
    getComicById,
    getVolume,
    getVolumeById,
  };
}
