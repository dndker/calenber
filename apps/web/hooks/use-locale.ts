"use client"

import { LOCALE_COOKIE, locales, type Locale } from "@/lib/i18n/config"
import { useLocale } from "next-intl"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

/**
 * 현재 locale 반환 + 언어 전환 함수를 제공하는 훅.
 *
 * 전환 방식: 쿠키 갱신 → router.refresh() → 서버 컴포넌트 재렌더
 * (URL prefix 없는 구조이므로 URL 변경 없이 언어만 바뀜)
 *
 * @example
 * const { currentLocale, switchLocale, isPending } = useLocaleSwitch()
 * switchLocale('en')
 */
export function useLocaleSwitch() {
    const currentLocale = useLocale() as Locale
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    function switchLocale(next: Locale) {
        if (!locales.includes(next) || next === currentLocale) return

        // 1년 만료 쿠키 갱신
        const maxAge = 60 * 60 * 24 * 365
        const secure =
            typeof window !== "undefined" &&
            window.location.protocol === "https:"
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${maxAge}; samesite=lax${secure ? "; secure" : ""}`

        // 서버 컴포넌트 재렌더 (소프트 리프레시)
        startTransition(() => router.refresh())
    }

    return { currentLocale, switchLocale, isPending }
}
