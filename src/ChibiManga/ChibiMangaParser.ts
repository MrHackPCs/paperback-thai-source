import {
    Chapter,
    ChapterDetails,
    MangaTile,
    SourceManga,
    Tag,
    TagSection
} from '@paperback/types'
import { CHIBI_MANGA_DOMAIN, cleanUrl, parseChapterNumber, parseThaiDate } from './ChibiMangaHelper'

export class ChibiMangaParser {

    /**
     * Parses manga tiles from Themesia MangaStream grids (.bsx, .utao, etc.)
     */
    static parseMangaTiles($: any): MangaTile[] {
        const tiles: MangaTile[] = []
        const seen = new Set<string>()

        // 1. Grid items (.bsx)
        $('.bs .bsx, .bsx').each((_: any, element: any) => {
            const linkTag = $('a', element).first()
            const href = linkTag.attr('href') || ''
            const title = $('.tt', element).text().trim() || linkTag.attr('title')?.trim()

            const idMatch = href.match(/\/manga\/([^/?#]+)/)
            const id = idMatch ? idMatch[1] : ''

            if (!id || !title || seen.has(id)) return
            seen.add(id)

            const imgTag = $('img', element).first()
            const image = imgTag.attr('data-src') || imgTag.attr('src') || imgTag.attr('data-lazy-src') || ''
            const subtitle = $('.adds .epxs, .epxs, .adds .epx, .epx', element).first().text().trim() || undefined

            tiles.push(
                App.createMangaTile({
                    id,
                    image: cleanUrl(image),
                    title: App.createIconText({ text: title }),
                    subtitleText: subtitle ? App.createIconText({ text: subtitle }) : undefined
                })
            )
        })

        // 2. Latest list items (.utao) on homepage if not already found
        if (tiles.length === 0) {
            $('.utao').each((_: any, element: any) => {
                const linkTag = $('.luf a.series, .series, a[href*="/manga/"]', element).first()
                const href = linkTag.attr('href') || ''
                const title = linkTag.text().trim() || linkTag.attr('title')?.trim()

                const idMatch = href.match(/\/manga\/([^/?#]+)/)
                const id = idMatch ? idMatch[1] : ''

                if (!id || !title || seen.has(id)) return
                seen.add(id)

                const imgTag = $('.imgu img, img', element).first()
                const image = imgTag.attr('data-src') || imgTag.attr('src') || imgTag.attr('data-lazy-src') || ''
                const subtitle = $('.luf ul.series li a', element).first().text().trim() || undefined

                tiles.push(
                    App.createMangaTile({
                        id,
                        image: cleanUrl(image),
                        title: App.createIconText({ text: title }),
                        subtitleText: subtitle ? App.createIconText({ text: subtitle }) : undefined
                    })
                )
            })
        }

        return tiles
    }

    /**
     * Parses the detailed info of a manga series
     */
    static parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('h1.entry-title').text().trim() || $('.entry-title').text().trim() || $('.info-right h1').text().trim()
        
        // Thumbnail image
        const imgTag = $('.info-left .thumb img, .thumb img, img.wp-post-image').first()
        const image = imgTag.attr('data-src') || imgTag.attr('src') || $('meta[property="og:image"]').attr('content') || ''

        // Description synopsis
        const description = $('.entry-content[itemprop="description"], .entry-content-single, .desc').first().text().trim()

        // Status: Ongoing / Completed
        let status = 'Ongoing'
        $('.tsinfo .imptdt').each((_: any, el: any) => {
            const text = $(el).text().toLowerCase()
            if (text.includes('สถานะ') || text.includes('status')) {
                if (text.includes('completed') || text.includes('จบแล้ว')) {
                    status = 'Completed'
                }
            }
        })

        // Author / Artist
        let author = ''
        $('.tsinfo .imptdt').each((_: any, el: any) => {
            const text = $(el).text()
            if (text.includes('ผู้เขียน') || text.includes('ผู้แต่ง') || text.includes('author') || text.includes('artist')) {
                const val = $(el).text().replace(/ผู้เขียน|ผู้แต่ง|author|artist|:/gi, '').trim()
                if (val && !author) {
                    author = val
                }
            }
        })

        // Genres & Tags
        const tags: Tag[] = []
        $('.mgen a, .seriestugenre a').each((_: any, el: any) => {
            const tagTitle = $(el).text().trim()
            const tagId = $(el).attr('href')?.split('/').filter(Boolean).pop() || tagTitle
            if (tagTitle) {
                tags.push(App.createTag({ id: tagId, label: tagTitle }))
            }
        })

        // Rating
        const ratingText = $('.rating-prc .num, .numscore').first().text().trim()
        const rating = ratingText ? parseFloat(ratingText) : undefined

        const tagSections: TagSection[] = [
            App.createTagSection({
                id: 'genres',
                label: 'Genres',
                tags
            })
        ]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: cleanUrl(image),
                status,
                author: author || undefined,
                artist: author || undefined,
                desc: description,
                tags: tagSections,
                rating
            })
        })
    }

    /**
     * Parses the list of chapters for a manga (deduplicating duplicates)
     */
    static parseChapterList($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const seenChapters = new Set<string>()

        $('#chapterlist ul li, .bxcl ul li, .eplister ul li').each((_: any, element: any) => {
            const linkTag = $('a', element).first()
            const href = linkTag.attr('href') || ''
            
            // Extract chapterId from URL, e.g. "https://chibi-manga.com/this-emperor-...-ตอนที่-24/"
            const urlParts = href.split('/').filter(Boolean)
            const chapterId = urlParts.pop() || ''

            if (!chapterId || seenChapters.has(chapterId)) return
            seenChapters.add(chapterId)

            // Chapter Title & Number
            const name = $('.chapternum', element).text().trim() || linkTag.text().trim()
            const dataNum = $(element).attr('data-num')
            const chapNum = dataNum ? parseFloat(dataNum) : parseChapterNumber(name)

            // Date
            const dateStr = $('.chapterdate', element).text().trim()
            const time = parseThaiDate(dateStr)

            chapters.push(
                App.createChapter({
                    id: chapterId,
                    chapNum,
                    name: name || `ตอนที่ ${chapNum}`,
                    time,
                    langCode: 'th'
                })
            )
        })

        return chapters
    }

    /**
     * Parses images for a specific chapter
     */
    static parseChapterDetails(html: string, mangaId: string, chapterId: string, $: any): ChapterDetails {
        const pages: string[] = []
        const seenPages = new Set<string>()

        // Method 1: Extract JSON from ts_reader.run script
        const match = html.match(/ts_reader\.run\(([\s\S]+?)\);/)
        if (match && match[1]) {
            try {
                const data = JSON.parse(match[1])
                if (data?.sources && Array.isArray(data.sources)) {
                    for (const source of data.sources) {
                        if (source?.images && Array.isArray(source.images)) {
                            for (const img of source.images) {
                                if (img && typeof img === 'string') {
                                    const cleaned = cleanUrl(img.trim())
                                    if (cleaned && !seenPages.has(cleaned)) {
                                        seenPages.add(cleaned)
                                        pages.push(cleaned)
                                    }
                                }
                            }
                            if (pages.length > 0) break // Primary server found
                        }
                    }
                }
            } catch (err) {
                // Fallback to DOM parsing below
            }
        }

        // Method 2: DOM fallback (#readerarea img)
        if (pages.length === 0) {
            $('#readerarea img').each((_: any, element: any) => {
                const src = $(element).attr('src') || $(element).attr('data-src') || $(element).attr('data-lazy-src')
                if (src && !src.includes('readerarea.svg') && !src.includes('banner') && !src.includes('ads')) {
                    const cleaned = cleanUrl(src.trim())
                    if (cleaned && !seenPages.has(cleaned)) {
                        seenPages.add(cleaned)
                        pages.push(cleaned)
                    }
                }
            })
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId,
            pages
        })
    }

    /**
     * Checks if there is a next page in pagination
     */
    static hasNextPage($: any): boolean {
        return $('.pagination .next, .hpage .r, a.next').length > 0
    }
}
