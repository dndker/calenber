import dayjs from "@/lib/dayjs"
import type { CalendarEvent } from "@/store/calendar-store.types"
import { defaultContent } from "@/store/calendar-store.types"
import solarlunar from "solarlunar"
import type {
    CalendarSubscription,
    CalendarSubscriptionGenerateContext,
} from "../types"

const KOREA_TIMEZONE = "Asia/Seoul"
const KOREA_HOLIDAY_SUBSCRIPTION_ID = "subscription.kr.public-holidays"
const KOREA_HOLIDAY_CATEGORY_ID = "category.subscription.kr.public-holidays"
const KOREA_HOLIDAY_COLOR = "red"

type HolidaySeed = {
    id: string
    name: string
    resolveDates: (year: number) => string[]
    substituteOnWeekend: boolean
}

function formatIsoDate(year: number, month: number, day: number) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function toKstDate(isoDate: string) {
    return dayjs(`${isoDate}T00:00:00+09:00`).tz(KOREA_TIMEZONE)
}

function shiftIsoDateInKst(isoDate: string, dayOffset: number) {
    return toKstDate(isoDate).add(dayOffset, "day").format("YYYY-MM-DD")
}

function toIsoDateInKst(timestamp: number) {
    return dayjs.tz(timestamp, KOREA_TIMEZONE).format("YYYY-MM-DD")
}

function createAllDaySubscriptionEvent(
    isoDate: string,
    title: string
): CalendarEvent {
    const start = dayjs.tz(isoDate, KOREA_TIMEZONE).startOf("day").valueOf()

    return {
        id: `${KOREA_HOLIDAY_SUBSCRIPTION_ID}:${isoDate}:${title}`,
        title,
        content: defaultContent,
        start,
        end: start,
        allDay: true,
        timezone: KOREA_TIMEZONE,
        categoryIds: [KOREA_HOLIDAY_CATEGORY_ID],
        categories: [
            {
                id: KOREA_HOLIDAY_CATEGORY_ID,
                calendarId: "subscriptions",
                name: "대한민국 공휴일",
                options: {
                    visibleByDefault: true,
                    color: KOREA_HOLIDAY_COLOR,
                },
                createdById: null,
                createdAt: start,
                updatedAt: start,
            },
        ],
        categoryId: KOREA_HOLIDAY_CATEGORY_ID,
        category: {
            id: KOREA_HOLIDAY_CATEGORY_ID,
            calendarId: "subscriptions",
            name: "대한민국 공휴일",
            options: {
                visibleByDefault: true,
                color: KOREA_HOLIDAY_COLOR,
            },
            createdById: null,
            createdAt: start,
            updatedAt: start,
        },
        participants: [],
        isFavorite: false,
        favoritedAt: null,
        status: "scheduled",
        authorId: null,
        author: {
            id: null,
            name: "대한민국 공휴일 구독",
            email: null,
            avatarUrl: null,
        },
        updatedById: null,
        updatedBy: null,
        subscription: {
            id: KOREA_HOLIDAY_SUBSCRIPTION_ID,
            slug: KOREA_HOLIDAY_SUBSCRIPTION_ID,
            name: "대한민국 공휴일",
            sourceType: "system_holiday",
            authority: "system",
        },
        isLocked: true,
        createdAt: start,
        updatedAt: start,
    }
}

export function getKoreanPublicHolidaySubscriptionEventById(eventId: string) {
    if (!eventId.startsWith(`${KOREA_HOLIDAY_SUBSCRIPTION_ID}:`)) {
        return null
    }

    const parts = eventId.split(":")
    const isoDate = parts[1]
    const title = parts.slice(2).join(":")

    if (!isoDate || !title) {
        return null
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        return null
    }

    return createAllDaySubscriptionEvent(isoDate, title)
}

function resolveLunarToSolarDate(
    year: number,
    lunarMonth: number,
    lunarDay: number
) {
    const result = solarlunar.lunar2solar(year, lunarMonth, lunarDay, false)
    return formatIsoDate(result.cYear, result.cMonth, result.cDay)
}

