"use client"

import { useEffect } from "react"

const IS_DEBUG =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_I18N_DEBUG === "true"

/**
 * dev 전용: data-i18n-key 속성이 있는 엘리먼트에 호버 시
 * 번역키를 툴팁으로 표시. NEXT_PUBLIC_I18N_DEBUG=true 로 활성화.
 *
 * 사용법:
 *   <span data-i18n-key="event.form.title">{t('title')}</span>
 *   또는 debugAttr('event.form', 'title') 헬퍼 사용
 */
export function I18nDebugProvider() {
    useEffect(() => {
        if (!IS_DEBUG) return

        const tooltip = document.createElement("div")
        tooltip.id = "__i18n_debug_tooltip"
        Object.assign(tooltip.style, {
            position: "fixed",
            zIndex: "99999",
            pointerEvents: "none",
            background: "#1e1e2e",
            color: "#cba6f7",
            fontFamily: "monospace",
            fontSize: "11px",
            padding: "3px 8px",
            borderRadius: "4px",
            border: "1px solid #6c6f8550",
            whiteSpace: "nowrap",
            display: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        })
        document.body.appendChild(tooltip)

        function show(e: MouseEvent) {
            const el = (e.target as HTMLElement).closest("[data-i18n-key]")
            if (!el) {
                tooltip.style.display = "none"
                return
            }
            tooltip.textContent =
                (el as HTMLElement).dataset.i18nKey ?? ""
            tooltip.style.display = "block"
            tooltip.style.left = `${e.clientX + 14}px`
            tooltip.style.top = `${e.clientY - 10}px`
        }

        function move(e: MouseEvent) {
            tooltip.style.left = `${e.clientX + 14}px`
            tooltip.style.top = `${e.clientY - 10}px`
        }

        function hide() {
            tooltip.style.display = "none"
        }

        document.addEventListener("mouseover", show)
        document.addEventListener("mousemove", move)
        document.addEventListener("mouseout", hide)

        return () => {
            document.removeEventListener("mouseover", show)
            document.removeEventListener("mousemove", move)
            document.removeEventListener("mouseout", hide)
            tooltip.remove()
        }
    }, [])

    return null
}

/**
 * dev 환경에서 번역키를 data 속성으로 주입하는 헬퍼.
 * prod에서는 빈 객체를 반환해 DOM 오염 없음.
 *
 * @example
 * <span {...debugAttr('event.form', 'title')}>{t('title')}</span>
 * // dev → <span data-i18n-key="event.form.title">...</span>
 * // prod → <span>...</span>
 */
export function debugAttr(namespace: string, key: string) {
    if (!IS_DEBUG) return {}
    return { "data-i18n-key": `${namespace}.${key}` }
}
