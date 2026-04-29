import {
    APP_DEFAULT_IMAGE_ALT,
    APP_DESCRIPTION,
    APP_NAME,
    APP_URL,
} from "@/lib/app-config"
import { defaultLocale, type Locale } from "@/lib/i18n/config"
import { getMessageTranslator } from "@/lib/i18n/messages"
import { getDefaultCalendarEventFieldSettings } from "@/lib/calendar/event-field-settings"
import { DEFAULT_CALENDAR_LAYOUT_OPTIONS } from "@/lib/calendar/layout-options"
import type { CalendarSummary } from "@/lib/calendar/queries"
import dayjs from "@/lib/dayjs"
import {
    eventStatusTranslationKey,
    type CalendarEvent,
} from "@/store/calendar-store.types"
import type { Metadata } from "next"
import type { CalendarEventMetadata } from "./queries"

export const demoCalendarSummary: CalendarSummary = {
    id: "demo",
    name: getMessageTranslator(defaultLocale)("calendar.meta.demoName"),
    avatarUrl: null,
    accessMode: "public_open",
    eventLayout: "compact",
    eventFieldSettings: getDefaultCalendarEventFieldSettings(),
    layoutOptions: DEFAULT_CALENDAR_LAYOUT_OPTIONS,
    updatedAt: "",
    createdAt: "",
}

type CalendarEventShareData =
    | CalendarEvent
    | CalendarEventMetadata
    | null

function formatDateTime(
    date: dayjs.Dayjs,
    locale: Locale,
    options: Intl.DateTimeFormatOptions
) {
    return new Intl.DateTimeFormat(locale, options).format(date.toDate())
}

export function absoluteUrl(path: string) {
    return new URL(path, APP_URL).toString()
}

function isPrivateCalendar(calendar: CalendarSummary | null) {
    return Boolean(calendar && calendar.accessMode === "private")
}

function getCalendarVisibilityBadge(
    calendar: CalendarSummary | null,
    locale: Locale = defaultLocale
) {
    return getMessageTranslator(locale)("calendar.meta.badge")
    // return isPrivateCalendar(calendar) ? "비공개 캘린더" : "공개 캘린더"
}

function getEventStatusBadge(
    status: CalendarEvent["status"],
    locale: Locale = defaultLocale
) {
    const t = getMessageTranslator(locale)
    return t(`event.status.${eventStatusTranslationKey[status]}`)
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

export function getCalendarShareTitle(
    calendar: CalendarSummary | null,
    locale: Locale = defaultLocale
) {
    if (!calendar) {
        return APP_NAME
    }

    return isPrivateCalendar(calendar)
        ? getMessageTranslator(locale)("calendar.meta.title")
        : calendar.name
}

export function getCalendarShareDescription(
    calendar: CalendarSummary | null,
    locale: Locale = defaultLocale
) {
    const t = getMessageTranslator(locale)

    if (!calendar) {
        return APP_DESCRIPTION
    }

    return isPrivateCalendar(calendar)
        ? t("calendar.meta.shareDescription")
        : t("calendar.meta.shareDescriptionWithName", { name: calendar.name })
}

export function getEventShareTitle(
    event: CalendarEventShareData,
    calendar?: CalendarSummary | null,
    locale: Locale = defaultLocale
) {
    if (!event) {
        return calendar && !isPrivateCalendar(calendar)
            ? getMessageTranslator(locale)("calendar.meta.calendarEvents", {
                  name: calendar.name,
              })
            : APP_NAME
    }

    const title =
        event.title.trim() ||
        getMessageTranslator(locale)("common.labels.newEvent")
    return calendar && !isPrivateCalendar(calendar)
        ? `${title} | ${calendar.name}`
        : title
}

export function formatEventDateRange(
    event: CalendarEvent,
    locale: Locale = defaultLocale
) {
    const timezone = event.timezone || "Asia/Seoul"
    const start = dayjs(event.start).tz(timezone)
    const end = dayjs(event.end).tz(timezone)

    if (event.allDay) {
        if (start.isSame(end, "day")) {
            return formatDateTime(start, locale, {
                year: "numeric",
                month: "long",
                day: "numeric",
            })
        }

        return `${formatDateTime(start, locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
        })} - ${formatDateTime(end, locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
        })}`
    }

    if (start.isSame(end, "day")) {
        return `${formatDateTime(start, locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })} - ${formatDateTime(end, locale, {
            hour: "2-digit",
            minute: "2-digit",
        })}`
    }

    return `${formatDateTime(start, locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })} - ${formatDateTime(end, locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })}`
}

function formatEventDateRangeFromShareData(
    event: CalendarEventShareData,
    locale: Locale = defaultLocale
) {
    if (!event) {
        return ""
    }

    const timezone = "timezone" in event ? event.timezone || "Asia/Seoul" : "Asia/Seoul"
    const start = dayjs(event.start).tz(timezone)
    const end = dayjs(event.end).tz(timezone)

    if ("allDay" in event && event.allDay) {
        if (start.isSame(end, "day")) {
            return formatDateTime(start, locale, {
                year: "numeric",
                month: "long",
                day: "numeric",
            })
        }

        return `${formatDateTime(start, locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
        })} - ${formatDateTime(end, locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
        })}`
    }

    if (start.isSame(end, "day")) {
        return `${formatDateTime(start, locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })} - ${formatDateTime(end, locale, {
            hour: "2-digit",
            minute: "2-digit",
        })}`
    }

    return `${formatDateTime(start, locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })} - ${formatDateTime(end, locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })}`
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
    calendar: CalendarSummary | null,
    locale: Locale = defaultLocale
) {
    if (!event) {
        return getCalendarShareDescription(calendar, locale)
    }

    const summary = [
        calendar && !isPrivateCalendar(calendar) ? calendar.name : null,
        formatEventDateRangeFromShareData(event, locale),
        getEventStatusBadge(event.status, locale),
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
    locale = defaultLocale,
}: {
    calendar: CalendarSummary | null
    calendarId: string
    locale?: Locale
}) {
    const title = getCalendarShareTitle(calendar, locale)
    const description = getCalendarShareDescription(calendar, locale)
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
    locale = defaultLocale,
}: {
    calendar: CalendarSummary | null
    calendarId: string
    event: CalendarEventShareData
    eventId: string
    modal?: boolean
    locale?: Locale
}) {
    const title = getEventShareTitle(event, calendar, locale)
    const description = getEventShareDescription(event, calendar, locale)
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

export function getCalendarOgImageData(
    calendar: CalendarSummary | null,
    locale: Locale = defaultLocale
) {
    return {
        badge: getCalendarVisibilityBadge(calendar, locale),
        title: calendar ? getCalendarShareTitle(calendar, locale) : APP_NAME,
        description: getCalendarShareDescription(calendar, locale),
    }
}

export function getEventOgImageData(
    calendar: CalendarSummary | null,
    event: CalendarEventShareData,
    locale: Locale = defaultLocale
) {
    return {
        badge: getMessageTranslator(locale)("event.dialog.title"),
        title:
            event?.title.trim() ||
            getMessageTranslator(locale)("common.labels.newEvent"),
        description: event
            ? getEventShareDescription(event, calendar, locale)
            : getCalendarShareDescription(calendar, locale),
    }
}
