import {
    Chapter,
    ChapterDetails,
    ContentRating,
    HomeSection,
    HomeSectionType,
    PagedResults,
    Request,
    Response,
    SearchRequest,
    Source,
    SourceInfo,
    SourceIntents,
    SourceManga
} from '@paperback/types'
import * as cheerio from 'cheerio'
import { CHIBI_MANGA_DOMAIN } from './ChibiMangaHelper'
import { ChibiMangaParser } from './ChibiMangaParser'

// Ensure App.createCheerioAPI is always available if anything calls it
if (typeof App !== 'undefined' && !App.createCheerioAPI) {
    App.createCheerioAPI = (html: string) => cheerio.load(html)
}

export const ChibiMangaInfo: SourceInfo = {
    version: '1.0.0',
    name: 'Chibi-Manga',
    icon: 'icon.png',
    author: 'Paperback Community',
    authorWebsite: 'https://github.com/MrHackPCs',
    description: 'Extension that pulls manga from chibi-manga.com (Thai translation)',
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: CHIBI_MANGA_DOMAIN,
    sourceIntents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.MANGA_SEARCH | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED
}

export class ChibiManga extends Source {
    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 20000
    })

    override getMangaShareUrl(mangaId: string): string {
        return `${CHIBI_MANGA_DOMAIN}/manga/${mangaId}/`
    }

    /**
     * Cloudflare Bypass Request
     */
    getCloudflareBypassRequest(): Request {
        return App.createRequest({
            url: CHIBI_MANGA_DOMAIN,
            method: 'GET',
            headers: {
                referer: `${CHIBI_MANGA_DOMAIN}/`,
                'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
            }
        })
    }

    async getCloudflareBypassRequestAsync(): Promise<Request> {
        return this.getCloudflareBypassRequest()
    }

    /**
     * Fetches metadata and details for a manga title
     */
    override async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request: Request = App.createRequest({
            url: `${CHIBI_MANGA_DOMAIN}/manga/${mangaId}/`,
            method: 'GET'
        })

        const response: Response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data)

        return ChibiMangaParser.parseMangaDetails($, mangaId)
    }

    /**
     * Fetches all chapters available for a manga title
     */
    override async getChapters(mangaId: string): Promise<Chapter[]> {
        const request: Request = App.createRequest({
            url: `${CHIBI_MANGA_DOMAIN}/manga/${mangaId}/`,
            method: 'GET'
        })

        const response: Response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data)

        return ChibiMangaParser.parseChapterList($, mangaId)
    }

    /**
     * Fetches page images for a chapter
     */
    override async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const cleanChapterId = chapterId.replace(/^\/+|\/+$/g, '')
        const encodedChapter = encodeURI(decodeURI(cleanChapterId))

        let request: Request = App.createRequest({
            url: `${CHIBI_MANGA_DOMAIN}/${encodedChapter}/`,
            method: 'GET'
        })

        let response: Response
        try {
            response = await this.requestManager.schedule(request, 1)
        } catch (err) {
            // Fallback: try with mangaId prefix if needed
            request = App.createRequest({
                url: `${CHIBI_MANGA_DOMAIN}/${cleanChapterId}/`,
                method: 'GET'
            })
            response = await this.requestManager.schedule(request, 1)
        }

        const html = response.data
        const $ = cheerio.load(html)

        return ChibiMangaParser.parseChapterDetails(html, mangaId, chapterId, $)
    }

    /**
     * Generates sections shown on the Paperback home discovery screen
     */
    override async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // 1. Popular Section
        const popularSection = App.createHomeSection({
            id: 'popular',
            title: 'อันดับยอดนิยม (Popular)',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal
        })

        // 2. Latest Updates Section
        const latestSection = App.createHomeSection({
            id: 'latest',
            title: 'มังงะอัพเดทล่าสุด (Latest Updates)',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal
        })

        // 3. Manhwa Section
        const manhwaSection = App.createHomeSection({
            id: 'manhwa',
            title: 'มังงะเกาหลี (Manhwa)',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal
        })

        // 4. All Manga Section
        const allMangaSection = App.createHomeSection({
            id: 'all',
            title: 'มังงะทั้งหมด (All Manga)',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal
        })

        sectionCallback(popularSection)
        sectionCallback(latestSection)
        sectionCallback(manhwaSection)
        sectionCallback(allMangaSection)

        try {
            // 1. Fetch Popular items
            try {
                const popReq: Request = App.createRequest({
                    url: `${CHIBI_MANGA_DOMAIN}/manga/?order=popular`,
                    method: 'GET'
                })
                const popRes: Response = await this.requestManager.schedule(popReq, 1)
                const pop$ = cheerio.load(popRes.data)
                const popTiles = ChibiMangaParser.parseMangaTiles(pop$)
                if (popTiles.length > 0) {
                    popularSection.items = popTiles
                    sectionCallback(popularSection)
                }
            } catch (e) {
                console.log('Error parsing popular section:', e)
            }

            // 2. Fetch Latest items
            try {
                const latestReq: Request = App.createRequest({
                    url: `${CHIBI_MANGA_DOMAIN}/manga/?order=update`,
                    method: 'GET'
                })
                const latestRes: Response = await this.requestManager.schedule(latestReq, 1)
                const latest$ = cheerio.load(latestRes.data)
                const latestTiles = ChibiMangaParser.parseMangaTiles(latest$)
                if (latestTiles.length > 0) {
                    latestSection.items = latestTiles
                    sectionCallback(latestSection)
                }
            } catch (e) {
                console.log('Error parsing latest section:', e)
            }

            // 3. Fetch Manhwa items
            try {
                const manhwaReq: Request = App.createRequest({
                    url: `${CHIBI_MANGA_DOMAIN}/genres/manhwa/`,
                    method: 'GET'
                })
                const manhwaRes: Response = await this.requestManager.schedule(manhwaReq, 1)
                const manhwa$ = cheerio.load(manhwaRes.data)
                const manhwaTiles = ChibiMangaParser.parseMangaTiles(manhwa$)
                if (manhwaTiles.length > 0) {
                    manhwaSection.items = manhwaTiles
                    sectionCallback(manhwaSection)
                }
            } catch (e) {
                console.log('Error parsing manhwa section:', e)
            }

            // 4. Fetch All Manga (A-Z)
            try {
                const allReq: Request = App.createRequest({
                    url: `${CHIBI_MANGA_DOMAIN}/manga/?order=title`,
                    method: 'GET'
                })
                const allRes: Response = await this.requestManager.schedule(allReq, 1)
                const all$ = cheerio.load(allRes.data)
                const allTiles = ChibiMangaParser.parseMangaTiles(all$)
                if (allTiles.length > 0) {
                    allMangaSection.items = allTiles
                    sectionCallback(allMangaSection)
                }
            } catch (e) {
                console.log('Error parsing all manga section:', e)
            }
        } catch (err) {
            console.log('Error loading homepage sections:', err)
        }
    }

    /**
     * Handles clicking "View More" on any home section
     */
    override async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = ''

        switch (homepageSectionId) {
            case 'popular':
                url = page > 1
                    ? `${CHIBI_MANGA_DOMAIN}/manga/page/${page}/?order=popular`
                    : `${CHIBI_MANGA_DOMAIN}/manga/?order=popular`
                break
            case 'latest':
                url = page > 1
                    ? `${CHIBI_MANGA_DOMAIN}/manga/page/${page}/?order=update`
                    : `${CHIBI_MANGA_DOMAIN}/manga/?order=update`
                break
            case 'manhwa':
                url = page > 1
                    ? `${CHIBI_MANGA_DOMAIN}/genres/manhwa/page/${page}/`
                    : `${CHIBI_MANGA_DOMAIN}/genres/manhwa/`
                break
            case 'all':
            default:
                url = page > 1
                    ? `${CHIBI_MANGA_DOMAIN}/manga/page/${page}/?order=title`
                    : `${CHIBI_MANGA_DOMAIN}/manga/?order=title`
                break
        }

        const request: Request = App.createRequest({
            url,
            method: 'GET'
        })

        const response: Response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data)
        const items = ChibiMangaParser.parseMangaTiles($)

        return App.createPagedResults({
            results: items,
            metadata: ChibiMangaParser.hasNextPage($) ? { page: page + 1 } : undefined
        })
    }

    /**
     * Handles search queries from the user
     */
    override async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = ''

        if (query.title) {
            url = page > 1
                ? `${CHIBI_MANGA_DOMAIN}/page/${page}/?s=${encodeURIComponent(query.title)}`
                : `${CHIBI_MANGA_DOMAIN}/?s=${encodeURIComponent(query.title)}`
        } else {
            url = page > 1
                ? `${CHIBI_MANGA_DOMAIN}/manga/page/${page}/?order=update`
                : `${CHIBI_MANGA_DOMAIN}/manga/?order=update`
        }

        const request: Request = App.createRequest({
            url,
            method: 'GET'
        })

        const response: Response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data)
        const items = ChibiMangaParser.parseMangaTiles($)

        return App.createPagedResults({
            results: items,
            metadata: ChibiMangaParser.hasNextPage($) ? { page: page + 1 } : undefined
        })
    }
}
