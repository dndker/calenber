import dayjs from "@/lib/dayjs"
import type { CalendarEvent } from "@/store/calendar-store.types"
import solarlunar from "solarlunar"
import type {
    CalendarSubscription,
    CalendarSubscriptionGenerateContext,
} from "../types"

const KOREA_TIMEZONE = "Asia/Seoul"
export const KOREA_HOLIDAY_SUBSCRIPTION_ID = "subscription.kr.public-holidays"

/** DB `calendar_subscription_catalogs.config.provider` 및 병합 카탈로그에서 사용 */
export const KOREAN_HOLIDAY_PROVIDER_KEY = "korean_public_holidays_v1"
const KOREA_HOLIDAY_COLLECTION_ID = "collection.subscription.kr.public-holidays"
const KOREA_HOLIDAY_COLOR = "red"

type HolidaySeed = {
    id: string
    name: string
    description: string
    resolveDates: (year: number) => string[]
    /**
     * 주말 겹침 시 대체공휴일 부여 여부.
     * 연도에 따라 적용 기준이 달라지는 경우 함수로 지정.
     */
    substituteOnWeekend: boolean | ((year: number) => boolean)
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
    title: string,
    description: string,
    options?: {
        /**
         * 즐겨찾기/퍼머링크 등에서 사용 중인 기존 event id를 보존해야 할 때 사용합니다.
         * (예: 과거에는 id에 title이 포함되어 명칭 변경 시에도 기존 id가 유지되어야 하는 경우)
         */
        idOverride?: string
    }
): CalendarEvent {
    const start = dayjs.tz(isoDate, KOREA_TIMEZONE).startOf("day").valueOf()

    return {
        id: options?.idOverride ?? `${KOREA_HOLIDAY_SUBSCRIPTION_ID}:${isoDate}:${title}`,
        title,
        content: [
            {
                type: "paragraph",
                content: [description],
            },
        ],
        start,
        end: start,
        allDay: true,
        timezone: KOREA_TIMEZONE,
        collectionIds: [KOREA_HOLIDAY_COLLECTION_ID],
        collections: [
            {
                id: KOREA_HOLIDAY_COLLECTION_ID,
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
        primaryCollectionId: KOREA_HOLIDAY_COLLECTION_ID,
        primaryCollection: {
            id: KOREA_HOLIDAY_COLLECTION_ID,
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
    const legacyTitle = parts.slice(2).join(":")

    if (!isoDate) {
        return null
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        return null
    }

    const year = Number(isoDate.slice(0, 4))
    const holiday = Number.isFinite(year) ? buildYearlyKoreanHolidayMap(year).get(isoDate) : null
    const resolvedTitle = holiday?.name ?? legacyTitle
    const resolvedDescription = holiday?.description ?? `${resolvedTitle} 일정입니다.`

    if (!resolvedTitle) {
        return null
    }

    return createAllDaySubscriptionEvent(isoDate, resolvedTitle, resolvedDescription, {
        // 과거 즐겨찾기/DB에 저장된 id로도 해제/정렬이 유지되도록 원래 id를 보존
        idOverride: eventId,
    })
}

function resolveLunarToSolarDate(
    year: number,
    lunarMonth: number,
    lunarDay: number
) {
    const result = solarlunar.lunar2solar(year, lunarMonth, lunarDay, false)
    return formatIsoDate(result.cYear, result.cMonth, result.cDay)
}

/**
 * 대체공휴일 적용 대상 (관공서의 공휴일에 관한 규정 제3조 기준, 2026년 이후):
 * - 적용: 설날 연휴, 삼일절, 어린이날, 부처님오신날, 광복절, 추석 연휴,
 *         개천절, 한글날, 성탄절(2026~), 제헌절(2026~)
 * - 미적용: 신정, 현충일, 노동절
 */
function getKoreanHolidaySeeds(): HolidaySeed[] {
    return [
        {
            id: "new-year-day",
            name: "신정",
            // 신정은 관공서공휴일규정 제3조 대체공휴일 적용 대상에서 제외
            description: "양력 새해 첫날로, 대한민국 공휴일 중 유일하게 대체공휴일이 적용되지 않는 날입니다.",
            resolveDates: (year) => [formatIsoDate(year, 1, 1)],
            substituteOnWeekend: false,
        },
        {
            id: "lunar-new-year",
            name: "설날",
            description:
                "음력 1월 1일을 기준으로 전날·당일·다음날 3일을 쉬는 한국 최대 명절입니다.",
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
            description: "1919년 3월 1일 일제 강점기에 일어난 독립운동을 기념하는 국경일입니다.",
            resolveDates: (year) => [formatIsoDate(year, 3, 1)],
            substituteOnWeekend: true,
        },
        {
            id: "labor-day",
            name: "노동절",
            // 2026년부터 '근로자의날'에서 '노동절'로 명칭 변경, 법정 공휴일로 승격
            // 단, 관공서공휴일규정 제3조 미개정으로 대체공휴일 적용 대상에서 제외
            description: "노동자의 열악한 근무환경 개선과 지위 향상을 위해 제정된 날로, 전 세계 80여 개국이 5월 1일에 기념합니다.",
            resolveDates: (year) => [formatIsoDate(year, 5, 1)],
            substituteOnWeekend: false,
        },
        {
            id: "children-day",
            name: "어린이날",
            description: "어린이의 인격을 존중하고 행복을 도모하기 위해 방정환이 제창하여 1923년부터 기념한 날입니다.",
            resolveDates: (year) => [formatIsoDate(year, 5, 5)],
            substituteOnWeekend: true,
        },
        {
            id: "buddha-birthday",
            name: "부처님오신날",
            description: "음력 4월 8일, 불교의 창시자 석가모니의 탄생을 기념하는 날입니다.",
            resolveDates: (year) => [resolveLunarToSolarDate(year, 4, 8)],
            substituteOnWeekend: true,
        },
        {
            id: "memorial-day",
            name: "현충일",
            // 현충일은 관공서공휴일규정 제3조 대체공휴일 적용 대상에서 제외
            description: "국가를 위해 희생한 순국선열과 전몰장병을 추모하기 위해 1956년 제정된 기념일입니다.",
            resolveDates: (year) => [formatIsoDate(year, 6, 6)],
            substituteOnWeekend: false,
        },
        {
            id: "constitution-day",
            name: "제헌절",
            // 2008~2025년은 공휴일에서 제외, 2026년부터 복원
            description: "1948년 7월 17일 대한민국 헌법의 공포를 기념하는 국경일로, 2026년 18년 만에 공휴일로 복원되었습니다.",
            resolveDates: (year) => year >= 2026 ? [formatIsoDate(year, 7, 17)] : [],
            substituteOnWeekend: true,
        },
        {
            id: "liberation-day",
            name: "광복절",
            description: "1945년 8월 15일 일제 강점기로부터의 해방과 1948년 대한민국 정부 수립을 기념하는 국경일입니다.",
            resolveDates: (year) => [formatIsoDate(year, 8, 15)],
            substituteOnWeekend: true,
        },
        {
            id: "chuseok",
            name: "추석",
            description:
                "음력 8월 15일을 기준으로 전날·당일·다음날 3일을 쉬는 한가위 명절로, 조상에게 햇곡식으로 차례를 지냅니다.",
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
            description: "기원전 2333년 단군왕검이 고조선을 건국하였다고 전해지는 날을 기념하는 국경일입니다.",
            resolveDates: (year) => [formatIsoDate(year, 10, 3)],
            substituteOnWeekend: true,
        },
        {
            id: "hangul-day",
            name: "한글날",
            description: "1446년 세종대왕이 훈민정음을 반포한 날을 기념하는 국경일입니다.",
            resolveDates: (year) => [formatIsoDate(year, 10, 9)],
            substituteOnWeekend: true,
        },
        {
            id: "christmas",
            name: "성탄절",
            // 2023년 관공서공휴일규정 개정으로 대체공휴일 적용 대상 추가, 2026년부터 실질 적용
            description: "예수 그리스도의 탄생을 기념하는 날로, 전 세계 기독교권에서 가장 널리 기념하는 종교 공휴일입니다.",
            resolveDates: (year) => [formatIsoDate(year, 12, 25)],
            substituteOnWeekend: (year) => year >= 2026,
        },
    ]
}

function collectSubstituteHoliday(
    seed: HolidaySeed,
    year: number,
    holidayDates: Set<string>,
    occupiedDates: Set<string>
) {
    const applies =
        typeof seed.substituteOnWeekend === "function"
            ? seed.substituteOnWeekend(year)
            : seed.substituteOnWeekend
    if (!applies) {
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
    const holidayMap = new Map<string, { name: string; description: string }>()
    const seeds = getKoreanHolidaySeeds()

    for (const seed of seeds) {
        const holidayDates = new Set(seed.resolveDates(year))
        const sortedHolidayDates = [...holidayDates].sort()
        const centerHolidayDate =
            sortedHolidayDates[Math.floor(sortedHolidayDates.length / 2)] ?? null

        for (const isoDate of holidayDates) {
            occupiedDates.add(isoDate)
            // 설날·추석: 당일만 본명, 전날/다음날은 '연휴'로 표기 (CLAUDE.md 규칙 준수)
            const isLunarNewYearHoliday =
                seed.id === "lunar-new-year" && isoDate !== centerHolidayDate
            const isChuseokHoliday =
                seed.id === "chuseok" && isoDate !== centerHolidayDate
            let name = seed.name
            if (isLunarNewYearHoliday) name = "설날 연휴"
            else if (isChuseokHoliday) name = "추석 연휴"
            holidayMap.set(isoDate, {
                name,
                description: seed.description,
            })
        }

        collectSubstituteHoliday(seed, year, holidayDates, occupiedDates)

        for (const isoDate of holidayDates) {
            if (!holidayMap.has(isoDate)) {
                holidayMap.set(isoDate, {
                    name: `대체공휴일(${seed.name})`,
                    description: `${seed.description} (대체공휴일)`,
                })
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

        for (const [isoDate, holiday] of holidayMap.entries()) {
            if (isoDate < rangeStartIso || isoDate > rangeEndIso) {
                continue
            }

            events.push(
                createAllDaySubscriptionEvent(
                    isoDate,
                    holiday.name,
                    holiday.description
                )
            )
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
    sourceType: "system_holiday",
    name: "대한민국 공휴일",
    description: "대한민국 법정 공휴일을 추가합니다.",
    authority: "system",
    ownerName: "Calenber",
    verified: true,
    tags: ["공휴일", "대한민국", "음력", "대체공휴일"],
    collectionColor: KOREA_HOLIDAY_COLOR,
    generateEvents: generateKoreanPublicHolidaySubscriptionEvents,
}
