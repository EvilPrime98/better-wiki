export const VERSION = '0.0.0';

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
    WikiPageFlags,
    WikiContentOptions,
    Wiki,
} from './types';

import {
    chunkArray,
    getInnerText,
} from './utils';

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
    Wiki
};

const DEFAULT_OPTIONS: Required<WikiOptions> = {
    CACHE_TTL: 5 * 60 * 1000,
    userAgent: 'better-wiki (https://www.npmjs.com/package/better-wiki)',
    timeout: 15_000,
    retries: 2,
    publisher: '',
    debug: false,
};

export function wiki(
    wikiUrl: string,
    options: WikiOptions = {}
): Wiki {

    //CONFIG

    const config: Required<WikiOptions> = { ...DEFAULT_OPTIONS, ...options };

    const apiCache = new Map<string, { data: unknown; timestamp: number }>();

    const API_BASE_URL: string = `${wikiUrl}/api.php`;

    const WIKI_BASE_URL: string = `${wikiUrl}/wiki`;

    const debug = (...args: unknown[]): void => {
        if (config.debug) console.error('[better-wiki]', ...args);
    };

    //HTTP

    const fetchWithRetry = async (
        url: string
    ): Promise<Response> => {

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

        throw lastError instanceof Error
            ? lastError
            : new Error(`API request failed for ${url}`);

    };

    const getCachedOrFetch = async <T>(
        url: string
    ): Promise<T> => {

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

    const buildApiUrl = (
        params: Record<string, string>
    ): string => {

        const urlParams = new URLSearchParams({
            format: 'json',
            origin: '*',
            ...params,
        });

        return `${API_BASE_URL}?${urlParams}`;

    };

    //HELPERS

    const resolveVariantImageUrls = async (
        variants: CoverVariant[]
    ): Promise<CoverVariant[]> => {
        const fileNames = variants.map((v) => v.imageUrl).filter(Boolean) as string[];
        const urlMap = await getFileUrls(fileNames);
        return variants.map((v) => ({
            ...v,
            imageUrl: v.imageUrl ? urlMap.get(v.imageUrl) : undefined,
        }));
    };

    const scaleUrl = (
        url: string,
        width?: number
    ): string => {
        if (!width) return url;
        const [f1, f2] = url.split('/revision/latest');
        return `${f1}/revision/latest/scale-to-width-down/${width}${f2}`;
    };

    const parseMediaWikiTemplate = (
        pageContent: string
    ): Record<string, string> => {
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
            if (pageContent[i] === '{' && pageContent[i + 1] === '{') { depth++; i++; }
            else if (pageContent[i] === '}' && pageContent[i + 1] === '}') {
                if (--depth === 0) { end = i; break; }
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
    }

    //GETTERS

    const getImages = (
        page: WikiSearchGeneratorPageItem
    ) => {

        return async (width?: number) => {

            const url = buildApiUrl({
                action: 'query',
                generator: 'images',
                pageids: page.pageid.toString(),
                prop: 'imageinfo',
                iiprop: 'url',
                gimlimit: 'max',
            });

            const data = await getCachedOrFetch<WikiQueryImagesResponse>(url);
            const pages = data.query.pages;

            return Object.keys(pages)
            .map((id) => {
                const p = pages[id];
                return p?.imageinfo?.map((item) => scaleUrl(item.url, width));
            }).flat()
            .filter(Boolean);

        }

    };

    const getGallery = (
        page: WikiSearchGeneratorPageItem
    ) => {

        return async (width?: number) => {

            const galleryUrl = buildApiUrl({
                action: 'query',
                titles: `${page.title}/Gallery`,
                prop: 'images',
                imlimit: 'max',
            });

            const galleryData = await getCachedOrFetch<WikiQueryGalleryResponse>(galleryUrl);

            const pages = galleryData.query?.pages ?? {};

            const fileTitles = Object.values(pages).flatMap(
                (p) => p?.images?.map((img) => img.title) ?? [],
            );

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

    }

    const getInfo = (
        page: WikiSearchGeneratorPageItem
    ) => {

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

    }

    //IMPLEMENTATIONS - TODO DELETE

    // const getCoverImage = async (
    //     pageIdentifier: string | number
    // ) => {
    //     const url = buildApiUrl({
    //         action: 'query',
    //         pageids: String(pageIdentifier),
    //         prop: 'pageimages',
    //         piprop: 'original',
    //     });
    //     const data = await getCachedOrFetch<WikiPageImagesResponse>(url);
    //     return data.query.pages;
    // };

    // const getMultiplePageContents = async (
    //     pageIds: number[],
    // ): Promise<Map<number, string | undefined>> => {

    //     const url = buildApiUrl({
    //         action: 'query',
    //         pageids: pageIds.join('|'),
    //         prop: 'revisions',
    //         rvprop: 'content',
    //         rvslots: 'main',
    //     });

    //     const data = await getCachedOrFetch<WikiRevisionsResponse>(url);

    //     const result = new Map<number, string | undefined>();

    //     for (const [id, page] of Object.entries(data.query.pages)) {
    //         result.set(Number(id), page.revisions?.[0]?.slots.main['*']);
    //     }

    //     return result;

    // };

    // const getCredits = async ({
    //     pageId,
    //     pageContent,
    // }: {
    //     pageId?: number;
    //     pageContent?: string | undefined;
    // }): Promise<ComicCredits> => {

    //     if (!pageContent) {
    //         if (!pageId) throw new Error('No pageId provided.');
    //         pageContent = await getPageContent(pageId);
    //     }

    //     return parseCredits(pageContent);

    // };

    // const getComicMetadata = async ({
    //     pageId,
    //     pageContent,
    // }: {
    //     pageId?: number;
    //     pageContent?: string | undefined;
    // }): Promise<{ volume: string; issue: string }> => {

    //     if (!pageContent) {
    //         if (!pageId) throw new Error('No pageId provided.');
    //         pageContent = await getPageContent(pageId);
    //     }

    //     return parseComicMetadata(pageContent);

    // };

    // const getSynopsis = async ({
    //     pageId,
    //     pageContent,
    // }: {
    //     pageId?: number;
    //     pageContent?: string | undefined;
    // }): Promise<string> => {

    //     if (!pageContent) {
    //         if (!pageId) throw new Error('No pageId provided.');
    //         pageContent = await getPageContent(pageId);
    //     }

    //     return parseSynopsis(pageContent);

    // };

    // const getComicInfo = async (query: string): Promise<ComicInfo> => {

    //     const normalizedQuery = normalizeQueryString(query);

    //     const year = extractYear(query);

    //     const url = buildApiUrl({
    //         action: 'query',
    //         list: 'search',
    //         srsearch: normalizedQuery,
    //         srnamespace: '0',
    //         srlimit: '10',
    //         srwhat: 'text',
    //     });

    //     const data = await getCachedOrFetch<WikiSearchResponse>(url);

    //     const results = data.query.search;

    //     if (!results || results.length === 0) {
    //         return {
    //             error: true,
    //             message: `No comics found for query: ${query}`,
    //         };
    //     }

    //     const allContents = await getMultiplePageContents(results.map((r) => r.pageid));

    //     const rawResultsData = results.map((r) => {
    //         const pageContent = allContents.get(r.pageid);
    //         const titleTokens = r.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase().split(' ');
    //         const keyDivIndex = titleTokens.findIndex((token) => token.includes('vol'));
    //         const volume = titleTokens[keyDivIndex + 1];
    //         const issue = Number(titleTokens[keyDivIndex + 2]);
    //         const releaseDate = parseReleaseDate(pageContent);
    //         return {
    //             pageid: r.pageid,
    //             title: r.title,
    //             releaseDate,
    //             content: pageContent,
    //             volume,
    //             issue,
    //         };
    //     });

    //     const releaseDateByPageId = new Map(rawResultsData.map((r) => [r.pageid, r.releaseDate]));

    //     const contentByPageId = new Map(rawResultsData.map((r) => [r.pageid, r.content]));

    //     let best = results[0]!;

    //     if (!year) {

    //         const withDates = results
    //             .map((r) => ({
    //                 result: r,
    //                 releaseDate: {
    //                     releaseYear: releaseDateByPageId.get(r.pageid)?.releaseYear ?? '0',
    //                     releaseMonth: releaseDateByPageId.get(r.pageid)?.releaseMonth ?? '0',
    //                     releaseDay: releaseDateByPageId.get(r.pageid)?.releaseDay ?? '0',
    //                 },
    //             }))
    //             .sort((a, b) => {
    //                 const r1 = parseInt(b.releaseDate.releaseYear) - parseInt(a.releaseDate.releaseYear);
    //                 if (r1 !== 0) return r1;
    //                 const r2 = parseInt(b.releaseDate.releaseMonth) - parseInt(a.releaseDate.releaseMonth);
    //                 if (r2 !== 0) return r2;
    //                 const r3 = parseInt(b.releaseDate.releaseDay) - parseInt(a.releaseDate.releaseDay);
    //                 if (r3 !== 0) return r3;
    //                 return a.result.title.localeCompare(b.result.title);
    //             });

    //         best = withDates[0]!.result;

    //     } else {

    //         const queryNumber = normalizedQuery.match(/(\d+)$/)?.[1];

    //         const withMeta = results.map((r) => ({
    //             result: r,
    //             yearMatches: releaseDateByPageId.get(r.pageid)?.releaseYear === year,
    //             numberMatches: queryNumber ? normalizeQueryString(r.title).endsWith(queryNumber) : false,
    //         }));

    //         const exactMatch = withMeta.find((r) => r.numberMatches && r.yearMatches);
    //         const numberMatch = withMeta.find((r) => r.numberMatches);
    //         const yearMatch = withMeta.find((r) => r.yearMatches);

    //         best = (exactMatch ?? numberMatch ?? yearMatch ?? withMeta[0]!).result;

    //     }

    //     const bestData = rawResultsData.find((r) => r.pageid === best.pageid);
    //     const bestPageContent = contentByPageId.get(best.pageid);
    //     const extras = getComicExtras(bestPageContent || '');
    //     const appearing = getAppearing(bestPageContent || '');
    //     const [covers, credits, synopsis, metadata] = await Promise.all([
    //         getCoverImage(best.pageid),
    //         getCredits({ pageContent: bestPageContent }),
    //         getSynopsis({ pageContent: bestPageContent }),
    //         getComicMetadata({ pageContent: bestPageContent }),
    //     ]);

    //     const coverVariants = extras?.coverVariants?.length ? await resolveVariantImageUrls(extras.coverVariants) : undefined;

    //     return {
    //         error: false,
    //         message: 'OK',
    //         title: best.title,
    //         releaseDate: bestData?.releaseDate ?? undefined,
    //         volume: metadata.volume,
    //         issue: metadata.issue,
    //         cover: removeCoverRevision(covers[best.pageid]?.original?.source ?? null),
    //         pageId: best.pageid,
    //         credits: credits ?? undefined,
    //         synopsis,
    //         rating: extras?.rating || undefined,
    //         event: extras?.event || undefined,
    //         storyTitles: extras?.storyTitles?.length ? extras.storyTitles : undefined,
    //         appearing: appearing ?? undefined,
    //         quotation: {
    //             quote: extras?.quotation || undefined,
    //             speaker: extras?.speaker || undefined,
    //         },
    //         coverVariants,
    //         notes: extras?.notes.length ? extras.notes : undefined,
    //         trivia: extras?.trivia.length ? extras.trivia : undefined,
    //     };
    // };

    // const getComicExact = async (
    //     title: string,
    //     volume: string,
    //     issue: string,
    // ): Promise<ComicInfo> => {

    //     const pageTitle = buildComicPageTitle(title, volume, issue);

    //     const url = buildApiUrl({
    //         action: 'query',
    //         titles: pageTitle,
    //         prop: 'pageimages|revisions',
    //         piprop: 'original',
    //         rvprop: 'content',
    //         rvslots: 'main',
    //     });

    //     const data = await getCachedOrFetch<ExactPageResponse>(url);
    //     const pages = data.query.pages;
    //     const pageKey = Object.keys(pages)[0]!;

    //     if (pageKey === '-1') {
    //         return {
    //             error: true,
    //             message: `No comic found for: ${pageTitle}`,
    //         };
    //     }

    //     const page = pages[pageKey]!;
    //     const pageContent = page.revisions?.[0]?.slots.main['*'];
    //     const extras = getComicExtras(pageContent || '');
    //     const appearing = getAppearing(pageContent || '');
    //     const releaseDate = parseReleaseDate(pageContent);
    //     const credits = parseCredits(pageContent);
    //     const metadata = parseComicMetadata(pageContent);
    //     const synopsis = parseSynopsis(pageContent);

    //     const coverVariants = extras?.coverVariants?.length ? await resolveVariantImageUrls(extras.coverVariants) : undefined;

    //     return {
    //         error: false,
    //         message: 'OK',
    //         title: page.title,
    //         releaseDate: releaseDate ?? undefined,
    //         volume: metadata.volume,
    //         issue: metadata.issue,
    //         cover: removeCoverRevision(page.original?.source ?? null),
    //         pageId: page.pageid,
    //         credits: credits ?? undefined,
    //         synopsis,
    //         rating: extras?.rating || undefined,
    //         event: extras?.event || undefined,
    //         storyTitles: extras?.storyTitles?.length ? extras.storyTitles : undefined,
    //         appearing: appearing ?? undefined,
    //         quotation: {
    //             speaker: extras?.speaker || undefined,
    //             quote: extras?.quotation || undefined,
    //         },
    //         coverVariants,
    //         notes: extras?.notes.length ? extras.notes : undefined,
    //         trivia: extras?.trivia.length ? extras.trivia : undefined,
    //     };

    // };

    // const getSeries = async (
    //     prefix: string,
    // ): Promise<{
    //     error: boolean;
    //     message: string;
    //     comics?: Comic[];
    //     seriesData?: SeriesData;
    // }> => {

    //     const normalizedPrefix = normalizeTitle(prefix);

    //     const url = buildApiUrl({
    //         action: 'query',
    //         list: 'allpages',
    //         apprefix: normalizedPrefix,
    //         aplimit: '500',
    //     });

    //     const data = await getCachedOrFetch<WikiAllPagesResponse>(url);
    //     const sortedPages = data.query.allpages.sort((a, b) => a.pageid - b.pageid);
    //     const pageChunks = chunkArray(sortedPages);
    //     const chunkOffsets = pageChunks.reduce<number[]>((acc, _chunk, i) => {
    //         acc.push(i === 0 ? 0 : acc[i - 1]! + pageChunks[i - 1]!.length);
    //         return acc;
    //     }, []);

    //     const resolvedChunks = await Promise.all(
    //         pageChunks.map(async (chunk, chunkIndex) => {
    //             const [coverImages, pageContents] = await Promise.all([
    //                 getCoverImage(chunk.map((p) => p.pageid).join('|')),
    //                 getMultiplePageContents(chunk.map((p) => p.pageid)),
    //             ]);

    //             if (!coverImages) {
    //                 throw new Error('Error fetching cover images.');
    //             }

    //             return chunk.map((page, indexInChunk) => {
    //                 const titleTokens = page.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase().split(' ');

    //                 const volIndex = titleTokens.findIndex((token) => token.includes('vol'));
    //                 if (volIndex === -1) {
    //                     debug(`Could not parse vol from title: "${page.title}"`);
    //                     return;
    //                 }

    //                 const seriesVolume = titleTokens[volIndex + 1];
    //                 const titleName = capitalize(titleTokens.slice(0, volIndex).join(' '));
    //                 const titleIssue = Number(titleTokens[volIndex + 2]);

    //                 if (isNaN(titleIssue)) {
    //                     debug(`Could not parse issue number from title: "${page.title}"`);
    //                     return;
    //                 }

    //                 const releaseDate = parseReleaseDate(pageContents.get(page.pageid));

    //                 return {
    //                     comic: {
    //                         title: `${titleName} #${titleIssue}`,
    //                         link: `${WIKI_BASE_URL}/${normalizeTitle(page.title, false)}`,
    //                         index: chunkOffsets[chunkIndex]! + indexInChunk,
    //                         cover: removeCoverRevision(coverImages[page.pageid]?.original?.source ?? null),
    //                         releaseDate: `${releaseDate.releaseMonth}-${releaseDate.releaseDay}-${releaseDate.releaseYear}`,
    //                     } satisfies Comic,
    //                     seriesVolume,
    //                     releaseYear: Number(releaseDate.releaseYear),
    //                 };
    //             });
    //         }),
    //     );

    //     const flat = resolvedChunks.flat();
    //     const definedFlat = flat.filter((r): r is NonNullable<typeof r> => r !== undefined);
    //     const comics = definedFlat.map((r) => r.comic);
    //     const releaseYears = [...new Set(definedFlat.map((r) => r.releaseYear))].sort((a, b) => a - b);
    //     const seriesVolume = definedFlat[0]?.seriesVolume;

    //     return {
    //         error: false,
    //         message: 'OK',
    //         comics: comics.sort((a, b) => a.index - b.index),
    //         seriesData: {
    //             name: (normalizedPrefix.replaceAll('_', ' ').split('Vol')[0] ?? '').trim(),
    //             publisher: config.publisher,
    //             seriesVolume: seriesVolume ?? null,
    //             dates:
    //                 releaseYears.length > 0
    //                     ? `${releaseYears[0]}-${releaseYears[releaseYears.length - 1]}`
    //                     : 'unknown',
    //             refName: '',
    //             wikiRef: `${WIKI_BASE_URL}/${normalizedPrefix}`,
    //             searchUrl: url,
    //             totalFound: comics.length,
    //         },
    //     };
    // };

    // const getComic = async ({
    //     query,
    //     title,
    //     volume,
    //     issue,
    // }: {
    //     query?: string;
    //     title?: string;
    //     volume?: string;
    //     issue?: string;
    // }) => {
    //     if (query) return await getComicInfo(query);
    //     if (title && volume && issue) return await getComicExact(title, volume, issue);
    //     return null;
    // };

    // const getCharacterAppearances = async ({
    //     query,
    // }: {
    //     query: string;
    // }): Promise<{
    //     error: boolean;
    //     message: string;
    //     match?: string | undefined;
    //     appearances?: CharacterAppearance[];
    // }> => {

    //     const allCategories = await searchCategories(query);
    //     const match = allCategories.filter((t) => t.toLowerCase().includes('appearances'));

    //     if (!match.length) throw new Error('No category matches the search.');

    //     const url = buildApiUrl({
    //         action: 'query',
    //         list: 'categorymembers',
    //         cmtitle: match[0]!,
    //         cmlimit: '500',
    //     });

    //     const data = await getCachedOrFetch<WikiCategoryMembersResponse>(url);
    //     const members = data.query.categorymembers;
    //     const membersChunks = chunkArray(members);
    //     const appearances = [] as Appearance[];

    //     for (const chunk of membersChunks) {
    //         const pageIds = chunk.map((comic) => comic.pageid).join('|');

    //         const [pagesWithUrls, pagesCovers, pageContents] = await Promise.all([
    //             getPageUrls(pageIds),
    //             getCoverImage(pageIds),
    //             getMultiplePageContents(chunk.map((c) => c.pageid)),
    //         ]);

    //         if (!pagesWithUrls || !pagesCovers) {
    //             throw new Error('Error fetching page information.');
    //         }

    //         const appearancesChunk = chunk.map((comic, index) => ({
    //             pageId: comic.pageid,
    //             title: comic.title,
    //             url: pagesWithUrls?.[comic.pageid]?.fullurl,
    //             link: `${WIKI_BASE_URL}/${normalizeTitle(comic.title, false)}`,
    //             index,
    //             cover: removeCoverRevision(pagesCovers[comic.pageid]?.original?.source ?? null),
    //             releaseDate: parseReleaseDate(pageContents.get(comic.pageid)),
    //         })) as Appearance[];

    //         appearances.push(...appearancesChunk);
    //     }

    //     return {
    //         error: false,
    //         message: 'OK',
    //         match: match[0],
    //         appearances: sortAppearances(normalizeDates(appearances)),
    //     };

    // };

    // const getPageUrls = async (
    //     pageIds: string,
    // ): Promise<WikiPageInfoResponse['query']['pages'] | null> => {

    //     const url = buildApiUrl({
    //         action: 'query',
    //         pageids: pageIds,
    //         prop: 'info',
    //         inprop: 'url',
    //         cmlimit: '500',
    //     });

    //     const data = await getCachedOrFetch<WikiPageInfoResponse>(url);

    //     return data.query.pages;

    // };

    //BUILDERS

    const buildPage = (
        page: WikiSearchGeneratorPageItem
    ): WikiPage => {
        return {
            id: page.pageid,
            title: page.title,
            categories: page.categories.map(c => c.title),
            canonicalUrl: page.canonicalUrl,
            getStructuredContent: async () => {
                const pageContent = await getPageContent(page.pageid);
                return parseMediaWikiTemplate(pageContent ?? '')
            },
            getPageContent: () => getPageContent(page.pageid),
            getInfobox: getInfo(page),
            getImages: getImages(page),
            getGallery: getGallery(page),
        };
    };

    //PUBLIC INTERFACE

    const getPage = async (
        query: string,
        flags: WikiPageFlags = {}
    ): Promise<WikiPage[]> => {

        const url = buildApiUrl({
            action: 'query',
            generator: 'search',
            gsrsearch: query,
            gsrnamespace: '0',
            gsrlimit: '50',
            prop: 'info',
            inprop: 'url'
        });

        const data = await getCachedOrFetch<{
            batchcomplete: string;
            continue: { gsroffset: number; continue: string };
            warnings?: { query: { '*': string } };
            query: {
                pages: Record<string, {
                    pageid: number;
                    ns: number;
                    title: string;
                    index: number;
                    contentmodel: string,
                    pagelanguage: string,
                    pagelanguagehtmlcode: string,
                    pagelanguagedir: string,
                    touched: string,
                    lastrevid: number,
                    length: number,
                    fullurl: string,
                    editurl: string,
                    canonicalurl: string
                }>;
            }
        }>(url);

        const pages = data.query.pages;

        const wikiPages = await Promise.all(
            Object.values(pages).map(async (page) => {
                const pageWithCateg = {
                    ...page,
                    categories: await getCategoriesFromPage(page.pageid)
                };
                const builtPage = buildPage({
                    canonicalUrl: pageWithCateg.canonicalurl,
                    pageid: pageWithCateg.pageid,
                    ns: pageWithCateg.ns,
                    title: pageWithCateg.title,
                    index: pageWithCateg.index,
                    categories: pageWithCateg.categories
                });
                return builtPage
            })
        );

        if (flags.category !== undefined
            && flags.category.length > 0
        ) {
            const targetCategories = flags.category;
            return wikiPages.filter(wikipage => {
                const categories = wikipage.categories;
                return targetCategories.every(cat => categories.includes(cat));
            });
        }

        return wikiPages;

    };

    const getPageById = async (
        pageId: number,
        flags: WikiPageFlags = {}
    ): Promise<WikiPage | null> => {

        const url = buildApiUrl({
            action: 'query',
            pageids: String(pageId),
            prop: 'pageimages|categories',
            cllimit: 'max',
        });

        const data = await getCachedOrFetch<WikiSearchGeneratorResponse>(url);

        const page = data.query.pages[String(pageId)];
        if (!page) return null;

        const targetCategories = flags.category;
        if (targetCategories?.length) {
            const targetSet = new Set(targetCategories);
            if (!(page.categories ?? []).some((cat) => targetSet.has(cat.title))) return null;
        }

        return buildPage(page);

    };

    const getPageByTitle = async (
        title: string,
        flags: WikiPageFlags = {}
    ): Promise<WikiPage | null> => {

        const url = buildApiUrl({
            action: 'query',
            titles: title,
            prop: 'info|categories',
            inprop: 'url',
            cllimit: 'max',
        });

        const data = await getCachedOrFetch<WikiSearchGeneratorResponse>(url);

        const page = Object.values(data.query.pages)[0];
        if (!page || page.pageid < 0) return null;

        const targetCategories = flags.category;
        if (targetCategories?.length) {
            const targetSet = new Set(targetCategories);
            if (!(page.categories ?? []).some((cat) => targetSet.has(cat.title))) return null;
        }

        return buildPage(page);

    };

    async function getPageContent(pageId: number, contentOptions: { structured: true }): Promise<Record<string, string>>;
    async function getPageContent(pageId: number, contentOptions?: WikiContentOptions): Promise<string | undefined>;
    async function getPageContent(pageId: number, contentOptions: WikiContentOptions = {}): Promise<string | Record<string, string> | undefined> {

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

    const getPagesByCategory = async (
        category: string
    ): Promise<WikiPage[]> => {

        const members = await getCategoryMembers(category);
        if (!members.length) return [];

        const categoriesByPageId = new Map<number, { ns: number; title: string }[]>();
        const canonicalUrlByPageId = new Map<number, string>();

        for (const chunk of chunkArray(members.map((m) => m.pageid))) {
            const url = buildApiUrl({
                action: 'query',
                pageids: chunk.join('|'),
                prop: 'info|categories',
                inprop: 'url',
                cllimit: 'max',
            });
            const data = await getCachedOrFetch<WikiSearchGeneratorResponse>(url);
            for (const [id, page] of Object.entries(data.query.pages)) {
                categoriesByPageId.set(Number(id), page.categories ?? []);
                canonicalUrlByPageId.set(Number(id), (page as unknown as { canonicalurl: string }).canonicalurl ?? '');
            }
        }

        return members.map((member) =>
            buildPage({
                categories: categoriesByPageId.get(member.pageid) ?? [],
                canonicalUrl: canonicalUrlByPageId.get(member.pageid) ?? '',
                pageid: member.pageid,
                ns: member.ns,
                title: member.title,
                index: 0,
            })
        )

    };

    const getCategoryMembers = async (
        categoryTitle: string
    ): Promise<Array<{
        pageid: number;
        ns: number;
        title: string
    }>> => {

        const url = buildApiUrl({
            action: 'query',
            list: 'categorymembers',
            cmtitle: categoryTitle,
            cmlimit: '500',
        });

        const data = await getCachedOrFetch<{
            query: {
                categorymembers: Array<{
                    pageid: number;
                    ns: number;
                    title: string;
                }>;
            };
        }>(url);

        return data.query.categorymembers;

    };

    const searchCategories = async (
        query: string
    ): Promise<string[]> => {

        const url = buildApiUrl({
            action: 'query',
            list: 'search',
            srsearch: query,
            srnamespace: '14',
            srlimit: '500',
            srwhat: 'text',
        });

        const data = await getCachedOrFetch<WikiSearchResponse>(url);
        return data.query.search.map((match) => match.title);

    };

    const getCategoriesFromPage = async (
        pageId: number
    ): Promise<{ ns: number; title: string }[]> => {

        const url = buildApiUrl({
            action: 'query',
            pageids: pageId.toString(),
            prop: 'categories',
            cllimit: 'max'
        })

        const data = await getCachedOrFetch<{
            batchcomplete: string;
            query: {
                pages: Record<string, {
                    pageid: number;
                    ns: number;
                    title: string;
                    categories: { ns: number; title: string }[]
                }>;
            }
            limits: { categories: number }
        }>(url);

        return Object
            .values(data.query.pages)
            .map(p => p.categories)
            .flat()

    }

    const getFileUrls = async (
        fileNames: string[]
    ): Promise<Map<string, string>> => {

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

    };

    return {
        getPage,
        getPageById,
        getPageByTitle,
        getPagesByCategory,
        getPageContent,
        getCategoryMembers,
        searchCategories,
        getCategoriesFromPage,
        clearCache: () => apiCache.clear(),
    };

}
