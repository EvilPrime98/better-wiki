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
  continue: {
    clcontinue: string;
    continue: string;
  };
  query: {
    pages: Record<string, WikiSearchGeneratorPageItem>;
  };
  limit: Record<string, string>;
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

export interface WikiPage {
  id: number;
  title: string;
  canonicalUrl: string;
  thumbnail: string;
  categories: string[];
  getStructuredContent: () => Promise<Record<string, string>>;
  getPageContent: () => Promise<string | undefined>;
  getInfobox: () => Promise<{
    [k: string]: string;
  }>;
  getImages: (width?: number) => Promise<(string | undefined)[]>;
  getGallery: (width?: number) => Promise<string[]>;
}

export interface WikiQueryImagesResponse {
  batchcomplete: string;
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

export interface WikiPageFlags {
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
}

export interface WikiContentOptions {
  structured?: boolean;
}

export interface Wiki {
  getPage: (query: string, flags?: WikiPageFlags) => Promise<WikiPage[]>;
  getPageById: (
    pageId: number,
    flags?: Omit<WikiPageFlags, 'category'>,
  ) => Promise<WikiPage | null>;
  getPageByTitle: (title: string, flags?: WikiPageFlags) => Promise<WikiPage | null>;
  getPagesByCategory: (
    category: string,
    flags?: Omit<WikiPageFlags, 'category'>,
  ) => Promise<WikiPage[]>;
  getThumbnailById: (pageId: number, width?: number) => Promise<string>;
  getPageContent: {
    (
      pageId: number,
      contentOptions: {
        structured: true;
      },
    ): Promise<Record<string, string>>;
    (pageId: number, contentOptions?: WikiContentOptions): Promise<string | undefined>;
  };
  getCategoryMembers: (categoryTitle: string) => Promise<
    Array<{
      pageid: number;
      ns: number;
      title: string;
    }>
  >;
  searchCategories: (query: string) => Promise<string[]>;
  getCategoriesFromPage: (pageId: number) => Promise<
    {
      ns: number;
      title: string;
    }[]
  >;
  clearCache: () => void;
}
