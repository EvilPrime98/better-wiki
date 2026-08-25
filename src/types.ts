export interface WikiPageImagesResponse {
  query: {
    pages: {
      [pageId: string]: {
        pageid: number;
        title: string;
        original?: {
          source: string;
          width: number;
          height: number;
        };
      };
    };
  };
}

export interface WikiRevisionsResponse {
  query: {
    pages: {
      [pageId: string]: {
        pageid: number;
        title: string;
        revisions: Array<{
          slots: {
            main: {
              '*': string;
            };
          };
        }>;
      };
    };
  };
}

export interface WikiPageInfoResponse {
  query: {
    pages: {
      [pageId: string]: {
        pageid: number;
        ns: number;
        title: string;
        contentmodel: string;
        pagelanguage: string;
        pagelanguagehtmlcode: string;
        pagelanguagedir: string;
        touched: string;
        lastrevid: number;
        length: number;
        fullurl: string;
        editurl: string;
        canonicalurl: string;
      };
    };
  };
}

export interface WikiAllPagesResponse {
  query: {
    allpages: Array<{
      pageid: number;
      ns: number;
      title: string;
    }>;
  };
}

export interface WikiSearchResponse {
  continue?: { sroffset: number; continue: string };
  query: {
    search: {
      ns: number;
      title: string;
      pageid: number;
      size: number;
      wordcount: number;
      snippet: string;
      timestamp: string;
    }[];
  };
}

export interface WikiParseResponse {
  parse: {
    title: string;
    pageId: number;
    properties: {
      name: string;
      '*': string;
    }[];
  };
  error: {
    code: string;
    info: string;
    '*': string;
  };
}

export interface WikiParseProperties {
  parser_tag_version: number;
  data: (
    | WikiParsePropertiesImageType
    | WikiParsePropertiesTitleType
    | WikiParsePropertiesPanelType
    | WikiParsePropertiesDataType
    | WikiParsePropertiesGroupType
  )[];
}

export interface WikiParsePropertiesHeaderType {
  type: 'header';
  data: {
    value: string;
    'item-name': string | null;
    source: string | null;
  };
}

export interface WikiParsePropertiesDataType {
  type: 'data';
  data: {
    label: string;
    value: string;
    span: number;
    layout: string | null;
    'item-name': string | null;
    source: string;
  };
}

export interface WikiParsePropertiesImageType {
  type: 'image';
  data: {
    url: string;
    name: string;
    key: string;
    alt: string;
    caption: string;
    isVideo: boolean;
    'item-name': string | null;
    source: 'Image';
  }[];
}

export interface WikiParsePropertiesGroupType {
  type: 'group';
  data: {
    value: (
      | WikiParsePropertiesHeaderType
      | WikiParsePropertiesImageType
      | WikiParsePropertiesTitleType
      | WikiParsePropertiesPanelType
      | WikiParsePropertiesDataType
      | WikiParsePropertiesGroupType
    )[];
    layout: string | null;
    collapse: string | null;
    'row-items': string | null;
    'item-name': string | null;
  };
}

export interface WikiParsePropertiesTitleType {
  type: 'title';
  data: {
    value: string;
    'item-name': string;
    sourcer: string;
  };
}

export interface WikiParsePropertiesPanelType {
  type: 'panel';
  data: {
    value: unknown;
    collapse: string | null;
    'item-name': string | null;
  };
}

export interface WikiSearchGeneratorResponse {
  continue?: {
    clcontinue: string;
    continue: string;
  };
  query: {
    pages: Record<string, WikiSearchGeneratorPageItem>;
  };
  limits: {
    categories: number;
  };
}

export interface WikiPageCategory {
  ns: number;
  title: string;
}

export interface WikiSearchGeneratorPageItem {
  pageid: number;
  ns: number;
  title: string;
  index: number;
  thumbnail?: string;
  categories: { ns: number; title: string }[];
  canonicalUrl: string;
}

export interface WikiImageInfoResponse {
  query: {
    pages: Record<
      string,
      {
        title: string;
        imageinfo?: Array<{ url: string }>;
      }
    >;
  };
}

/** @internal */
export interface WikiGetPageResponse {
  batchcomplete: string;
  continue?: { gsroffset: number; clcontinue?: string; continue: string };
  warnings?: { query: { '*': string } };
  query: {
    pages: Record<
      string,
      {
        pageid: number;
        ns: number;
        title: string;
        index: number;
        contentmodel: string;
        pagelanguage: string;
        pagelanguagehtmlcode: string;
        pagelanguagedir: string;
        touched: string;
        lastrevid: number;
        length: number;
        fullurl: string;
        editurl: string;
        canonicalurl: string;
        thumbnail: {
          source: string;
          width: number;
          height: number;
        };
        categories?: Array<{ ns: number; title: string }>;
      }
    >;
  };
}

export interface ReleaseDate {
  releaseDay: string;
  releaseMonth: string;
  releaseYear: string;
}

export interface Comic {
  title: string;
  link: string;
  index: number;
  cover?: string | undefined;
  releaseDate?: string;
}

