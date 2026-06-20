import { describe, it, expect } from 'vitest';

import {
  normalizeTitle,
  capitalize,
  chunkArray,
  removeCoverRevision,
  extractYear,
  normalizeQueryString,
  stripWikiMarkup,
  getInnerText,
  buildComicPageTitle,
  normalizeDates,
  sortAppearances,
  parseReleaseDate,
  parseCredits,
  parseComicMetadata,
  parseSynopsis,
  parseAppearanceEntry,
  getAppearing,
  getComicExtras,
} from '../utils.js';

import type { CharacterAppearance } from '../types.js';

describe('normalizeTitle', () => {
  it('title-cases words and joins with underscores', () => {
    expect(normalizeTitle('absolute superman', false)).toBe('Absolute_Superman');
  });

  it('keeps connector words lowercase', () => {
    expect(normalizeTitle('justice league of america', false)).toBe('Justice_League_of_America');
  });

  it('appends a trailing underscore when requested', () => {
    expect(normalizeTitle('batman')).toBe('Batman_');
  });

  it('collapses repeated whitespace', () => {
    expect(normalizeTitle('the   dark   knight', false)).toBe('the_Dark_Knight');
  });
});

describe('capitalize', () => {
  it('capitalizes each word, preserving spaces', () => {
    expect(capitalize('justice league')).toBe('Justice League');
  });
});

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

describe('removeCoverRevision', () => {
  it('strips the /revision suffix', () => {
    expect(removeCoverRevision('https://x/img.jpg/revision/latest?cb=1')).toBe('https://x/img.jpg');
  });

  it('returns undefined for null', () => {
    expect(removeCoverRevision(null)).toBeUndefined();
  });
});

describe('extractYear', () => {
  it('extracts a 4-digit year in parentheses', () => {
    expect(extractYear('Batman (2016) 1')).toBe('2016');
  });

  it('returns undefined when no year is present', () => {
    expect(extractYear('Batman 1')).toBeUndefined();
  });
});

describe('normalizeQueryString', () => {
  it('strips extensions, leading zeroes and parentheticals', () => {
    expect(normalizeQueryString('Batman (2016) 007.cbz')).toBe('Batman  7');
  });
});

describe('stripWikiMarkup', () => {
  it('unwraps links keeping the display text', () => {
    expect(stripWikiMarkup('[[Bruce Wayne|Batman]]')).toBe('Batman');
  });

  it('removes templates and bold/italic markers', () => {
    expect(stripWikiMarkup("'''Hello''' {{template}}")).toBe('Hello');
  });
});

describe('getInnerText', () => {
  it('strips HTML tags', () => {
    expect(getInnerText('<a href="#"><b>Gotham</b></a>')).toBe('Gotham');
  });
});

describe('buildComicPageTitle', () => {
  it('builds the canonical page title', () => {
    expect(buildComicPageTitle('Absolute Superman', '1', '1')).toBe('Absolute_Superman_Vol_1_1');
  });

  it('replaces ALL spaces, not just the first (regression)', () => {
    expect(buildComicPageTitle('Justice League International', '1', '3')).toBe(
      'Justice_League_International_Vol_1_3',
    );
  });
});

describe('parseReleaseDate', () => {
  it('parses Day/Month/Year infobox lines', () => {
    const content = '| Day = 12\n| Month = March\n| Year = 2016';
    expect(parseReleaseDate(content)).toEqual({
      releaseDay: '12',
      releaseMonth: 'March',
      releaseYear: '2016',
    });
  });

  it('returns empty fields for undefined content', () => {
    expect(parseReleaseDate(undefined)).toEqual({
      releaseDay: '',
      releaseMonth: '',
      releaseYear: '',
    });
  });
});

describe('parseCredits', () => {
  it('collects credits into typed arrays', () => {
    const content = [
      '| Writer1 = Grant Morrison',
      '| Penciler1 = Frank Quitely',
      '| Inker1 = ',
      '| Editor1 = Joe Editor',
    ].join('\n');

    const credits = parseCredits(content);
    expect(credits.writers).toEqual(['Grant Morrison']);
    expect(credits.artists).toEqual(['Frank Quitely']);
    expect(credits.inkers).toEqual([]);
    expect(credits.editors).toEqual(['Joe Editor']);
  });
});

