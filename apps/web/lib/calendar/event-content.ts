import type { CalendarEvent } from "@/store/useCalendarStore"

type StoredEventContent = CalendarEvent["content"] | string | null

const defaultEventContent: CalendarEvent["content"] = [
    {
        type: "paragraph",
        content: [],
    },
]

export function parseEventContent(
    content: StoredEventContent
): CalendarEvent["content"] {
    if (!content) {
        return defaultEventContent
    }

    if (Array.isArray(content)) {
        return content as CalendarEvent["content"]
    }

    try {
        const parsed = JSON.parse(content)

        if (Array.isArray(parsed)) {
            return parsed as CalendarEvent["content"]
        }
    } catch {
        // 기존 plain text 데이터와의 호환을 위해 fallback 합니다.
    }

    return [
        {
            type: "paragraph",
            content: [content],
        },
    ]
}

export function serializeEventContent(content: CalendarEvent["content"]) {
    return content ?? defaultEventContent
}
