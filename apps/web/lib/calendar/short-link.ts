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

function createCompactEventToken(eventId: string, modal: boolean) {
    if (isUuid(eventId)) {
        const suffix = modal ? "~" : ""
        return `${encodeBase64Url(uuidToBytes(eventId))}${suffix}`
    }

    const payload = JSON.stringify({
        e: eventId,
        m: modal ? 1 : 0,
    })

    return `j.${encodeBase64Url(encodeTextPayload(payload))}`
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
    if (calendarId !== "demo") {
        return createCompactEventToken(eventId, modal)
    }

    const payload = JSON.stringify({
        c: calendarId,
        e: eventId,
        m: modal ? 1 : 0,
    })

    return `j.${encodeBase64Url(encodeTextPayload(payload))}`
}

export function parseShortCalendarEventToken(token: string) {
    if (!token.includes(".")) {
        try {
            const modal = token.endsWith("~")
            const value = modal ? token.slice(0, -1) : token
            const bytes = decodeBase64Url(value)

            if (bytes.length !== 16) {
                return null
            }

            return {
                eventId: bytesToUuid(bytes, 0),
                modal,
            }
        } catch {
            return null
        }
    }

    const [version, payload] = token.split(".", 2)

    if (!version || !payload) {
        return null
    }

    try {
        if (version === "u") {
            const bytes = decodeBase64Url(payload)

            if (bytes.length !== 33) {
                return null
            }

            return {
                eventId: bytesToUuid(bytes, 17),
                modal: bytes[0] === 1,
                calendarId: bytesToUuid(bytes, 1),
            }
        }

        if (version === "j") {
            const parsed = JSON.parse(
                decodeTextPayload(decodeBase64Url(payload))
            )

            if (!parsed || typeof parsed.e !== "string") {
                return null
            }

            return {
                eventId: parsed.e,
                modal: parsed.m === 1,
                ...(typeof parsed.c === "string"
                    ? { calendarId: parsed.c }
                    : {}),
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
