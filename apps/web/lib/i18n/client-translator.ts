import { LOCALE_COOKIE, defaultLocale, locales, type Locale } from "./config"
import { translateMessage } from "./messages"

function resolveClientLocale(): Locale {
    if (typeof document === "undefined") {
        return defaultLocale
    }

    const htmlLang = document.documentElement.lang as Locale

    if (locales.includes(htmlLang)) {
        return htmlLang
    }

    const cookieValue = document.cookie
        .split("; ")
        .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
        ?.split("=")[1] as Locale | undefined

    if (cookieValue && locales.includes(cookieValue)) {
        return cookieValue
    }

    return defaultLocale
}

export function tClient(
    key: string,
    params?: Record<string, string | number>
) {
    const locale = resolveClientLocale()
    return translateMessage(locale, key, params)
}
