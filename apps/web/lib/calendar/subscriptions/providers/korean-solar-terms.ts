import dayjs from "@/lib/dayjs"
import type { CalendarEvent } from "@/store/calendar-store.types"
import type {
    CalendarSubscription,
    CalendarSubscriptionGenerateContext,
} from "../types"

const KOREA_TIMEZONE = "Asia/Seoul"
export const KOREA_SOLAR_TERMS_SUBSCRIPTION_ID = "subscription.kr.solar-terms"

/** DB `calendar_subscription_catalogs.config.provider` 및 병합 카탈로그에서 사용 */
export const KOREAN_SOLAR_TERMS_PROVIDER_KEY = "korean_solar_terms_v1"
const KOREA_SOLAR_TERMS_CATEGORY_ID = "category.subscription.kr.solar-terms"
const KOREA_SOLAR_TERMS_COLOR = "gray"

type SolarTermSeed = {
    id: string
    name: string
    description: string
    month: number
    day: number
}

const SOLAR_TERMS: SolarTermSeed[] = [
    {
        id: "ipchun",
        name: "입춘",
        description: "봄이 시작됨을 알리는 절기입니다.",
        month: 2,
        day: 4,
    },
    {
        id: "usu",
        name: "우수",
        description: "눈이 녹고 비가 내리기 시작하는 절기입니다.",
        month: 2,
        day: 19,
    },
    {
        id: "gyeongchip",
        name: "경칩",
        description: "겨울잠 자던 벌레가 깨어난다는 절기입니다.",
        month: 3,
        day: 5,
    },
    {
        id: "chunbun",
        name: "춘분",
        description: "낮과 밤의 길이가 거의 같아지는 절기입니다.",
        month: 3,
        day: 20,
    },
    {
        id: "cheongmyeong",
        name: "청명",
        description: "하늘이 맑고 화창해지는 시기의 절기입니다.",
        month: 4,
        day: 5,
    },
    {
        id: "gogu",
        name: "곡우",
        description: "봄비가 내려 곡식이 자라기 좋은 절기입니다.",
        month: 4,
        day: 20,
    },
    {
        id: "ipha",
        name: "입하",
        description: "여름이 시작됨을 알리는 절기입니다.",
        month: 5,
        day: 5,
    },
    {
        id: "soman",
        name: "소만",
        description: "만물이 점차 생장하는 절기입니다.",
        month: 5,
        day: 21,
    },
    {
        id: "mangjong",
        name: "망종",
        description: "까끄라기 있는 곡식의 씨를 뿌리기 좋은 절기입니다.",
        month: 6,
        day: 6,
    },
    {
        id: "haji",
        name: "하지",
        description: "1년 중 낮이 가장 긴 시기의 절기입니다.",
        month: 6,
        day: 21,
    },
    {
        id: "soseo",
        name: "소서",
        description: "본격적인 더위가 시작되는 절기입니다.",
        month: 7,
        day: 7,
    },
    {
        id: "daeseo",
        name: "대서",
        description: "1년 중 가장 무더운 시기의 절기입니다.",
        month: 7,
        day: 23,
    },
    {
        id: "ipchu",
        name: "입추",
        description: "가을이 시작됨을 알리는 절기입니다.",
        month: 8,
        day: 7,
    },
    {
        id: "cheoseo",
        name: "처서",
        description: "더위가 한풀 꺾이기 시작하는 절기입니다.",
        month: 8,
        day: 23,
    },
    {
        id: "baengno",
        name: "백로",
        description: "이슬이 맺히기 시작하는 절기입니다.",
        month: 9,
        day: 7,
    },
    {
        id: "chubun",
        name: "추분",
        description: "낮과 밤의 길이가 다시 비슷해지는 절기입니다.",
        month: 9,
        day: 23,
    },
    {
        id: "hanro",
        name: "한로",
        description: "찬 이슬이 맺히며 가을이 깊어지는 절기입니다.",
        month: 10,
        day: 8,
    },
    {
        id: "sanggang",
        name: "상강",
        description: "서리가 내리기 시작하는 절기입니다.",
        month: 10,
        day: 23,
    },
    {
        id: "ipdong",
        name: "입동",
        description: "겨울이 시작됨을 알리는 절기입니다.",
        month: 11,
        day: 7,
    },
    {
        id: "sosel",
        name: "소설",
        description: "첫눈이 내리기 시작하는 시기의 절기입니다.",
        month: 11,
        day: 22,
    },
    {
        id: "daeseol",
        name: "대설",
        description: "눈이 많이 내릴 수 있는 시기의 절기입니다.",
        month: 12,
        day: 7,
    },
    {
        id: "dongji",
        name: "동지",
        description: "1년 중 밤이 가장 긴 시기의 절기입니다.",
        month: 12,
        day: 22,
    },
    {
        id: "sohan",
        name: "소한",
        description: "작은 추위가 온다는 절기입니다.",
        month: 1,
        day: 6,
    },
    {
        id: "daehan",
        name: "대한",
        description: "큰 추위가 온다는 절기입니다.",
        month: 1,
        day: 20,
    },
]

