import { createServerClient } from "@supabase/ssr"
import type { EmailOtpType } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

function normalizeOtpType(type: string | null): EmailOtpType | null {
    if (!type) {
        return null
    }

    if (type === "signup" || type === "magiclink") {
        return "email"
    }

    return type as EmailOtpType
}

export async function GET(req: Request) {
    const requestUrl = new URL(req.url)
    const code = requestUrl.searchParams.get("code")
    const tokenHash =
        requestUrl.searchParams.get("token_hash") ??
        requestUrl.searchParams.get("token")
    const type = normalizeOtpType(requestUrl.searchParams.get("type"))
    const redirectTo = requestUrl.searchParams.get("redirect_to")
    const next =
        requestUrl.searchParams.get("next") ??
        (redirectTo
            ? new URL(redirectTo, requestUrl.origin).pathname +
              new URL(redirectTo, requestUrl.origin).search
            : "/signin")
    const cookieStore = await cookies()

    if (!code && (!tokenHash || !type)) {
        return NextResponse.redirect(
            new URL("/signin?error=invalid_confirmation_link", requestUrl.origin)
        )
    }

    const successUrl = new URL(next, requestUrl.origin)
    successUrl.searchParams.set("verified", "1")

    const response = NextResponse.redirect(successUrl)

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

    const { error } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.verifyOtp({
              type: type!,
              token_hash: tokenHash!,
          })

    if (error) {
        console.error("Supabase email confirm error:", error)

        if (error.code === "pkce_code_verifier_not_found") {
            const fallbackUrl = new URL("/signin", requestUrl.origin)
            fallbackUrl.searchParams.set("verified", "1")
            fallbackUrl.searchParams.set("notice", "email_confirmed_login_required")

            return NextResponse.redirect(fallbackUrl)
        }

        return NextResponse.redirect(
            new URL("/signin?error=email_verification_failed", requestUrl.origin)
        )
    }

    return response
}
