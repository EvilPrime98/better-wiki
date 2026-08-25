export const VERSION = '0.7.0';

import { isGeneratorPageItem } from './predicates.types.js';

import type {
  WikiPageImagesResponse,
  WikiRevisionsResponse,
  WikiPageInfoResponse,
  WikiAllPagesResponse,
  WikiSearchResponse,
  WikiImageInfoResponse,
  ReleaseDate,
  Comic,
  SeriesData,
  Appearance,
  CharacterAppearance,
  ExactPageResponse,
  ComicCredits,
  ComicInfo,
  CoverVariant,
  WikiOptions,
  WikiSearchGeneratorPageItem,
  WikiPage,
  WikiQueryImagesResponse,
  WikiSearchGeneratorResponse,
  WikiQueryGalleryResponse,
  WikiParseResponse,
  WikiParseProperties,
  WikiParsePropertiesTitleType,
  WikiParsePropertiesDataType,
  WikiParsePropertiesImageType,
  WikiParsePropertiesGroupType,
  WikiFlags,
  WikiContentOptions,
  Wiki,
  WikiGetPageResponse,
  WikiPageCategory,
  CategoriesResponse,
  WikiCategoryMemberItem,
  CategoryMembersResponse,
} from './types.js';

import { chunkArray, getInnerText } from './utils.js';
import { PLUGINS, type PluginName, type PluginReturn } from './plugins/index.js';

export {
  WikiPageImagesResponse,
  WikiRevisionsResponse,
  WikiPageInfoResponse,
  WikiAllPagesResponse,
  WikiSearchResponse,
  WikiImageInfoResponse,
  ReleaseDate,
  CharacterAppearance,
  Comic,
  SeriesData,
  Appearance,
  ExactPageResponse,
  ComicCredits,
  ComicInfo,
  CoverVariant,
  WikiOptions,
  Wiki,
};

const DEFAULT_OPTIONS: Required<WikiOptions> = {
  CACHE_TTL: 5 * 60 * 1000,
  allowCache: true,
  userAgent: 'better-wiki (https://www.npmjs.com/package/better-wiki)',
  timeout: 15_000,
  retries: 2,
  publisher: '',
  debug: false,
};

/**
 * Creates a wiki client for `url`, extended with the named plugin's methods.
 *
 * @param options - Client options plus the `plugin` to load.
 * @param options.url - Overrides the plugin's default wiki URL, letting the plugin's
 *   methods run against a different MediaWiki instance. Plugins parse infobox field
 *   names and category names specific to their default wiki's schema, so methods may
 *   return incomplete or empty results on a wiki whose schema differs — see the
 *   plugin's own docs for which conventions it assumes.
 * @throws If `options.plugin` isn't a registered plugin name.
 */
export function wiki<K extends PluginName>(
  options: WikiOptions & { plugin: K; url?: string },
): Wiki & PluginReturn<K>;
/**
 * Creates a base wiki client for the MediaWiki site at `url`.
 *
 * @param url - Base URL of the wiki (without `/wiki` or `/api.php`).
 * @param options - Client options such as caching, timeouts, and retries.
 */