export interface SeriesData {
  name: string;
  publisher: string;
  seriesVolume: string | null;
  dates: string;
  refName: string;
  wikiRef: string;
  searchUrl: string;
  totalFound: number;
}

export interface CharacterAppearance {
  pageId: number;
  title: string;
  url?: string | undefined;
  link: string;
  index: number;
  cover?: string | undefined;
  releaseDate: ReleaseDate | null;
}

export interface Appearance {
  pageId: number;
  title: string;
  url: string | undefined;
  link: string;
  index: number;
  cover: string | undefined;
  releaseDate: ReleaseDate | null;
}

export interface ExactPageResponse {
  query: {
    pages: {
      [pageId: string]: {
        pageid: number;
        title: string;
        original?: { source: string; width: number; height: number };
        revisions?: Array<{ slots: { main: { '*': string } } }>;
      };
    };
  };
}

export interface ComicCredits {
  writers: string[];
  artists: string[];
  inkers: string[];
  colorists: string[];
  letterers: string[];
  editors: string[];
  executiveEditors: string[];
}

export interface AppearanceEntry {
  name: string;
  pageTitle: string;
  statusNote?: string | undefined;
}

export interface AppearingSection {
  featuredCharacters: AppearanceEntry[];
  supportingCharacters: AppearanceEntry[];
  antagonists: AppearanceEntry[];
  otherCharacters: AppearanceEntry[];
  locations: AppearanceEntry[];
  items: AppearanceEntry[];
  concepts: AppearanceEntry[];
}

export interface CoverVariant {
  coverNumber: number;
  artists: string[];
  imageUrl?: string | undefined;
  imageLabel?: string | undefined;
}

export interface ComicInfo {
  error: boolean;
  message: string;
  title?: string | undefined;
  volume?: string | undefined;
  issue?: string | undefined;
  cover?: string | undefined;
  pageId?: number | undefined;
  credits?: ComicCredits | undefined;
  releaseDate?: ReleaseDate | undefined;
  synopsis?: string | undefined;
  rating?: string | undefined;
  event?: string | undefined;
  storyTitles?: string[] | undefined;
  appearing?: AppearingSection | undefined;
  quotation?: { quote?: string | undefined; speaker?: string | undefined };
  speaker?: string | undefined;
  coverVariants?: CoverVariant[] | undefined;
  notes?: string[] | undefined;
  trivia?: string[] | undefined;
}

export interface WikiOptions {
  /** Time in ms an API response stays cached. Default: 300000 (5 min). */
  CACHE_TTL?: number;
  /** When false, disables the in-memory response cache entirely (`CACHE_TTL` is ignored). Default: true. */
  allowCache?: boolean;
  /** User-Agent header sent with every request (recommended by Fandom/Wikimedia). */
  userAgent?: string;
  /** Abort a request after this many ms. Default: 15000. */
  timeout?: number;
  /** Number of retries on a failed/timed-out request. Default: 2. */
  retries?: number;
  /** Publisher name reported in series data. Default: '' (unknown). */
  publisher?: string;
  /** When true, logs diagnostic warnings/errors to stderr. Default: false. */
  debug?: boolean;
}

export interface WikiInfobox {
  [x: string]: string;
}

/** A wiki page as returned by the base client, with lazily-fetched content accessors. */
export interface WikiPage {
  /** MediaWiki page ID. */
  id: number;
  title: string;
  canonicalUrl: string;
  thumbnail: string;
  categories: string[];
  /** Base URL of the wiki this page was fetched from, e.g. `https://dc.fandom.com`. */
  sourceWiki: string;
  /** Fetches and parses the page's infobox template into a flat key/value map. */
  getStructuredContent: () => Promise<Record<string, string>>;
  /** Fetches the page's raw wikitext content. */
  getPageContent: () => Promise<string | undefined>;
  /** Fetches infobox data via the MediaWiki `parse` API's structured properties. */
  getInfobox: () => Promise<{
    [k: string]: string;
  }>;
  /** Fetches URLs of images embedded in the page, optionally scaled to `width`. */
  getImages: (width?: number) => Promise<(string | undefined)[]>;
  /** Fetches URLs of images in the page's `/Gallery` subpage, optionally scaled to `width`. */
  getGallery: (width?: number) => Promise<string[]>;
}

export interface WikiQueryImagesResponse {
  batchcomplete: string;
  continue?: { gimcontinue: string; continue: string };
  limits: { images: number };
  query: {
    pages: Record<
      string,
      {
        pageId: number;
        ns: number;
        title: string;
        imagerepository: string;
        imageinfo: {
          url: string;
          descriptionurl: string;
          descriptionshorturl: string;
        }[];
      }
    >;
  };
}

export interface WikiQueryGalleryResponse {
  batchcomplete: string;
  continue?: { imcontinue: string; continue: string };
  limits: { images: number };
  query: {
    pages: Record<
      string,
      {
        pageId: number;
        ns: number;
        title: string;
        images: {
          ns: number;
          title: string;
        }[];
      }
    >;
  };
}

