import { getRequestConfig } from "next-intl/server"
import { cookies, headers } from "next/headers"
import {
    defaultLocale,
    LOCALE_COOKIE,
    LOCALE_HEADER,
    locales,
    type Locale,
} from "./config"

export default getRequestConfig(async () => {
    const headerStore = await headers()
    const cookieStore = await cookies()

    const fromHeader = headerStore.get(LOCALE_HEADER) as Locale | null
    const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value as
        | Locale
        | undefined

    // proxy.ts가 주입한 헤더 우선 → 쿠키 → 기본값
    const locale: Locale =
        (fromHeader && locales.includes(fromHeader) ? fromHeader : null) ??
        (fromCookie && locales.includes(fromCookie) ? fromCookie : null) ??
        defaultLocale

    return {
        locale,
        messages: (await import(`../../messages/${locale}.json`)).default,
    }
})
