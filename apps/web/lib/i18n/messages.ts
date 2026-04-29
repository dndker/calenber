import enMessages from "@/messages/en.json"
import koMessages from "@/messages/ko.json"
import { defaultLocale, type Locale } from "./config"

type MessageCatalog = typeof koMessages

const messageMap: Record<Locale, MessageCatalog> = {
    ko: koMessages,
    en: enMessages,
}

function resolveMessage(
    messages: Record<string, unknown>,
    key: string
): unknown {
    return key.split(".").reduce<unknown>((current, segment) => {
        if (!current || typeof current !== "object") {
            return undefined
        }

        return (current as Record<string, unknown>)[segment]
    }, messages)
}

function interpolate(value: string, params?: Record<string, string | number>) {
    if (!params) {
        return value
    }

    return value.replace(/\{(\w+)\}/g, (_, key: string) => {
        const param = params[key]
        return param == null ? `{${key}}` : String(param)
    })
}

export function translateMessage(
    locale: Locale = defaultLocale,
    key: string,
    params?: Record<string, string | number>
) {
    const message = resolveMessage(messageMap[locale], key)

    if (typeof message !== "string") {
        return key
    }

    return interpolate(message, params)
}

export function getMessageTranslator(locale: Locale = defaultLocale) {
    return (key: string, params?: Record<string, string | number>) =>
        translateMessage(locale, key, params)
}