function getKoreanHolidaySeeds(): HolidaySeed[] {
    return [
        {
            id: "new-year-day",
            name: "신정",
            resolveDates: (year) => [formatIsoDate(year, 1, 1)],
            substituteOnWeekend: true,
        },
        {
            id: "lunar-new-year",
            name: "설날",
            resolveDates: (year) => {
                const seollal = resolveLunarToSolarDate(year, 1, 1)
                return [
                    shiftIsoDateInKst(seollal, -1),
                    seollal,
                    shiftIsoDateInKst(seollal, 1),
                ]
            },
            substituteOnWeekend: true,
        },
        {
            id: "independence-movement-day",
            name: "삼일절",
            resolveDates: (year) => [formatIsoDate(year, 3, 1)],
            substituteOnWeekend: true,
        },
        {
            id: "children-day",
            name: "어린이날",
            resolveDates: (year) => [formatIsoDate(year, 5, 5)],
            substituteOnWeekend: true,
        },
        {
            id: "labor-day",
            name: "근로자의날",
            resolveDates: (year) => [formatIsoDate(year, 5, 1)],
            substituteOnWeekend: false,
        },
        {
            id: "buddha-birthday",
            name: "부처님오신날",
            resolveDates: (year) => [resolveLunarToSolarDate(year, 4, 8)],
            substituteOnWeekend: true,
        },
        {
            id: "memorial-day",
            name: "현충일",
            resolveDates: (year) => [formatIsoDate(year, 6, 6)],
            substituteOnWeekend: false,
        },
        {
            id: "liberation-day",
            name: "광복절",
            resolveDates: (year) => [formatIsoDate(year, 8, 15)],
            substituteOnWeekend: true,
        },
        {
            id: "chuseok",
            name: "추석",
            resolveDates: (year) => {
                const chuseok = resolveLunarToSolarDate(year, 8, 15)
                return [
                    shiftIsoDateInKst(chuseok, -1),
                    chuseok,
                    shiftIsoDateInKst(chuseok, 1),
                ]
            },
            substituteOnWeekend: true,
        },
        {
            id: "national-foundation-day",
            name: "개천절",
            resolveDates: (year) => [formatIsoDate(year, 10, 3)],
            substituteOnWeekend: true,
        },
        {
            id: "hangul-day",
            name: "한글날",
            resolveDates: (year) => [formatIsoDate(year, 10, 9)],
            substituteOnWeekend: true,
        },
        {
            id: "christmas",
            name: "성탄절",
            resolveDates: (year) => [formatIsoDate(year, 12, 25)],
            substituteOnWeekend: true,
        },
    ]
}

function collectSubstituteHoliday(
    seed: HolidaySeed,
    holidayDates: Set<string>,
    occupiedDates: Set<string>
) {
    if (!seed.substituteOnWeekend) {
        return
    }

    const hasWeekendHoliday = [...holidayDates].some((isoDate) => {
        const weekday = toKstDate(isoDate).day()
        return weekday === 0 || weekday === 6
    })

    if (!hasWeekendHoliday) {
        return
    }

    let cursor = toKstDate([...holidayDates].sort()[holidayDates.size - 1]!)
        .add(1, "day")
        .startOf("day")
    while (true) {
        const weekday = cursor.day()
        const candidate = cursor.format("YYYY-MM-DD")
        const isWeekday = weekday !== 0 && weekday !== 6

        if (isWeekday && !occupiedDates.has(candidate)) {
            holidayDates.add(candidate)
            occupiedDates.add(candidate)
            return
        }

        cursor = cursor.add(1, "day")
    }
}

function buildYearlyKoreanHolidayMap(year: number) {
    const occupiedDates = new Set<string>()
    const holidayMap = new Map<string, string>()
    const seeds = getKoreanHolidaySeeds()

    for (const seed of seeds) {
        const holidayDates = new Set(seed.resolveDates(year))
        for (const isoDate of holidayDates) {
            occupiedDates.add(isoDate)
            holidayMap.set(isoDate, seed.name)
        }

        collectSubstituteHoliday(seed, holidayDates, occupiedDates)

        for (const isoDate of holidayDates) {
            if (!holidayMap.has(isoDate)) {
                holidayMap.set(isoDate, `${seed.name} 대체공휴일`)
            }
        }
    }

    return holidayMap
}

export function generateKoreanPublicHolidaySubscriptionEvents(
    context: CalendarSubscriptionGenerateContext
) {
    const fromYear = dayjs.tz(context.rangeStart, KOREA_TIMEZONE).year() - 1
    const toYear = dayjs.tz(context.rangeEnd, KOREA_TIMEZONE).year() + 1
    const rangeStartIso = toIsoDateInKst(context.rangeStart)
    const rangeEndIso = toIsoDateInKst(context.rangeEnd)
    const events: CalendarEvent[] = []

    for (let year = fromYear; year <= toYear; year += 1) {
        const holidayMap = buildYearlyKoreanHolidayMap(year)

        for (const [isoDate, name] of holidayMap.entries()) {
            if (isoDate < rangeStartIso || isoDate > rangeEndIso) {
                continue
            }

            events.push(createAllDaySubscriptionEvent(isoDate, name))
        }
    }

    return events.sort((a, b) => {
        if (a.start !== b.start) {
            return a.start - b.start
        }
        return a.title.localeCompare(b.title, "ko")
    })
}

export const koreanPublicHolidaySubscription: CalendarSubscription = {
    id: KOREA_HOLIDAY_SUBSCRIPTION_ID,
    name: "대한민국 공휴일",
    description: "대한민국 법정 공휴일을 추가합니다.",
    authority: "system",
    ownerName: "Calenber",
    verified: true,
    tags: ["공휴일", "대한민국", "음력", "대체공휴일"],
    categoryColor: KOREA_HOLIDAY_COLOR,
    generateEvents: generateKoreanPublicHolidaySubscriptionEvents,
}
