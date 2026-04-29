"use client"

import { defaultLocale, LOCALE_COOKIE, locales, type Locale } from "@/lib/i18n/config"
import enMessages from "@/messages/en.json"
import koMessages from "@/messages/ko.json"
import { NextIntlClientProvider } from "next-intl"
import { useRouter } from "next/navigation"
import {
    type ComponentProps,
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    useTransition,
    type ReactNode,
} from "react"

type IntlMessages = NonNullable<
    ComponentProps<typeof NextIntlClientProvider>["messages"]
>

const localeMessages: Record<Locale, IntlMessages> = {
    ko: koMessages,
    en: enMessages,
}

type LocaleContextValue = {
    locale: Locale
    switchLocale: (nextLocale: Locale) => void
    isPending: boolean
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({
    locale: initialLocale,
    messages: initialMessages,
    timeZone,
    children,
}: {
    locale: Locale
    messages: IntlMessages
    timeZone: string
    children: ReactNode
}) {
    const router = useRouter()
    const [locale, setLocale] = useState<Locale>(initialLocale)
    const [messages, setMessages] = useState<IntlMessages>(initialMessages)
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        setLocale(initialLocale)
        setMessages(initialMessages)
    }, [initialLocale, initialMessages])

    useEffect(() => {
        document.documentElement.lang = locale
    }, [locale])

    const value = useMemo<LocaleContextValue>(
        () => ({
            locale,
            switchLocale: (nextLocale) => {
                if (!locales.includes(nextLocale) || nextLocale === locale) {
                    return
                }

                const maxAge = 60 * 60 * 24 * 365
                const secure =
                    typeof window !== "undefined" &&
                    window.location.protocol === "https:"

                document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=${maxAge}; samesite=lax${secure ? "; secure" : ""}`
                document.documentElement.lang = nextLocale
                setLocale(nextLocale)
                setMessages(localeMessages[nextLocale] ?? localeMessages[defaultLocale])

                startTransition(() => {
                    router.refresh()
                })
            },
            isPending,
        }),
        [isPending, locale, router]
    )

    return (
        <LocaleContext.Provider value={value}>
            <NextIntlClientProvider
                locale={locale}
                messages={messages}
                timeZone={timeZone}
            >
                {children}
            </NextIntlClientProvider>
        </LocaleContext.Provider>
    )
}

export function useLocaleController() {
    const context = useContext(LocaleContext)

    if (!context) {
        throw new Error("useLocaleController must be used within a LocaleProvider.")
    }

    return context
}
