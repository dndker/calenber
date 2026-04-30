/**
 * GET /api/google-calendar/callback
 * Google OAuth 콜백 핸들러.
 * 팝업으로 열리므로 완료 후 postMessage로 부모 창에 결과를 전달하고 닫힘.
 */

import {
    exchangeCodeForTokens,
    getGoogleUserInfo,
    getMissingGoogleCalendarScopes,
    GOOGLE_CALENDAR_SCOPES,
    normalizeGoogleScopes,
} from "@/lib/google/oauth"
import { createServerSupabase } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const CLOSE_WITH_SUCCESS = (email: string, accountId: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage(
      { type: 'google-calendar-auth-success', email: ${JSON.stringify(email)}, accountId: ${JSON.stringify(accountId)} },
      window.location.origin
    );
  }
  window.close();
</script>
<p>연결 완료. 이 창을 닫아 주세요.</p>
</body>
</html>
`

const CLOSE_WITH_ERROR = (message: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage(
      { type: 'google-calendar-auth-error', message: ${JSON.stringify(message)} },
      window.location.origin
    );
  }
  window.close();
</script>
<p>오류: ${message}</p>
</body>
</html>
`

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get("code")
    const stateParam = searchParams.get("state")
    const errorParam = searchParams.get("error")

    if (errorParam) {
        return new NextResponse(CLOSE_WITH_ERROR("구글 인증이 취소되었습니다."), {
            headers: { "Content-Type": "text/html" },
        })
    }

    if (!code || !stateParam) {
        return new NextResponse(CLOSE_WITH_ERROR("잘못된 요청입니다."), {
            headers: { "Content-Type": "text/html" },
        })
    }

    // state 검증
    let stateData: { userId: string; nonce: string }
    try {
        stateData = JSON.parse(Buffer.from(stateParam, "base64url").toString())
    } catch {
        return new NextResponse(CLOSE_WITH_ERROR("인증 상태 오류입니다."), {
            headers: { "Content-Type": "text/html" },
        })
    }

    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.id !== stateData.userId) {
        return new NextResponse(CLOSE_WITH_ERROR("사용자 인증 오류입니다."), {
            headers: { "Content-Type": "text/html" },
        })
    }

    const redirectUri = `${origin}/api/google-calendar/callback`

    try {
        const tokens = await exchangeCodeForTokens({ code, redirectUri })
        // Google이 기존 동의 재사용 시 token response에서 scope를 생략하는 경우가 있어
        // 필드가 비어있으면 요청 스코프를 기본값으로 사용한다.
        const normalizedGrantedScopes = normalizeGoogleScopes(tokens.scope)
        const grantedScopes =
            normalizedGrantedScopes.length > 0
                ? normalizedGrantedScopes
                : [...GOOGLE_CALENDAR_SCOPES]
        const missingScopes = getMissingGoogleCalendarScopes(grantedScopes)
        if (missingScopes.length > 0) {
            return new NextResponse(
                CLOSE_WITH_ERROR(
                    "필수 Google Calendar 권한 동의가 필요합니다. 모든 권한을 허용한 뒤 다시 연결해 주세요."
                ),
                {
                    headers: { "Content-Type": "text/html" },
                }
            )
        }

        const userInfo = await getGoogleUserInfo(tokens.access_token)

        const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

        const { error } = await supabase
            .from("user_google_integrations")
            .upsert(
                {
                    user_id: user.id,
                    google_account_id: userInfo.id,
                    google_email: userInfo.email,
                    google_display_name: userInfo.name,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token ?? null,
                    token_expires_at: tokenExpiresAt,
                    scopes: grantedScopes,
                },
                { onConflict: "user_id,google_account_id" }
            )

        if (error) {
            console.error("Failed to save Google integration:", error)
            return new NextResponse(CLOSE_WITH_ERROR("연결 저장 중 오류가 발생했습니다."), {
                headers: { "Content-Type": "text/html" },
            })
        }

        return new NextResponse(CLOSE_WITH_SUCCESS(userInfo.email, userInfo.id), {
            headers: { "Content-Type": "text/html" },
        })
    } catch (err) {
        console.error("Google OAuth callback error:", err)
        return new NextResponse(CLOSE_WITH_ERROR("인증 처리 중 오류가 발생했습니다."), {
            headers: { "Content-Type": "text/html" },
        })
    }
}