export interface ImageInfo {
  url: string;
}

export interface WikiQueryImageInfoResponse {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        imageinfo?: ImageInfo[];
      }
    >;
  };
}

export interface ComicExtras {
  rating: string;
  event: string;
  storyTitles: string[];
  quotation: string;
  speaker: string;
  notes: string[];
  trivia: string[];
  coverVariants: CoverVariant[];
}

export interface WikiFlags {
  /**
   * Result must be a member of `all` of these categories.
   */
  category?: string[];
  /**
   * Result must be a member of at least `ONE` of these categories.
   */
  categoriesOr?: string[];
  /**
   * Width of image elements in pixels. Default is `original`.
   */
  thumbnailSize?: number;
  /**
   * Limit the number of results returned. Default is `20`.
   */
  limit?: number;
  /**
   * Return all matches instead of just the best match. Default is `false`.
   */
  multiple?: boolean;
  /**
   * Only meaningful for search-based lookups (e.g. `getComic`). Also match pages in
   * `Category:Collected Editions`.
   */
  includeCollections?: boolean;
  /**
   * Sort results by release date. Default is `false`.
   */
  sorted?: boolean;
}

/** Options controlling how {@link Wiki.getPageContent} returns page content. */
export interface WikiContentOptions {
  /** When `true`, parse the page's infobox template into a key/value map instead of returning raw wikitext. */
  structured?: boolean;
}

/** Base client returned by {@link wiki}, providing generic MediaWiki page/category lookups. */
export interface Wiki {
  /** Searches for pages matching `query`, optionally filtered by category. */
  getPage: (
    query: string,
    flags?: Pick<WikiFlags, 'category' | 'categoriesOr' | 'thumbnailSize' | 'limit'>,
  ) => Promise<WikiPage[]>;
  /** Fetches one or more pages by their MediaWiki page ID. */
  getPageById: {
    (pageId: number, flags?: Pick<WikiFlags, 'thumbnailSize'>): Promise<WikiPage | null>;
    (pageId: number[], flags?: Pick<WikiFlags, 'thumbnailSize'>): Promise<WikiPage[]>;
  };
  /** Fetches a single page by its exact title, or `null` if not found. */
  getPageByTitle: (
    title: string,
    flags?: Pick<WikiFlags, 'category' | 'thumbnailSize'>,
  ) => Promise<WikiPage | null>;
  /** Fetches every page belonging to `category`. */
  getPagesByCategory: (
    category: string,
    flags?: Pick<WikiFlags, 'thumbnailSize'>,
  ) => Promise<WikiPage[]>;
  /** Fetches a page's thumbnail URL, optionally scaled to `width`. */
  getThumbnailById: (pageId: number, width?: number) => Promise<string>;
  /** Resolves a wiki filename (e.g. `Image1.jpg`, without the `File:` prefix) to its URL, optionally scaled to `width`. */
  getFileUrl: (fileName: string, width?: number) => Promise<string>;
  /** Fetches a page's content by ID, as raw wikitext or a structured key/value map. */
  getPageContent: {
    (
      pageId: number,
      contentOptions: {
        structured: true;
      },
    ): Promise<Record<string, string>>;
    (pageId: number, contentOptions?: WikiContentOptions): Promise<string | undefined>;
  };
  /** Fetches the members of one or more categories, paginating through all results.
   * The categories are read left to right, which means that the first category should always be
   * the one who narrows the elements the most (for efficient queries that is.)
   *
   * `flags.limit` caps the number of returned members. For a single category this stops
   * pagination as soon as enough members are fetched. For multiple categories it caps the
   * final, filtered result count — matching members are fetched and category-checked in
   * growing batches until `limit` is reached, instead of scanning the entire first category.
   */
  getCategoryMembers: {
    (categoryTitle: string, flags?: Pick<WikiFlags, 'limit'>): Promise<WikiCategoryMemberItem[]>;
    (categoryTitle: string[], flags?: Pick<WikiFlags, 'limit'>): Promise<WikiCategoryMemberItem[]>;
  };
  /** Searches category titles (MediaWiki namespace 14) matching `query`. */
  searchCategories: (query: string) => Promise<string[]>;
  /** Fetches the categories a single page belongs to. */
  getCategoriesFromPage: (pageId: number) => Promise<WikiPageCategory[]>;
  /** Clears the in-memory API response cache. */
  clearCache: () => void;
}

/** @internal */
export type CategoriesResponse = {
  continue?: { clcontinue: string; continue: string };
  query: {
    pages: Record<
      string,
      {
        pageid: number;
        ns: number;
        title: string;
        categories?: WikiPageCategory[];
      }
    >;
  };
};

export interface WikiCategoryMemberItem {
  pageid: number;
  ns: number;
  title: string;
}

/** @internal */
export type CategoryMembersResponse = {
  batchcomplete: string;
  continue?: { cmcontinue: string; continue: string };
  query: { categorymembers: Array<{ pageid: number; ns: number; title: string }> };
};
