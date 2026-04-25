import dayjs from "@/lib/dayjs"
import { randomCalendarCategoryColor } from "@/lib/calendar/category-color"
import {
    type CalendarEvent,
    type CalendarEventCategory,
    defaultContent,
} from "@/store/calendar-store.types"
import { nanoid } from "nanoid"

const demoCategoryDefinitions = [
    { id: "demo-category-team", name: "팀 일정" },
    { id: "demo-category-meeting", name: "회의" },
    { id: "demo-category-focus", name: "집중 업무" },
    { id: "demo-category-personal", name: "개인" },
    { id: "demo-category-deadline", name: "마감" },
] as const

export function getDemoEventCategories(): CalendarEventCategory[] {
    const now = dayjs().valueOf()

    return demoCategoryDefinitions.map((category, index) => ({
        id: category.id,
        calendarId: "demo",
        name: category.name,
        options: {
            visibleByDefault: true,
            color: randomCalendarCategoryColor(),
        },
        createdById: null,
        createdAt: now + index,
        updatedAt: now + index,
    }))
}

export function generateMockEvents(
    timezone?: string,
    categories: CalendarEventCategory[] = getDemoEventCategories()
): CalendarEvent[] {
    const resolvedTimezone = timezone ?? "Asia/Seoul"

    // console.log(
    //     typeof window === "undefined" ? "SSR" : "CSR",
    //     "generateMockEvents"
    // )

    return Array.from({ length: 10 }).map((_, i) => {
        const base = dayjs()
            .tz(resolvedTimezone)
            .add(i * 2 - 5, "day")

        // 1~3일 랜덤 길이
        const durationDays = Math.floor(Math.random() * 3) + 1

        // allDay 여부 랜덤
        const isAllDay = true

        // 시작 시간 랜덤 (시간 이벤트일 때만)
        const startHour = Math.floor(Math.random() * 8) + 8 // 8~16시

        const start = isAllDay
            ? base.startOf("day")
            : base.hour(startHour).minute(0)

        const end = isAllDay
            ? start.add(durationDays - 1, "day").endOf("day")
            : start.add(Math.floor(Math.random() * 3) + 1, "hour") // 1~3시간
        const category =
            categories[Math.floor(Math.random() * categories.length)] ?? null

        return {
            id: nanoid(),
            title: `${durationDays}일 일정 ${i + 1}`,
            content: defaultContent,

            start: start.valueOf(),
            end: end.valueOf(),

            allDay: isAllDay,

            timezone: resolvedTimezone,
            categoryIds: category ? [category.id] : [],
            categories: category ? [category] : [],
            categoryId: category?.id ?? null,
            category: category,
            participants: [],
            isFavorite: false,
            favoritedAt: null,

            status: "scheduled",
            authorId: null,
            author: null,
            updatedById: null,
            updatedBy: null,
            isLocked: false,
            createdAt: dayjs().valueOf(),
            updatedAt: dayjs().valueOf(),
        }
    })
}
