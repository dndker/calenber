import dayjs from "@/lib/dayjs"
import { randomCalendarCollectionColor } from "@/lib/calendar/collection-color"
import {
    type CalendarEvent,
    type CalendarEventCollection,
    defaultContent,
} from "@/store/calendar-store.types"
import { nanoid } from "nanoid"

const demoCollectionDefinitions = [
    { id: "demo-collection-team", name: "Team" },
    { id: "demo-collection-meeting", name: "Meeting" },
    { id: "demo-collection-focus", name: "Focus" },
    { id: "demo-collection-personal", name: "Personal" },
    { id: "demo-collection-deadline", name: "Deadline" },
] as const

export function getDemoEventCollections(): CalendarEventCollection[] {
    const now = dayjs().valueOf()

    return demoCollectionDefinitions.map((collection, index) => ({
        id: collection.id,
        calendarId: "demo",
        name: collection.name,
        options: {
            visibleByDefault: true,
            color: randomCalendarCollectionColor(),
        },
        createdById: null,
        createdAt: now + index,
        updatedAt: now + index,
    }))
}

export function generateMockEvents(
    timezone?: string,
    collections: CalendarEventCollection[] = getDemoEventCollections()
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
        const collection =
            collections[Math.floor(Math.random() * collections.length)] ?? null

        return {
            id: nanoid(),
            title: `${durationDays}-day event ${i + 1}`,
            content: defaultContent,

            start: start.valueOf(),
            end: end.valueOf(),

            allDay: isAllDay,

            timezone: resolvedTimezone,
            collectionIds: collection ? [collection.id] : [],
            collections: collection ? [collection] : [],
            primaryCollectionId: collection?.id ?? null,
            primaryCollection: collection,
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
