import {
    APP_DEFAULT_IMAGE_ALT,
    APP_DESCRIPTION,
    APP_NAME,
    APP_URL,
} from "@/lib/app-config"
import type { CalendarSummary } from "@/lib/calendar/queries"
import dayjs from "@/lib/dayjs"
import {
    eventStatusLabel,
    type CalendarEvent,
} from "@/store/calendar-store.types"
import type { Metadata } from "next"
import type { CalendarEventMetadata } from "./queries"

export const demoCalendarSummary: CalendarSummary = {
    id: "demo",
    name: "데모 캘린더",
    avatarUrl: null,
    accessMode: "public_open",
    eventLayout: "compact",
    updatedAt: "",
    createdAt: "",
}

type CalendarEventShareData =
    | CalendarEvent
    | CalendarEventMetadata
    | null

export function absoluteUrl(path: string) {
    return new URL(path, APP_URL).toString()
}

function isPrivateCalendar(calendar: CalendarSummary | null) {
    return Boolean(calendar && calendar.accessMode === "private")
}

function getCalendarVisibilityBadge(calendar: CalendarSummary | null) {
    return "캘린더"
    // return isPrivateCalendar(calendar) ? "비공개 캘린더" : "공개 캘린더"
}

function getEventStatusBadge(status: CalendarEvent["status"]) {
    switch (status) {
        case "scheduled":
            return "시작 전"
        case "in_progress":
            return "진행 중"
        case "completed":
            return "완료"
        case "cancelled":
            return "취소됨"
    }
}

