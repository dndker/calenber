import { resolveServerCalendarPath } from "@/lib/calendar/resolve-server-calendar-path"
import { createServerClient } from "@supabase/ssr"
import { getTranslations } from "next-intl/server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getSupabaseAuthErrorMessage } from "@/lib/auth/supabase-error"

function buildPopupResponse({
    origin,
    next,
    ok,
    error,
}: {
    origin: string
    next: string
    ok: boolean
    error?: string
}) {
    const payload = JSON.stringify({
        type: "google-auth-complete",
        ok,
        next,
        error: error ?? null,
    })

    return new NextResponse(
        `<!doctype html>
<html>
  <body>
    <script>
      const payload = ${payload};
      if (window.opener) {
        window.opener.postMessage(payload, ${JSON.stringify(origin)});
        window.close();
      } else {
        window.location.replace(payload.next);
      }
    </script>
  </body>
</html>`,
        {
            headers: {
                "content-type": "text/html; charset=utf-8",
                "cache-control": "no-store",
            },
        }
    )
}

export async function GET(req: Request) {
    const t = await getTranslations("auth.toast")
    const tError = await getTranslations("auth.errors")
    const requestUrl = new URL(req.url)
    const code = requestUrl.searchParams.get("code")
    const next = requestUrl.searchParams.get("next") ?? "/"
    const oauthError =
        requestUrl.searchParams.get("error_description") ??
        requestUrl.searchParams.get("error_code") ??
        requestUrl.searchParams.get("error")
    const cookieStore = await cookies()

    if (!code) {
        if (oauthError) {
            console.error("Supabase auth callback missing code:", {
                error: requestUrl.searchParams.get("error"),
                errorCode: requestUrl.searchParams.get("error_code"),
                errorDescription:
                    requestUrl.searchParams.get("error_description"),
                url: req.url,
            })
        }

        return buildPopupResponse({
            origin: requestUrl.origin,
            next,
            ok: false,
            error: oauthError ?? t("callbackMissingCode"),
        })
    }

    const response = buildPopupResponse({
        origin: requestUrl.origin,
        next,
        ok: true,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options)
                        response.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
        console.error("Supabase auth callback error:", error)

        return buildPopupResponse({
            origin: requestUrl.origin,
            next,
            ok: false,
            error: getSupabaseAuthErrorMessage(error, tError, "callbackFailed"),
        })
    }

    const {
        data: { user },
    } = await supabase.auth.getUser()
    const resolvedNext = await resolveServerCalendarPath({
        supabase,
        userId: user?.id,
        cookieStore,
        fallbackPath: next,
    })

    const finalResponse = buildPopupResponse({
        origin: requestUrl.origin,
        next: resolvedNext,
        ok: true,
    })

    response.cookies.getAll().forEach((cookie) => {
        finalResponse.cookies.set(cookie)
    })

    return finalResponse
}
