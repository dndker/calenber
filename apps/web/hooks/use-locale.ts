"use client"

import { useLocaleController } from "@/components/provider/locale-provider"
import type { Locale } from "@/lib/i18n/config"

/**
 * 현재 locale 반환 + 언어 전환 함수를 제공하는 훅.
 *
 * 전환 방식: 클라이언트 번역 즉시 교체 → 쿠키 갱신 → router.refresh()
 * (URL prefix 없는 구조이므로 URL 변경 없이 언어만 바뀜)
 *
 * @example
 * const { currentLocale, switchLocale, isPending } = useLocaleSwitch()
 * switchLocale('en')
 */
export function useLocaleSwitch() {
    const { locale, switchLocale, isPending } = useLocaleController()

    return {
        currentLocale: locale as Locale,
        switchLocale,
        isPending,
    }
}
