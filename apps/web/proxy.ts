import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import {
    defaultLocale,
    LOCALE_COOKIE,
    LOCALE_HEADER,
    locales,
    type Locale,
} from "@/lib/i18n/config"

/**
 * Accept-Language 헤더에서 지원 locale 추출.
 * ko/ko-KR → 'ko', 나머지 → 'en'
 */
function detectLocaleFromAcceptLanguage(
    acceptLanguage: string | null
): Locale {
    if (!acceptLanguage) return defaultLocale
    const preferred = acceptLanguage.split(",")[0]?.trim().toLowerCase() ?? ""
    if (preferred.startsWith("ko")) return "ko"
    return "en"
}

export async function proxy(request: NextRequest) {
    const response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // ── Supabase auth ────────────────────────────────────────────
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value)
                        response.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    await supabase.auth.getUser()

    // ── Locale 감지 ──────────────────────────────────────────────
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value as
        | Locale
        | undefined
    const validCookieLocale =
        cookieLocale && locales.includes(cookieLocale) ? cookieLocale : null

    // 쿠키 있으면 그대로, 없으면 Accept-Language → 기본값 순으로 결정
    const locale: Locale =
        validCookieLocale ??
        detectLocaleFromAcceptLanguage(
            request.headers.get("Accept-Language")
        )

    // getRequestConfig(request.ts)가 읽을 요청 헤더에 locale 주입
    response.headers.set(LOCALE_HEADER, locale)

    // 쿠키가 없었으면 새로 심기 (이후 요청부터 쿠키 기준으로 동작)
    if (!validCookieLocale) {
        response.cookies.set(LOCALE_COOKIE, locale, {
            path: "/",
            maxAge: 60 * 60 * 24 * 365, // 1년
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        })
    }

    return response
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
}
