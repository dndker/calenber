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

function encodeTextPayload(value: string) {
    return new TextEncoder().encode(value)
}

function decodeTextPayload(bytes: Uint8Array) {
    return new TextDecoder().decode(bytes)
}

const CALENDAR_TOKEN_MAGIC = 0xa7
const CALENDAR_TOKEN_VERSION = 1
const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string) {
    return UUID_PATTERN.test(value)
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

export function resolveCalendarIdFromPathParam(calendarIdParam: string) {
    if (calendarIdParam === "demo") {
        return "demo"
    }

    if (calendarIdParam.includes(".")) {
        // 레거시 호환: j.<base64json>
        if (!calendarIdParam.startsWith("j.")) {
            return calendarIdParam
        }

        try {
            const parsed = JSON.parse(
                decodeTextPayload(decodeBase64Url(calendarIdParam.slice(2)))
            )

            if (parsed && typeof parsed.c === "string") {
                return parsed.c
            }
        } catch {
            return calendarIdParam
        }

        return calendarIdParam
    }

    try {
        const bytes = decodeBase64Url(calendarIdParam)

        if (bytes.length === 18 && bytes[0] === CALENDAR_TOKEN_MAGIC && bytes[1] === CALENDAR_TOKEN_VERSION) {
            return bytesToUuid(bytes, 2)
        }

        if (bytes.length > 4 && bytes[0] === CALENDAR_TOKEN_MAGIC && bytes[1] === CALENDAR_TOKEN_VERSION) {
            const length = ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0)
            const start = 4
            const end = start + length

            if (end === bytes.length) {
                return decodeTextPayload(bytes.slice(start, end))
            }
        }
    } catch {
        return calendarIdParam
    }

    return calendarIdParam
}

export function encodeCalendarIdForPath(calendarId: string) {
    const resolvedCalendarId = resolveCalendarIdFromPathParam(calendarId)

    if (resolvedCalendarId === "demo") {
        return "demo"
    }

    if (isUuid(resolvedCalendarId)) {
        const bytes = new Uint8Array(18)
        bytes[0] = CALENDAR_TOKEN_MAGIC
        bytes[1] = CALENDAR_TOKEN_VERSION
        bytes.set(uuidToBytes(resolvedCalendarId), 2)
        return encodeBase64Url(bytes)
    }

    const payload = encodeTextPayload(resolvedCalendarId)

    if (payload.length > 0xffff) {
        return resolvedCalendarId
    }

    const bytes = new Uint8Array(payload.length + 4)
    bytes[0] = CALENDAR_TOKEN_MAGIC
    bytes[1] = CALENDAR_TOKEN_VERSION
    bytes[2] = (payload.length >> 8) & 0xff
    bytes[3] = payload.length & 0xff
    bytes.set(payload, 4)
    return encodeBase64Url(bytes)
}

import { createShortCalendarEventToken } from "./short-link"

export function getCalendarPath(calendarId: string) {
    return `/calendar/${encodeCalendarIdForPath(calendarId)}`
}

export function getCalendarEventModalPath(calendarId: string, eventId: string) {
    return `${getCalendarPath(calendarId)}?e=${encodeURIComponent(eventId)}`
}

export function getCalendarEventPagePath(calendarId: string, eventId: string) {
    const token = createShortCalendarEventToken({
        calendarId,
        eventId,
        modal: false,
    })

    return `${getCalendarPath(calendarId)}/${encodeURIComponent(token)}`
}

export function getCalendarBasePath(pathname: string) {
    if (pathname.startsWith("/calendar/")) {
        const [, , calendarId] = pathname.split("/")

        if (calendarId) {
            return getCalendarPath(calendarId)
        }
    }

    return getCalendarPath("demo")
}
