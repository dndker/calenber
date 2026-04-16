function normalizeBase64(value: string) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
    const padding = normalized.length % 4

    if (padding === 0) {
        return normalized
    }

    return normalized.padEnd(normalized.length + (4 - padding), "=")
}

export function encodeConfirmValue(email: string) {
    if (typeof window === "undefined") {
        return Buffer.from(email, "utf8").toString("base64url")
    }

    return btoa(email)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "")
}

export function decodeConfirmValue(value: string) {
    try {
        const normalized = normalizeBase64(value)

        if (typeof window === "undefined") {
            return Buffer.from(normalized, "base64").toString("utf8")
        }

        return atob(normalized)
    } catch {
        return null
    }
}
