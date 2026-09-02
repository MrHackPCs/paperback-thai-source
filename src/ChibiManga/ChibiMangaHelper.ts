export const CHIBI_MANGA_DOMAIN = 'https://chibi-manga.com'

/**
 * Thai month name mapping to Gregorian month numbers (0-indexed)
 */
const THAI_MONTHS: { [key: string]: number } = {
    'มกราคม': 0,
    'กุมภาพันธ์': 1,
    'มีนาคม': 2,
    'เมษายน': 3,
    'พฤษภาคม': 4,
    'มิถุนายน': 5,
    'กรกฎาคม': 6,
    'สิงหาคม': 7,
    'กันยายน': 8,
    'ตุลาคม': 9,
    'พฤศจิกายน': 10,
    'ธันวาคม': 11
}

const ENGLISH_MONTHS: { [key: string]: number } = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11
}

/**
 * Parses Thai or English date strings or relative times into JavaScript Date objects.
 */
export function parseThaiDate(dateStr: string): Date {
    if (!dateStr) return new Date()

    const trimmed = dateStr.trim()

    // Handle relative dates like "X วัน ที่แล้ว", "X ชั่วโมง ที่แล้ว", "X days ago"
    if (trimmed.includes('ที่แล้ว') || trimmed.includes('ago')) {
        const now = new Date()
        const match = trimmed.match(/(\d+)/)
        const amount = match ? parseInt(match[1], 10) : 1

        if (trimmed.includes('วินาที') || trimmed.includes('second')) {
            return new Date(now.getTime() - amount * 1000)
        } else if (trimmed.includes('นาที') || trimmed.includes('minute') || trimmed.includes('min')) {
            return new Date(now.getTime() - amount * 60 * 1000)
        } else if (trimmed.includes('ชั่วโมง') || trimmed.includes('hour')) {
            return new Date(now.getTime() - amount * 60 * 60 * 1000)
        } else if (trimmed.includes('วัน') || trimmed.includes('day')) {
            return new Date(now.getTime() - amount * 24 * 60 * 60 * 1000)
        } else if (trimmed.includes('สัปดาห์') || trimmed.includes('week')) {
            return new Date(now.getTime() - amount * 7 * 24 * 60 * 60 * 1000)
        } else if (trimmed.includes('เดือน') || trimmed.includes('month')) {
            return new Date(now.getTime() - amount * 30 * 24 * 60 * 60 * 1000)
        } else if (trimmed.includes('ปี') || trimmed.includes('year')) {
            return new Date(now.getTime() - amount * 365 * 24 * 60 * 60 * 1000)
        }
        return now
    }

    // Format: "24 May 2026" or "May 24, 2026"
    for (const [monthName, monthIndex] of Object.entries(ENGLISH_MONTHS)) {
        if (trimmed.toLowerCase().includes(monthName)) {
            const numbers = trimmed.match(/\d+/g)
            if (numbers && numbers.length >= 2) {
                let day = parseInt(numbers[0], 10)
                let year = parseInt(numbers[1], 10)
                if (numbers[0].length === 4) {
                    year = parseInt(numbers[0], 10)
                    day = parseInt(numbers[1], 10)
                }
                return new Date(year, monthIndex, day)
            }
        }
    }

    // Format: "พฤษภาคม 24, 2026" or "24 พฤษภาคม 2569"
    for (const [monthName, monthIndex] of Object.entries(THAI_MONTHS)) {
        if (trimmed.includes(monthName)) {
            const numbers = trimmed.match(/\d+/g)
            if (numbers && numbers.length >= 2) {
                let day = parseInt(numbers[0], 10)
                let year = parseInt(numbers[1], 10)

                // If year is Buddhist calendar (e.g. 2569), convert to CE (2026)
                if (year > 2400) {
                    year -= 543
                }

                if (numbers[0].length === 4) {
                    year = parseInt(numbers[0], 10)
                    day = parseInt(numbers[1], 10)
                    if (year > 2400) year -= 543
                }

                return new Date(year, monthIndex, day)
            }
        }
    }

    const parsed = new Date(trimmed)
    return isNaN(parsed.getTime()) ? new Date() : parsed
}

/**
 * Extracts a numeric chapter number from a chapter string or URL
 * e.g., "ตอนที่ 24", "Chapter 24.5", "24" -> 24
 */
export function parseChapterNumber(text: string): number {
    if (!text) return 0
    const match = text.match(/(?:ตอนที่|chapter|ch\.?|ep\.?)\s*(\d+(?:\.\d+)?)/i) || text.match(/(\d+(?:\.\d+)?)/)
    return match ? parseFloat(match[1]) : 0
}

/**
 * Cleans and normalizes URLs
 */
export function cleanUrl(url: string): string {
    if (!url) return ''
    if (url.startsWith('//')) return `https:${url}`
    if (url.startsWith('/')) return `${CHIBI_MANGA_DOMAIN}${url}`
    return url
}
