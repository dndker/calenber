import {
    getCalendarEventModalPath,
    getCalendarEventPagePath,
} from "@/lib/calendar/routes"

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string) {
    return UUID_PATTERN.test(value)
}

function encodeBase64Url(bytes: Uint8Array) {
    if (typeof Buffer !== "undefined") {
        return Buffer.from(bytes)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/g, "")
    }

    let binary = ""

    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte)
    })

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "")
}

function decodeBase64Url(value: string) {
    if (typeof Buffer !== "undefined") {
        const normalized = value
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(Math.ceil(value.length / 4) * 4, "=")

        return new Uint8Array(Buffer.from(normalized, "base64"))
    }

    const normalized = value
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(value.length / 4) * 4, "=")
    const binary = atob(normalized)
    const bytes = new Uint8Array(binary.length)

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
    }

    return bytes
}

function uuidToBytes(uuid: string) {
    const hex = uuid.replace(/-/g, "")
    const bytes = new Uint8Array(16)

    for (let index = 0; index < 16; index += 1) {
        bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
    }

    return bytes
}

function bytesToUuid(bytes: Uint8Array, offset: number) {
    const hex = Array.from(bytes.slice(offset, offset + 16), (value) =>
        value.toString(16).padStart(2, "0")
    ).join("")

    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
    ].join("-")
}

function encodeTextPayload(value: string) {
    return new TextEncoder().encode(value)
}

function decodeTextPayload(bytes: Uint8Array) {
    return new TextDecoder().decode(bytes)
}

const TOKEN_MAGIC = 0x8f
const TOKEN_VERSION = 1
const FLAG_MODAL = 1 << 0
const FLAG_HAS_CALENDAR = 1 << 1
const FLAG_EVENT_UUID = 1 << 2
const FLAG_CALENDAR_UUID = 1 << 3

function pushTextPayload(target: number[], value: string) {
    const bytes = encodeTextPayload(value)

    if (bytes.length > 0xffff) {
        throw new Error("Token payload too large")
    }

    target.push((bytes.length >> 8) & 0xff, bytes.length & 0xff, ...bytes)
}

function readTextPayload(bytes: Uint8Array, cursor: number) {
    const high = bytes[cursor]
    const low = bytes[cursor + 1]

    if (high === undefined || low === undefined) {
        return null
    }

    const length = (high << 8) | low
    const start = cursor + 2
    const end = start + length

    if (end > bytes.length) {
        return null
    }

    return {
        value: decodeTextPayload(bytes.slice(start, end)),
        next: end,
    }
}

function pushIdPayload(target: number[], value: string, asUuid: boolean) {
    if (asUuid) {
        target.push(...uuidToBytes(value))
        return
    }

    pushTextPayload(target, value)
}

function readIdPayload(bytes: Uint8Array, cursor: number, asUuid: boolean) {
    if (asUuid) {
        const end = cursor + 16

        if (end > bytes.length) {
            return null
        }

        return {
            value: bytesToUuid(bytes, cursor),
            next: end,
        }
    }

    return readTextPayload(bytes, cursor)
}

function createCompactEventToken(eventId: string, modal: boolean) {
    const eventIsUuid = isUuid(eventId)
    const flags = (modal ? FLAG_MODAL : 0) | (eventIsUuid ? FLAG_EVENT_UUID : 0)
    const body: number[] = [TOKEN_MAGIC, TOKEN_VERSION, flags]

    pushIdPayload(body, eventId, eventIsUuid)

    return encodeBase64Url(Uint8Array.from(body))
}

export function createShortCalendarEventToken({
    calendarId,
    eventId,
    modal = false,
}: {
    calendarId: string
    eventId: string
    modal?: boolean
}) {
    const normalizedCalendarId = calendarId.trim()
    const eventIsUuid = isUuid(eventId)
    const calendarIsUuid =
        normalizedCalendarId !== "demo" && isUuid(normalizedCalendarId)
    const flags =
        (modal ? FLAG_MODAL : 0) |
        FLAG_HAS_CALENDAR |
        (eventIsUuid ? FLAG_EVENT_UUID : 0) |
        (calendarIsUuid ? FLAG_CALENDAR_UUID : 0)
    const body: number[] = [TOKEN_MAGIC, TOKEN_VERSION, flags]

    pushIdPayload(body, normalizedCalendarId, calendarIsUuid)
    pushIdPayload(body, eventId, eventIsUuid)

    return encodeBase64Url(Uint8Array.from(body))
}

export function parseShortCalendarEventToken(token: string) {
    // 레거시 호환: 과거 16-byte UUID 전용 토큰
    if (!token.includes(".")) {
        try {
            const modal = token.endsWith("~")
            const value = modal ? token.slice(0, -1) : token
            const bytes = decodeBase64Url(value)

            if (bytes.length === 16) {
                return {
                    eventId: bytesToUuid(bytes, 0),
                    modal,
                }
            }
        } catch {
            // no-op
        }
    }

    try {
        const bytes = decodeBase64Url(token)

        if (bytes.length >= 3 && bytes[0] === TOKEN_MAGIC && bytes[1] === TOKEN_VERSION) {
            const flags = bytes[2] ?? 0
            const modal = (flags & FLAG_MODAL) !== 0
            const hasCalendar = (flags & FLAG_HAS_CALENDAR) !== 0
            const eventIsUuid = (flags & FLAG_EVENT_UUID) !== 0
            const calendarIsUuid = (flags & FLAG_CALENDAR_UUID) !== 0
            let cursor = 3
            let calendarId: string | undefined

            if (hasCalendar) {
                const parsedCalendar = readIdPayload(bytes, cursor, calendarIsUuid)

                if (!parsedCalendar) {
                    return null
                }

                calendarId = parsedCalendar.value
                cursor = parsedCalendar.next
            }

            const parsedEvent = readIdPayload(bytes, cursor, eventIsUuid)

            if (!parsedEvent || parsedEvent.next !== bytes.length) {
                return null
            }

            return {
                eventId: parsedEvent.value,
                modal,
                ...(calendarId ? { calendarId } : {}),
            }
        }
    } catch {
        // no-op
    }

    // 레거시 호환: JSON(j.) 기반 토큰
    const [version, payload] = token.split(".", 2)

    if (!version || !payload) {
        return null
    }

    try {
        if (version === "j") {
            const parsed = JSON.parse(decodeTextPayload(decodeBase64Url(payload)))

            if (!parsed || typeof parsed.e !== "string") {
                return null
            }

            return {
                eventId: parsed.e,
                modal: parsed.m === 1,
                ...(typeof parsed.c === "string" ? { calendarId: parsed.c } : {}),
            }
        }
    } catch {
        return null
    }

    return null
}

export function getShortCalendarEventPath(
    calendarId: string,
    eventId: string,
    options?: { modal?: boolean }
) {
    const token = createShortCalendarEventToken({
        calendarId,
        eventId,
        modal: options?.modal,
    })

    return `/s/${token}`
}

export function getResolvedShortCalendarEventPath(params: {
    calendarId: string
    eventId: string
    modal?: boolean
}) {
    return params.modal
        ? getCalendarEventModalPath(params.calendarId, params.eventId)
        : getCalendarEventPagePath(params.calendarId, params.eventId)
}