export function wiki(url: string, options?: WikiOptions): Wiki;
export function wiki(
  urlOrOptions: string | (WikiOptions & { plugin?: PluginName; url?: string }),
  baseOptions: WikiOptions = {},
): Wiki | (Wiki & object) {
  let wikiUrl: string;
  let options: WikiOptions;
  let pluginName: PluginName | undefined;

  if (typeof urlOrOptions === 'string') {
    wikiUrl = urlOrOptions;
    options = baseOptions;
  } else {
    const { plugin: key, url: urlOverride, ...rest } = urlOrOptions;
    if (!key || !(key in PLUGINS)) throw new Error(`Unknown plugin: "${key}"`);
    pluginName = key;
    wikiUrl = urlOverride ?? PLUGINS[key].url;
    options = rest;
  }

  //CONFIG

  const config: Required<WikiOptions> = { ...DEFAULT_OPTIONS, ...options };

  const apiCache = new Map<string, { data: unknown; timestamp: number }>();

  const API_BASE_URL: string = `${wikiUrl}/api.php`;

  const WIKI_BASE_URL: string = `${wikiUrl}/wiki`;

  const debug = (...args: unknown[]): void => {
    if (config.debug) console.error('[better-wiki]', ...args);
  };

  //HTTP

  const fetchWithRetry = async (url: string): Promise<Response> => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= config.retries; attempt++) {
      const controller = new AbortController();

      const timer = setTimeout(() => controller.abort(), config.timeout);

      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': config.userAgent },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        return response;
      } catch (error) {
        lastError = error;

        debug(`fetch attempt ${attempt + 1} failed for ${url}:`, error);

        if (attempt < config.retries) {
          await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 250));
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`API request failed for ${url}`);
  };

  const getCachedOrFetch = async <T>(url: string): Promise<T> => {
    if (!config.allowCache) {
      const response = await fetchWithRetry(url);
      return (await response.json()) as T;
    }

    const cached = apiCache.get(url);

    const now = Date.now();

    if (cached && now - cached.timestamp < config.CACHE_TTL) {
      return cached.data as T;
    }

    const response = await fetchWithRetry(url);

    const data = (await response.json()) as T;

    apiCache.set(url, { data, timestamp: now });

    if (apiCache.size > 1000) {
      const entries = Array.from(apiCache.entries());
      entries.slice(0, 500).forEach(([key]) => apiCache.delete(key));
    }

    return data;
  };
  const buildApiUrl = (params: Record<string, string>): string => {
    const urlParams = new URLSearchParams({
      format: 'json',
      origin: '*',
      ...params,
    });

    return `${API_BASE_URL}?${urlParams}`;
  };

  //HELPERS

  const resolveVariantImageUrls = async (variants: CoverVariant[]): Promise<CoverVariant[]> => {
    const fileNames = variants.map((v) => v.imageUrl).filter(Boolean) as string[];
    const urlMap = await getFileUrls(fileNames);
    return variants.map((v) => ({
      ...v,
      imageUrl: v.imageUrl ? urlMap.get(v.imageUrl) : undefined,
    }));
  };

  const scaleUrl = (url: string, width?: number): string => {
    if (!url) return url;
    if (width == null) {
      return url.replace(/\/scale-to-width-down\/\d+/, '');
    }
    if (/\/scale-to-width-down\/\d+/.test(url)) {
      return url.replace(/\/scale-to-width-down\/\d+/, `/scale-to-width-down/${width}`);
    }
    const [f1, f2] = url.split('/revision/latest');
    if (!f2) return url;
    return `${f1}/revision/latest/scale-to-width-down/${width}${f2}`;
  };

  const parseMediaWikiTemplate = (pageContent: string): Record<string, string> => {
    const result: Record<string, string> = {};
    //match the first multi-line template (name has no |, {, } or newlines, followed by \n)
    //this skips inline one-liners like {{DISPLAYTITLE:...}} or {{TOC}} that precede the infobox
    const headerMatch = pageContent.match(/\{\{[^|{}\n]+\n/);
    if (!headerMatch) return result;
    const start = headerMatch.index!;
    //depth-track to find the real closing }}
    let depth = 0;
    let end = -1;
    for (let i = start; i < pageContent.length - 1; i++) {
      if (pageContent[i] === '{' && pageContent[i + 1] === '{') {
        depth++;
        i++;
      } else if (pageContent[i] === '}' && pageContent[i + 1] === '}') {
        if (--depth === 0) {
          end = i;
          break;
        }
        i++;
      }
    }
    if (end === -1) return result;
    const inner = pageContent.slice(start + 2, end);
    const parts = inner.split(/\n\|/);
    for (let i = 1; i < parts.length; i++) {
      const eqIdx = parts[i]!.indexOf('=');
      if (eqIdx === -1) continue;
      const key = parts[i]!.slice(0, eqIdx).trim();
      const value = parts[i]!.slice(eqIdx + 1).trim();
      if (key) result[key] = value;
    }
    return result;
  };

  //GETTERS

  const getImages = (page: WikiSearchGeneratorPageItem) => {
    return async (width?: number) => {
      let urlParams: Record<string, string> = {
        action: 'query',
        generator: 'images',
        pageids: page.pageid.toString(),
        prop: 'imageinfo',
        iiprop: 'url',
        gimlimit: 'max',
      };

      let data = await getCachedOrFetch<WikiQueryImagesResponse>(buildApiUrl(urlParams));
      const pages = { ...data.query.pages };

      while (data.continue !== undefined) {
        urlParams = {
          ...urlParams,
          gimcontinue: data.continue.gimcontinue,
          continue: data.continue.continue,
        };
        data = await getCachedOrFetch<WikiQueryImagesResponse>(buildApiUrl(urlParams));
        Object.assign(pages, data.query.pages);
      }

      return Object.keys(pages)
        .map((id) => {
          const p = pages[id];
          return p?.imageinfo?.map((item) => scaleUrl(item.url, width));
        })
        .flat()
        .filter(Boolean);
    };
  };

  const getGallery = (page: WikiSearchGeneratorPageItem) => {
    return async (width?: number) => {
      let galleryUrlParams: Record<string, string> = {
        action: 'query',
        titles: `${page.title}/Gallery`,
        prop: 'images',
        imlimit: 'max',
      };

      let galleryData = await getCachedOrFetch<WikiQueryGalleryResponse>(
        buildApiUrl(galleryUrlParams),
      );

      const fileTitles = Object.values(galleryData.query?.pages ?? {}).flatMap(
        (p) => p?.images?.map((img) => img.title) ?? [],
      );

      while (galleryData.continue !== undefined) {
        galleryUrlParams = {
          ...galleryUrlParams,
          imcontinue: galleryData.continue.imcontinue,
          continue: galleryData.continue.continue,
        };
        galleryData = await getCachedOrFetch<WikiQueryGalleryResponse>(
          buildApiUrl(galleryUrlParams),
        );
        fileTitles.push(
          ...Object.values(galleryData.query?.pages ?? {}).flatMap(
            (p) => p?.images?.map((img) => img.title) ?? [],
          ),
        );
      }

      if (fileTitles.length === 0) return [];

      const titleChunks = chunkArray(fileTitles, 50);
      const allUrls: string[] = [];

      for (const chunk of titleChunks) {
        const imageInfoUrl = buildApiUrl({
          action: 'query',
          titles: chunk.join('|'),
          prop: 'imageinfo',
          iiprop: 'url',
        });

        const imageInfoData = await getCachedOrFetch<WikiQueryImagesResponse>(imageInfoUrl);
        const infoPages = imageInfoData.query?.pages ?? {};

        const urls = Object.values(infoPages).flatMap((p) =>
          p.imageinfo.map((item) => scaleUrl(item.url, width)),
        );

        allUrls.push(...urls);
      }

      return allUrls;
    };
  };

  const getInfo = (page: WikiSearchGeneratorPageItem) => {
    return async () => {
      const url = buildApiUrl({
        action: 'parse',
        page: page.title.replace(' ', '_'),
        prop: 'properties',
      });

      const data = await getCachedOrFetch<WikiParseResponse>(url);

      const wrapper = data.parse?.properties?.find((prop) => prop.name === 'infoboxes');
      if (!wrapper?.['*']) return {};

      const infoboxCollection = JSON.parse(wrapper['*']) as WikiParseProperties[];

      const grouped = Object.groupBy(infoboxCollection[0]?.data ?? [], ({ type }) => type) as {
        group?: WikiParsePropertiesGroupType[];
        title?: WikiParsePropertiesTitleType[];
        data?: WikiParsePropertiesDataType[];
        image?: WikiParsePropertiesImageType[];
      };

      const dataBoxes = [
        ...(grouped.data ?? []),
        ...(grouped.group ?? []).map((group) => group.data.value).flat(),
      ].filter((item): item is WikiParsePropertiesDataType => item.type === 'data');

      return Object.fromEntries(
        dataBoxes.map((item) => [item.data.label, getInnerText(item.data.value)]),
      );
    };
  };

  const getThumbnail = async (pageId: number, width?: number): Promise<string> => {
    const url = buildApiUrl({
      action: 'query',
      pageids: String(pageId),
      prop: 'pageimages',
      piprop: 'thumbnail',
      pithumbsize: '400',
    });

    const data = await getCachedOrFetch<{
      batchcomplete: string;
      query: {
        pages: Record<
          string,
          {
            pageid: number;
            ns: number;
            title: string;
            thumbnail: {
              source: string;
              width: number;
              height: number;
            };
          }
        >;
      };
    }>(url);

    const pages = data.query.pages;

    return scaleUrl(Object.values(pages)[0]?.thumbnail?.source || '', width);
  };

  const getMultiplePageContents = async (
    pageIds: number[],
  ): Promise<Map<number, string | undefined>> => {
    const url = buildApiUrl({
      action: 'query',
      pageids: pageIds.join('|'),
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
    });

    const data = await getCachedOrFetch<WikiRevisionsResponse>(url);

    const result = new Map<number, string | undefined>();

    for (const [id, page] of Object.entries(data.query.pages)) {
      result.set(Number(id), page.revisions?.[0]?.slots.main['*']);
    }

    return result;
  };

  async function membersForCategory(
    categoryTitle: string,
    limit?: number,
  ): Promise<WikiCategoryMemberItem[]> {
    const returnable: WikiCategoryMemberItem[] = [];

    const nextCmlimit = () =>
      limit !== undefined ? Math.min(500, Math.max(limit - returnable.length, 0)) : 500;

    let cmlimit = nextCmlimit();
    if (limit !== undefined && cmlimit === 0) return returnable;

    let data = await getCachedOrFetch<CategoryMembersResponse>(
      buildApiUrl({
        action: 'query',
        list: 'categorymembers',
        cmtitle: categoryTitle,
        cmlimit: cmlimit.toString(),
      }),
    );

    returnable.push(...data.query.categorymembers);

    while (data.continue !== undefined && (limit === undefined || returnable.length < limit)) {
      cmlimit = nextCmlimit();
      data = await getCachedOrFetch<CategoryMembersResponse>(
        buildApiUrl({
          action: 'query',
          list: 'categorymembers',
          cmtitle: categoryTitle,
          cmlimit: cmlimit.toString(),
          cmcontinue: data.continue.cmcontinue,
          continue: data.continue.continue,
        }),
      );

      returnable.push(...data.query.categorymembers);
    }

    return limit !== undefined ? returnable.slice(0, limit) : returnable;
  }

  //BUILDERS

  const buildPage = (page: WikiSearchGeneratorPageItem): WikiPage => {
    return {
      id: page.pageid,
      title: page.title,
      thumbnail: page.thumbnail || '',
      categories: page.categories.map((c) => c.title),
      canonicalUrl: page.canonicalUrl,
      sourceWiki: wikiUrl,
      getStructuredContent: async () => {
        const pageContent = await getPageContent(page.pageid);
        return parseMediaWikiTemplate(pageContent ?? '');
      },
      getPageContent: () => getPageContent(page.pageid),
      getInfobox: getInfo(page),
      getImages: getImages(page),
      getGallery: getGallery(page),
    };
  };

  //PUBLIC INTERFACE

  async function getWikiPagesFromPages(
    pages: WikiGetPageResponse['query']['pages'][keyof WikiGetPageResponse['query']['pages']][],
    flags: WikiFlags,
    // MediaWiki caps categories at 500 total per request, shared across every page in
    // the batch. When that cap is hit (`clcontinue` present on the response this batch
    // came from), the inline `categories` on some pages here may be silently truncated
    // — re-fetch every page in the batch through the clcontinue-paginated path below to
    // guarantee complete category lists rather than risk a truncated one going undetected.
    categoriesTruncated = false,
  ): Promise<WikiPage[]> {
    const targetCategories = [...(flags.category ?? []), ...(flags.categoriesOr ?? [])];

    const idsMissingCategories =
      targetCategories.length > 0
        ? categoriesTruncated
          ? // A truncated batch may have pages with a present-but-incomplete `categories`
            // key (not just an absent one), so every page needs re-fetching, not just
            // the ones that look "missing" at a glance.
            pages.map((page) => page.pageid)
          : []
        : pages.filter((page) => !page.categories).map((page) => page.pageid);

    const fetchedCategories = await getCategoriesForPages(
      idsMissingCategories,
      targetCategories.length > 0 ? targetCategories : undefined,
    );

    let wikiPages = pages.map((page) => {
      // Prefer freshly re-fetched categories (guaranteed complete) over whatever came
      // inline with the page — the latter is only used when it wasn't re-fetched at all.
      const categories = fetchedCategories[page.pageid]?.categories ?? page.categories ?? [];
      return buildPage({
        thumbnail: scaleUrl(page.thumbnail?.source, flags.thumbnailSize),
        canonicalUrl: page.canonicalurl,
        pageid: page.pageid,
        ns: page.ns,
        title: page.title,
        index: page.index,
        categories,
      });
    });

    if (flags.category !== undefined && flags.category.length > 0) {
      const targetCategories = flags.category;
      wikiPages = wikiPages.filter((wikipage) => {
        const categories = wikipage.categories;
        return targetCategories.every((cat) => categories.includes(cat));
      });
    }

    if (flags.categoriesOr !== undefined && flags.categoriesOr.length > 0) {
      const targetCategories = flags.categoriesOr;
      wikiPages = wikiPages.filter((wikipage) => {
        const categories = wikipage.categories;
        return targetCategories.some((cat) => categories.includes(cat));
      });
    }

    return wikiPages;
  }

  async function getPage(
    query: string,
    flags: Pick<WikiFlags, 'category' | 'categoriesOr' | 'thumbnailSize' | 'limit'> = {},
  ): Promise<WikiPage[]> {
    const targetCategories = [...(flags.category ?? []), ...(flags.categoriesOr ?? [])];
    const gsrlimit = flags.limit && flags.limit > 0 ? flags.limit : 20;

    const searchParams: Record<string, string> = {
      action: 'query',
      generator: 'search',
      gsrsearch: query,
      gsrnamespace: '0',
      gsrlimit: gsrlimit.toString(),
      prop: targetCategories.length > 0 ? 'info|pageimages|categories' : 'info|pageimages',
      inprop: 'url',
      piprop: 'thumbnail',
      pithumbsize: '200',
      ...(targetCategories.length > 0
        ? { cllimit: 'max', clcategories: targetCategories.join('|') }
        : {}),
    };

    let data = await getCachedOrFetch<WikiGetPageResponse>(buildApiUrl(searchParams));
    if (!data?.query) return [];

    const pages = Object.values(data.query.pages);
    const wikiPages = await getWikiPagesFromPages(
      pages,
      flags,
      data.continue?.clcontinue !== undefined,
    );

    if (targetCategories.length > 0) {
      let nextOffset = data.continue?.gsroffset;
      let waveSize = 4;
      let waves = 0;

      while (
        flags.limit &&
        wikiPages.length < flags.limit &&
        nextOffset !== undefined &&
        waves < 10
      ) {
        const offsets = Array.from({ length: waveSize }, (_, i) => nextOffset! + i * gsrlimit);

        const results = await Promise.all(
          offsets.map((offset) =>
            getCachedOrFetch<WikiGetPageResponse>(
              buildApiUrl({ ...searchParams, gsroffset: String(offset) }),
            ),
          ),
        );

        nextOffset = undefined;
        for (const res of results) {
          if (!res?.query) break;
          wikiPages.push(
            ...(await getWikiPagesFromPages(
              Object.values(res.query.pages),
              flags,
              res.continue?.clcontinue !== undefined,
            )),
          );
          if (res.continue?.gsroffset === undefined) break;
          nextOffset = res.continue.gsroffset;
        }

        waveSize = Math.min(waveSize * 2, 16);
        waves++;
      }
    } else {
      while (flags.limit && wikiPages.length < flags.limit && data.continue !== undefined) {
        data = await getCachedOrFetch<WikiGetPageResponse>(
          buildApiUrl({
            ...searchParams,
            gsroffset: String(data.continue.gsroffset),
            continue: data.continue.continue,
          }),
        );

        if (!data?.query) break;

        const npages = Object.values(data.query.pages);
        const nwikipages = await getWikiPagesFromPages(npages, flags);

        wikiPages.push(...nwikipages);
      }
    }

    if (flags.limit && wikiPages.length > flags.limit) wikiPages.length = flags.limit;
    return wikiPages;
  }

  async function getPageById(
    pageId: number,
    flags?: Pick<WikiFlags, 'thumbnailSize'>,
  ): Promise<WikiPage | null>;
  async function getPageById(
    pageId: number[],
    flags?: Pick<WikiFlags, 'thumbnailSize'>,
  ): Promise<WikiPage[]>;
  async function getPageById(
    pageId: number | number[],
    flags: Pick<WikiFlags, 'thumbnailSize'> = {},
  ): Promise<WikiPage | null | WikiPage[]> {
    const ids = Array.isArray(pageId) ? pageId : [pageId];

    const fetchChunk = async (chunk: number[]): Promise<WikiPage[]> => {
      const returnable: WikiPage[] = [];

      const collect = (res: WikiSearchGeneratorResponse) => {
        returnable.push(
          ...Object.values(res.query.pages)
            .filter(isGeneratorPageItem)
            .map((page) =>
              buildPage({
                ...page,
                thumbnail: scaleUrl(
                  (page as unknown as { thumbnail?: { source: string } }).thumbnail?.source ?? '',
                  flags.thumbnailSize,
                ),
              }),
            ),
        );
      };

      let urlParams: Record<string, string> = {
        action: 'query',
        pageids: chunk.join('|'),
        prop: 'pageimages|categories',
        cllimit: 'max',
        piprop: 'thumbnail',
        pithumbsize: '400',
      };

      let data = await getCachedOrFetch<WikiSearchGeneratorResponse>(buildApiUrl(urlParams));

      collect(data);

      while (data.continue !== undefined) {
        urlParams = {
          ...urlParams,
          clcontinue: data.continue.clcontinue,
          continue: data.continue.continue,
        };
        data = await getCachedOrFetch<WikiSearchGeneratorResponse>(buildApiUrl(urlParams));
        collect(data);
      }

      return returnable;
    };

    const pages = (await Promise.all(chunkArray(ids).map(fetchChunk))).flat();

    return Array.isArray(pageId) ? pages : (pages[0] ?? null);
  }

  async function getPageByTitle(
    title: string,
    flags: Pick<WikiFlags, 'category' | 'thumbnailSize'> = {},
  ): Promise<WikiPage | null> {
    let urlParams: Record<string, string> = {
      action: 'query',
      titles: title,
      prop: 'info|categories|pageimages',
      inprop: 'url',
      cllimit: 'max',
      piprop: 'thumbnail',
      pithumbsize: '400',
    };

    let data = await getCachedOrFetch<WikiSearchGeneratorResponse>(buildApiUrl(urlParams));

    const page = Object.values(data.query.pages)[0];
    if (!page || page.pageid < 0) return null;

    const categories = [...(page.categories ?? [])];

    while (data.continue !== undefined) {
      urlParams = {
        ...urlParams,
        clcontinue: data.continue.clcontinue,
        continue: data.continue.continue,
      };
      data = await getCachedOrFetch<WikiSearchGeneratorResponse>(buildApiUrl(urlParams));
      categories.push(...(Object.values(data.query.pages)[0]?.categories ?? []));
    }

    page.categories = categories;

    const targetCategories = flags.category;
    if (targetCategories?.length) {
      const targetSet = new Set(targetCategories);
      if (!(page.categories ?? []).some((cat) => targetSet.has(cat.title))) return null;
    }

    const rawPage = page as unknown as { thumbnail?: { source: string }; canonicalurl?: string };

    return buildPage({
      ...page,
      canonicalUrl: rawPage.canonicalurl ?? '',
      thumbnail: scaleUrl(rawPage.thumbnail?.source ?? '', flags.thumbnailSize),
    });
  }

  async function getPageContent(
    pageId: number,
    contentOptions: { structured: true },
  ): Promise<Record<string, string>>;
  async function getPageContent(
    pageId: number,
    contentOptions?: WikiContentOptions,
  ): Promise<string | undefined>;
  async function getPageContent(
    pageId: number,
    contentOptions: WikiContentOptions = {},
  ): Promise<string | Record<string, string> | undefined> {
    const url = buildApiUrl({
      action: 'query',
      pageids: pageId.toString(),
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
    });

    const data = await getCachedOrFetch<WikiRevisionsResponse>(url);

    const page = Object.values(data.query.pages)[0];

    if (page?.pageid.toString() === '-1') throw new Error(`Page "${pageId}" does not exist.`);

    if (contentOptions.structured === true) {
      return parseMediaWikiTemplate(page?.revisions[0]?.slots.main['*'] || '');
    }

    return page?.revisions[0]?.slots.main['*'];
  }

  async function getPagesByCategory(
    category: string,
    flags: Pick<WikiFlags, 'thumbnailSize'> = {},
  ): Promise<WikiPage[]> {
    const members = await getCategoryMembers(category);
    if (!members.length) return [];
    const canonicalUrlByPageId = new Map<number, string>();
    const thumbnailByPageId = new Map<number, string>();
    const chunks = chunkArray(members.map((m) => m.pageid));

    await Promise.all(
      chunks.map(async (chunk) => {
        const url = buildApiUrl({
          action: 'query',
          pageids: chunk.join('|'),
          prop: 'info|pageimages',
          inprop: 'url',
          piprop: 'thumbnail',
          pithumbsize: '400',
        });

        const data = await getCachedOrFetch<WikiSearchGeneratorResponse>(url);

        for (const [id, page] of Object.entries(data.query.pages)) {
          canonicalUrlByPageId.set(
            Number(id),
            (page as unknown as { canonicalurl: string }).canonicalurl ?? '',
          );
          thumbnailByPageId.set(
            Number(id),
            (page as unknown as { thumbnail?: { source: string } }).thumbnail?.source ?? '',
          );
        }
      }),
    );

    return Promise.all(
      members.map(async (member) =>
        buildPage({
          thumbnail: scaleUrl(thumbnailByPageId.get(member.pageid) ?? '', flags.thumbnailSize),
          categories: await getCategoriesFromPage(member.pageid),
          canonicalUrl: canonicalUrlByPageId.get(member.pageid) ?? '',
          pageid: member.pageid,
          ns: member.ns,
          title: member.title,
          index: 0,
        }),
      ),
    );
  }

  const mergeCategoriesAndFilter = (
    members: WikiCategoryMemberItem[],
    categoriesByPageId: Record<string, { categories: WikiPageCategory[] }>,
    requiredCategories: string[],
  ) => {
    return members
      .map((m) => ({
        ...m,
        categories: categoriesByPageId[m.pageid]?.categories ?? [],
      }))
      .filter((m) =>
        requiredCategories.every((target) => m.categories.some((c) => c.title === target)),
      );
  };

  async function getCategoryMembers(
    categoryTitle: string,
    flags?: Pick<WikiFlags, 'limit'>,
  ): Promise<WikiCategoryMemberItem[]>;
  async function getCategoryMembers(
    categoryTitle: string[],
    flags?: Pick<WikiFlags, 'limit'>,
  ): Promise<WikiCategoryMemberItem[]>;
  async function getCategoryMembers(
    categoryTitle: string | string[],
    flags: Pick<WikiFlags, 'limit'> = {},
  ): Promise<WikiCategoryMemberItem[]> {
    const titles = Array.isArray(categoryTitle) ? categoryTitle : [categoryTitle];

    const firstCategory = titles[0];
    if (!firstCategory) return [];

    if (titles.length === 1) {
      return membersForCategory(firstCategory, flags.limit);
    }

    const secondaryCategories = titles.slice(1);

    if (flags.limit === undefined) {
      const initialBatch = await membersForCategory(firstCategory);
      const initialBatchCategories = await getCategoriesForPages(
        initialBatch.map((m) => m.pageid),
        secondaryCategories,
      );

      return mergeCategoriesAndFilter(initialBatch, initialBatchCategories, secondaryCategories);
    }

    // Filtering can shrink matches below `limit`, so fetch the first category in
    // growing batches instead of capping the raw fetch, which could under-fill.
    const limit = flags.limit;
    const matches: WikiCategoryMemberItem[] = [];
    let cmcontinueParams: { cmcontinue: string; continue: string } | undefined;
    let batchSize = 25;

    while (matches.length < limit) {
      const data = await getCachedOrFetch<CategoryMembersResponse>(
        buildApiUrl({
          action: 'query',
          list: 'categorymembers',
          cmtitle: firstCategory,
          cmlimit: batchSize.toString(),
          ...(cmcontinueParams ?? {}),
        }),
      );

      const batch = data.query.categorymembers;

      if (batch.length > 0) {
        const batchCategories = await getCategoriesForPages(
          batch.map((m) => m.pageid),
          secondaryCategories,
        );
        matches.push(...mergeCategoriesAndFilter(batch, batchCategories, secondaryCategories));
      }

      if (data.continue === undefined) break;
      cmcontinueParams = { cmcontinue: data.continue.cmcontinue, continue: data.continue.continue };
      batchSize = Math.min(batchSize * 2, 500);
    }

    return matches.slice(0, limit);
  }

  async function searchCategories(query: string): Promise<string[]> {
    let urlParams: Record<string, string> = {
      action: 'query',
      list: 'search',
      srsearch: query,
      srnamespace: '14',
      srlimit: '500',
      srwhat: 'text',
    };

    let data = await getCachedOrFetch<WikiSearchResponse>(buildApiUrl(urlParams));
    const results = [...data.query.search];

    while (data.continue !== undefined) {
      urlParams = {
        ...urlParams,
        sroffset: data.continue.sroffset.toString(),
        continue: data.continue.continue,
      };
      data = await getCachedOrFetch<WikiSearchResponse>(buildApiUrl(urlParams));
      results.push(...data.query.search);
    }

    return results.map((match) => match.title);
  }

  async function getCategoriesFromPage(pageId: number): Promise<WikiPageCategory[]> {
    const result = await getCategoriesForPages([pageId]);
    return result[pageId]?.categories ?? [];
  }

  async function getCategoriesForPages(
    pageIds: number[],
    categoryFilter?: string[],
  ): Promise<Record<string, { categories: WikiPageCategory[] }>> {
    const titleChunks = chunkArray(pageIds, 50);
    const totalPages: Record<string, { categories: WikiPageCategory[] }> = {};

    await Promise.all(
      titleChunks.map(async (chunk) => {
        const baseParams: Record<string, string> = {
          action: 'query',
          pageids: chunk.join('|'),
          prop: 'categories',
          cllimit: 'max', // 500 max per request across all pages — paginate via clcontinue
          ...(categoryFilter && categoryFilter.length > 0
            ? { clcategories: categoryFilter.join('|') }
            : {}),
        };

        let data = await getCachedOrFetch<CategoriesResponse>(buildApiUrl(baseParams));

        const collect = (resp: CategoriesResponse) => {
          for (const [id, page] of Object.entries(resp.query.pages)) {
            const existing = totalPages[id]?.categories ?? [];
            totalPages[id] = { categories: existing.concat(page.categories ?? []) };
          }
        };

        collect(data);

        while (data.continue !== undefined) {
          data = await getCachedOrFetch<CategoriesResponse>(
            buildApiUrl({
              ...baseParams,
              clcontinue: data.continue.clcontinue,
              continue: data.continue.continue,
            }),
          );
          collect(data);
        }
      }),
    );

    return totalPages;
  }

  async function getFileUrls(fileNames: string[]): Promise<Map<string, string>> {
    if (!fileNames.length) return new Map();

    const titles = fileNames.map((f) => `File:${f}`).join('|');

    const url = buildApiUrl({
      action: 'query',
      titles,
      prop: 'imageinfo',
      iiprop: 'url',
    });

    const data = await getCachedOrFetch<WikiImageInfoResponse>(url);
    const result = new Map<string, string>();

    for (const page of Object.values(data.query.pages)) {
      const resolvedUrl = page.imageinfo?.[0]?.url;
      if (resolvedUrl) {
        result.set(page.title.replace(/^File:/i, ''), resolvedUrl);
      }
    }

    return result;
  }

  const getFileUrl = async (fileName: string, width?: number): Promise<string> => {
    if (!fileName) return '';
    const urlMap = await getFileUrls([fileName]);
    return scaleUrl(urlMap.get(fileName) ?? '', width);
  };

  const base: Wiki = {
    getPage,
    getPageById,
    getPageByTitle,
    getPagesByCategory,
    getPageContent,
    getCategoryMembers,
    searchCategories,
    getCategoriesFromPage,
    getThumbnailById: getThumbnail,
    getFileUrl,
    clearCache: () => apiCache.clear(),
  };

  if (pluginName) {
    return { ...base, ...PLUGINS[pluginName].factory(base) };
  }

  return base;
}
