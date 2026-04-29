export const locales = ["ko", "en"] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "ko"

/** 쿠키 키 — theme 쿠키와 동일 패턴 */
export const LOCALE_COOKIE = "locale"

/** middleware → request.ts 전달용 요청 헤더 키 */
export const LOCALE_HEADER = "x-locale"

/** OG locale 매핑 */
export const ogLocaleMap: Record<Locale, string> = {
    ko: "ko_KR",
    en: "en_US",
}
