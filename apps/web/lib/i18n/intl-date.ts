import { defaultLocale, type Locale } from "./config"

export type LocaleInput = Locale | string | undefined

const intlLocaleMap: Record<Locale, string> = {
    ko: "ko-KR",
    en: "en-US",
}

function isLocale(value: string): value is Locale {
    return value === "ko" || value === "en"
}

export function normalizeLocale(locale: LocaleInput = defaultLocale): Locale {
    if (!locale) {
        return defaultLocale
    }

    const normalized = locale.toLowerCase()

    if (isLocale(normalized)) {
        return normalized
    }

    if (normalized.startsWith("ko")) {
        return "ko"
    }

    if (normalized.startsWith("en")) {
        return "en"
    }

    return defaultLocale
}

export function resolveIntlLocale(locale?: LocaleInput) {
    return intlLocaleMap[normalizeLocale(locale)]
}

export function formatIntlDate(
    value: Date | number | string,
    options: Intl.DateTimeFormatOptions & {
        locale?: LocaleInput
    }
) {
    const { locale, ...formatOptions } = options
    const date = value instanceof Date ? value : new Date(value)

    return new Intl.DateTimeFormat(
        resolveIntlLocale(locale),
        formatOptions
    ).format(date)
}