function truncateText(value: string, maxLength: number) {
    if (value.length <= maxLength) {
        return value
    }

    return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function normalizeWhitespace(value: string) {
    return value.replace(/\s+/g, " ").trim()
}

function extractPlainText(value: unknown): string {
    if (typeof value === "string") {
        return value
    }

    if (Array.isArray(value)) {
        return value.map(extractPlainText).filter(Boolean).join(" ")
    }

    if (value && typeof value === "object") {
        return Object.entries(value)
            .filter(([key]) => !["id", "type", "props", "styles"].includes(key))
            .map(([, nestedValue]) => extractPlainText(nestedValue))
            .filter(Boolean)
            .join(" ")
    }

    return ""
}

export function getCalendarShareTitle(calendar: CalendarSummary | null) {
    if (!calendar) {
        return APP_NAME
    }

    return isPrivateCalendar(calendar) ? "캘린더" : calendar.name
}

export function getCalendarShareDescription(calendar: CalendarSummary | null) {
    if (!calendar) {
        return APP_DESCRIPTION
    }

    const subject = isPrivateCalendar(calendar) ? "" : `${calendar.name}의 `

    return `${subject}일정과 업데이트를 실시간으로 확인해 보세요.`
}

export function getEventShareTitle(
    event: CalendarEventShareData,
    calendar?: CalendarSummary | null
) {
    if (!event) {
        return calendar && !isPrivateCalendar(calendar)
            ? `${calendar.name} 일정`
            : APP_NAME
    }

    const title = event.title.trim() || "새 일정"
    return calendar && !isPrivateCalendar(calendar)
        ? `${title} | ${calendar.name}`
        : title
}

export function formatEventDateRange(event: CalendarEvent) {
    const timezone = event.timezone || "Asia/Seoul"
    const start = dayjs(event.start).tz(timezone)
    const end = dayjs(event.end).tz(timezone)

    if (event.allDay) {
        if (start.isSame(end, "day")) {
            return start.format("YYYY년 M월 D일")
        }

        return `${start.format("YYYY년 M월 D일")} - ${end.format(
            "YYYY년 M월 D일"
        )}`
    }

    if (start.isSame(end, "day")) {
        return `${start.format("YYYY년 M월 D일 HH:mm")} - ${end.format("HH:mm")}`
    }

    return `${start.format("YYYY년 M월 D일 HH:mm")} - ${end.format(
        "YYYY년 M월 D일 HH:mm"
    )}`
}

function formatEventDateRangeFromShareData(event: CalendarEventShareData) {
    if (!event) {
        return ""
    }

    const timezone = "timezone" in event ? event.timezone || "Asia/Seoul" : "Asia/Seoul"
    const start = dayjs(event.start).tz(timezone)
    const end = dayjs(event.end).tz(timezone)

    if ("allDay" in event && event.allDay) {
        if (start.isSame(end, "day")) {
            return start.format("YYYY년 M월 D일")
        }

        return `${start.format("YYYY년 M월 D일")} - ${end.format(
            "YYYY년 M월 D일"
        )}`
    }

    if (start.isSame(end, "day")) {
        return `${start.format("YYYY년 M월 D일 HH:mm")} - ${end.format("HH:mm")}`
    }

    return `${start.format("YYYY년 M월 D일 HH:mm")} - ${end.format(
        "YYYY년 M월 D일 HH:mm"
    )}`
}

export function getEventExcerpt(
    event: Pick<CalendarEvent, "content"> | Pick<CalendarEventMetadata, "content">
) {
    return truncateText(
        normalizeWhitespace(extractPlainText(event.content)),
        140
    )
}

export function getEventShareDescription(
    event: CalendarEventShareData,
    calendar: CalendarSummary | null
) {
    if (!event) {
        return getCalendarShareDescription(calendar)
    }

    const summary = [
        calendar && !isPrivateCalendar(calendar) ? calendar.name : null,
        formatEventDateRangeFromShareData(event),
        eventStatusLabel[event.status],
        event.author?.name ? `@${event.author.name}` : null,
    ]
        .filter(Boolean)
        .join(" · ")
    const excerpt =
        "content" in event && event.content ? getEventExcerpt(event) : ""

    return truncateText(
        excerpt ? `${summary}\n${excerpt}` : summary || APP_DESCRIPTION,
        200
    )
}

function buildBaseMetadata({
    title,
    description,
    url,
    imageUrl,
    imageAlt,
}: {
    title: string
    description: string
    url: string
    imageUrl: string
    imageAlt?: string
}): Metadata {
    const alt = imageAlt ?? APP_DEFAULT_IMAGE_ALT

    return {
        title,
        description,
        alternates: {
            canonical: url,
        },
        openGraph: {
            type: "website",
            locale: "ko_KR",
            siteName: APP_NAME,
            title,
            description,
            url,
            images: [
                {
                    url: imageUrl,
                    width: 1200,
                    height: 630,
                    alt,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [imageUrl],
        },
    }
}

export function buildCalendarMetadata({
    calendar,
    calendarId,
}: {
    calendar: CalendarSummary | null
    calendarId: string
}) {
    const title = getCalendarShareTitle(calendar)
    const description = getCalendarShareDescription(calendar)
    const url = absoluteUrl(`/calendar/${encodeURIComponent(calendarId)}`)
    const imageUrl = absoluteUrl(
        `/calendar/${encodeURIComponent(calendarId)}/opengraph-image`
    )

    return buildBaseMetadata({
        title,
        description,
        url,
        imageUrl,
        imageAlt: `${title} - ${APP_NAME}`,
    })
}

export function buildEventMetadata({
    calendar,
    calendarId,
    event,
    eventId,
    modal,
}: {
    calendar: CalendarSummary | null
    calendarId: string
    event: CalendarEventShareData
    eventId: string
    modal?: boolean
}) {
    const title = getEventShareTitle(event, calendar)
    const description = getEventShareDescription(event, calendar)
    const shareUrl = modal
        ? absoluteUrl(
              `/calendar/${encodeURIComponent(calendarId)}?e=${encodeURIComponent(
                  eventId
              )}`
          )
        : absoluteUrl(
              `/calendar/${encodeURIComponent(
                  calendarId
              )}/${encodeURIComponent(eventId)}`
          )
    const imageUrl = absoluteUrl(
        `/calendar/${encodeURIComponent(calendarId)}/${encodeURIComponent(eventId)}/opengraph-image`
    )

    return buildBaseMetadata({
        title,
        description,
        url: shareUrl,
        imageUrl,
        imageAlt: `${title} - ${APP_NAME}`,
    })
}

export function getCalendarOgImageData(calendar: CalendarSummary | null) {
    return {
        badge: getCalendarVisibilityBadge(calendar),
        title: calendar ? getCalendarShareTitle(calendar) : APP_NAME,
        description: getCalendarShareDescription(calendar),
    }
}

export function getEventOgImageData(
    calendar: CalendarSummary | null,
    event: CalendarEventShareData
) {
    return {
        badge: "일정",
        title: event?.title.trim() || "새 일정",
        description: event
            ? getEventShareDescription(event, calendar)
            : getCalendarShareDescription(calendar),
    }
}