function formatIsoDate(year: number, month: number, day: number) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function toIsoDateInKst(timestamp: number) {
    return dayjs.tz(timestamp, KOREA_TIMEZONE).format("YYYY-MM-DD")
}

function createAllDaySubscriptionEvent(
    isoDate: string,
    title: string,
    description: string
): CalendarEvent {
    const start = dayjs.tz(isoDate, KOREA_TIMEZONE).startOf("day").valueOf()

    return {
        id: `${KOREA_SOLAR_TERMS_SUBSCRIPTION_ID}:${isoDate}:${title}`,
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
        categoryIds: [KOREA_SOLAR_TERMS_CATEGORY_ID],
        categories: [
            {
                id: KOREA_SOLAR_TERMS_CATEGORY_ID,
                calendarId: "subscriptions",
                name: "대한민국 절기",
                options: {
                    visibleByDefault: true,
                    color: KOREA_SOLAR_TERMS_COLOR,
                },
                createdById: null,
                createdAt: start,
                updatedAt: start,
            },
        ],
        categoryId: KOREA_SOLAR_TERMS_CATEGORY_ID,
        category: {
            id: KOREA_SOLAR_TERMS_CATEGORY_ID,
            calendarId: "subscriptions",
            name: "대한민국 절기",
            options: {
                visibleByDefault: true,
                color: KOREA_SOLAR_TERMS_COLOR,
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
            name: "대한민국 절기 구독",
            email: null,
            avatarUrl: null,
        },
        updatedById: null,
        updatedBy: null,
        subscription: {
            id: KOREA_SOLAR_TERMS_SUBSCRIPTION_ID,
            slug: KOREA_SOLAR_TERMS_SUBSCRIPTION_ID,
            name: "대한민국 절기",
            sourceType: "system_holiday",
            authority: "system",
        },
        isLocked: true,
        createdAt: start,
        updatedAt: start,
    }
}

export function generateKoreanSolarTermSubscriptionEvents(
    context: CalendarSubscriptionGenerateContext
) {
    const fromYear = dayjs.tz(context.rangeStart, KOREA_TIMEZONE).year() - 1
    const toYear = dayjs.tz(context.rangeEnd, KOREA_TIMEZONE).year() + 1
    const rangeStartIso = toIsoDateInKst(context.rangeStart)
    const rangeEndIso = toIsoDateInKst(context.rangeEnd)
    const events: CalendarEvent[] = []

    for (let year = fromYear; year <= toYear; year += 1) {
        for (const term of SOLAR_TERMS) {
            const isoDate = formatIsoDate(year, term.month, term.day)

            if (isoDate < rangeStartIso || isoDate > rangeEndIso) {
                continue
            }

            events.push(
                createAllDaySubscriptionEvent(
                    isoDate,
                    term.name,
                    term.description
                )
            )
        }
    }

    return events.sort((a, b) => a.start - b.start)
}

export function getKoreanSolarTermSubscriptionEventById(eventId: string) {
    if (!eventId.startsWith(`${KOREA_SOLAR_TERMS_SUBSCRIPTION_ID}:`)) {
        return null
    }

    const parts = eventId.split(":")
    const isoDate = parts[1]
    const title = parts.slice(2).join(":")

    if (!isoDate || !title || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        return null
    }

    return createAllDaySubscriptionEvent(isoDate, title, `${title} 절기입니다.`)
}

export const koreanSolarTermSubscription: CalendarSubscription = {
    id: KOREA_SOLAR_TERMS_SUBSCRIPTION_ID,
    sourceType: "system_holiday",
    name: "대한민국 절기",
    description: "대한민국 24절기 일정을 추가합니다.",
    authority: "system",
    ownerName: "Calenber",
    verified: true,
    tags: ["절기", "대한민국", "24절기", "계절"],
    categoryColor: KOREA_SOLAR_TERMS_COLOR,
    generateEvents: generateKoreanSolarTermSubscriptionEvents,
}
