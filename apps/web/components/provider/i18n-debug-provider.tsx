"use client"

import { useTranslations } from "next-intl"
import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react"

const IS_DEBUG =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_I18N_DEBUG === "true"

const I18nDebugRevealContext = createContext(false)

/**
 * dev + NEXT_PUBLIC_I18N_DEBUG=true 일 때만 동작.
 * ⌘(Mac·iOS) 또는 Alt(Windows·Linux 등)를 누르고 있는 동안
 * `useDebugTranslations`는 `namespace.key` 형태를 반환한다.
 * 평소에는 일반 번역 문자열만 반환한다.
 */
export function I18nDebugProvider({ children }: { children: ReactNode }) {
    const [revealKeys, setRevealKeys] = useState(false)

    useEffect(() => {
        if (!IS_DEBUG) return

        const useMeta =
            typeof navigator !== "undefined" &&
            /Mac|iPhone|iPad|iPod/i.test(navigator.platform)

        const isRevealModifier = (e: KeyboardEvent) =>
            useMeta
                ? e.key === "Meta" ||
                  e.code === "MetaLeft" ||
                  e.code === "MetaRight"
                : e.key === "Alt" ||
                  e.code === "AltLeft" ||
                  e.code === "AltRight"

        const onKeyDown = (e: KeyboardEvent) => {
            if (isRevealModifier(e)) setRevealKeys(true)
        }
        const onKeyUp = (e: KeyboardEvent) => {
            if (isRevealModifier(e)) setRevealKeys(false)
        }
        const reset = () => setRevealKeys(false)
        const onVisibility = () => {
            if (document.visibilityState === "hidden") reset()
        }

        window.addEventListener("keydown", onKeyDown)
        window.addEventListener("keyup", onKeyUp)
        window.addEventListener("blur", reset)
        document.addEventListener("visibilitychange", onVisibility)

        return () => {
            window.removeEventListener("keydown", onKeyDown)
            window.removeEventListener("keyup", onKeyUp)
            window.removeEventListener("blur", reset)
            document.removeEventListener("visibilitychange", onVisibility)
        }
    }, [])

    if (!IS_DEBUG) {
        return children
    }

    return (
        <I18nDebugRevealContext.Provider value={revealKeys}>
            {children}
        </I18nDebugRevealContext.Provider>
    )
}

/**
 * dev에서만 `I18nDebugProvider`와 함께 쓰면, ⌘/Alt 홀드 시 `namespace.key`를 반환.
 * prod에서는 `useTranslations`와 동일하게 동작.
 *
 * @example
 * const t = useDebugTranslations("event.form")
 * t("titlePlaceholder") // → 평소: 번역문, ⌘/Alt 누름: "event.form.titlePlaceholder"
 */
export function useDebugTranslations(namespace: string) {
    const t = useTranslations(namespace)
    const revealKeys = useContext(I18nDebugRevealContext)

    return (key: string, values?: Parameters<typeof t>[1]) => {
        if (IS_DEBUG && revealKeys) {
            return `${namespace}.${key}`
        }
        return t(key, values)
    }
}
