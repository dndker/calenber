import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import {
    defaultLocale,
    LOCALE_COOKIE,
    LOCALE_HEADER,
    locales,
    type Locale,
} from "@/lib/i18n/config"
import {
    getRecentCalendarIdFromPathname,
    getRecentCalendarPathFromCookieValue,
    RECENT_CALENDAR_COOKIE_MAX_AGE,
    RECENT_CALENDAR_COOKIE_NAME,
} from "@/lib/calendar/recent-calendar-cookie"

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

function applyLocaleHeadersAndCookie(
    response: NextResponse,
    locale: Locale,
    hasValidLocaleCookie: boolean
) {
    response.headers.set(LOCALE_HEADER, locale)

    if (!hasValidLocaleCookie) {
        response.cookies.set(LOCALE_COOKIE, locale, {
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        })
    }

    return response
}

function hasSupabaseAuthCookie(request: NextRequest) {
    return request.cookies
        .getAll()
        .some(
            (cookie) =>
                cookie.name.startsWith("sb-") &&
                cookie.name.includes("auth-token")
        )
}

export async function proxy(request: NextRequest) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value as
        | Locale
        | undefined
    const validCookieLocale =
        cookieLocale && locales.includes(cookieLocale) ? cookieLocale : null
    const locale: Locale =
        validCookieLocale ??
        detectLocaleFromAcceptLanguage(
            request.headers.get("Accept-Language")
        )
    const recentCalendarPath = getRecentCalendarPathFromCookieValue(
        request.cookies.get(RECENT_CALENDAR_COOKIE_NAME)?.value
    )

    if (
        recentCalendarPath &&
        (request.nextUrl.pathname === "/" || request.nextUrl.pathname === "/calendar")
    ) {
        return applyLocaleHeadersAndCookie(
            NextResponse.redirect(new URL(recentCalendarPath, request.url)),
            locale,
            Boolean(validCookieLocale)
        )
    }

    if (request.nextUrl.pathname === "/") {
        return applyLocaleHeadersAndCookie(
            NextResponse.redirect(new URL("/calendar", request.url)),
            locale,
            Boolean(validCookieLocale)
        )
    }

    const response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const recentCalendarId = getRecentCalendarIdFromPathname(
        request.nextUrl.pathname
    )

    if (recentCalendarId) {
        response.cookies.set(RECENT_CALENDAR_COOKIE_NAME, recentCalendarId, {
            path: "/",
            maxAge: RECENT_CALENDAR_COOKIE_MAX_AGE,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        })
    }

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

    if (hasSupabaseAuthCookie(request)) {
        await supabase.auth.getUser()
    }

    return applyLocaleHeadersAndCookie(
        response,
        locale,
        Boolean(validCookieLocale)
    )
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
}