describe('parseComicMetadata', () => {
  it('extracts volume and issue', () => {
    expect(parseComicMetadata('| Vol = 1\n| Issue = 7')).toEqual({ volume: '1', issue: '7' });
  });
});

describe('parseSynopsis', () => {
  it('extracts the synopsis block', () => {
    const content = '| Synopsis1 = Bruce returns to Gotham.\n| NextField = x';
    expect(parseSynopsis(content)).toBe('Bruce returns to Gotham.');
  });

  it('returns an empty string when absent', () => {
    expect(parseSynopsis('| Other = y')).toBe('');
  });
});

describe('parseAppearanceEntry', () => {
  it('parses a linked appearance with display name', () => {
    expect(parseAppearanceEntry('* [[Bruce Wayne (Prime Earth)|Batman]]')).toEqual({
      name: 'Batman',
      pageTitle: 'Bruce Wayne (Prime Earth)',
      statusNote: undefined,
    });
  });

  it('captures a status note from a colour template', () => {
    const entry = parseAppearanceEntry('* [[Robin]] {{Death|Dies}}');
    expect(entry?.pageTitle).toBe('Robin');
  });

  it('returns null when there is no link', () => {
    expect(parseAppearanceEntry('* just plain text')).toBeNull();
  });
});

describe('getAppearing', () => {
  it('groups entries under their section headers', () => {
    const content = [
      '| Appearing1 =',
      "'''Featured Characters:'''",
      '* [[Superman]]',
      "'''Antagonists:'''",
      '* [[Lex Luthor]]',
      '| NextField = x',
    ].join('\n');

    const appearing = getAppearing(content);
    expect(appearing?.featuredCharacters.map((c) => c.name)).toEqual(['Superman']);
    expect(appearing?.antagonists.map((c) => c.name)).toEqual(['Lex Luthor']);
  });

  it('returns null when there is no Appearing block', () => {
    expect(getAppearing('| Other = y')).toBeNull();
  });
});

describe('getComicExtras', () => {
  it('parses rating, event, cover variants and empties notes when absent', () => {
    const content = [
      '| Rating = T',
      '| Event = Rebirth',
      '| Image = cover1.jpg',
      '| CoverArtist1 = Jim Lee',
      '| Cover2Artist1 = Andy Kubert',
      '| Image2 = cover2.jpg',
    ].join('\n');

    const extras = getComicExtras(content);
    expect(extras.rating).toBe('T');
    expect(extras.event).toBe('Rebirth');
    expect(extras.notes).toEqual([]);
    expect(extras.trivia).toEqual([]);

    expect(extras.coverVariants).toEqual([
      { coverNumber: 1, artists: ['Jim Lee'], imageUrl: 'cover1.jpg' },
      { coverNumber: 2, artists: ['Andy Kubert'], imageUrl: 'cover2.jpg' },
    ]);
  });
});

describe('normalizeDates + sortAppearances', () => {
  const make = (title: string, year: string, month: string, day: string): CharacterAppearance => ({
    pageId: 1,
    title,
    link: '',
    index: 0,
    releaseDate: {
      releaseYear: year,
      releaseMonth: month,
      releaseDay: day,
    },
  });

  it('maps month names to zero-padded numbers', () => {
    const [a] = normalizeDates([make('A', '2016', 'March', '1')]);
    expect(a!.releaseDate?.releaseMonth).toBe('03');
  });

  it('sorts chronologically then by title', () => {
    const sorted = sortAppearances(
      normalizeDates([
        make('B', '2017', 'January', '1'),
        make('A', '2016', 'December', '5'),
        make('C', '2016', 'December', '5'),
      ]),
    );

    expect(sorted.map((a) => a.title)).toEqual(['A', 'C', 'B']);
  });
});
