/**
 * GET /api/google-calendar/auth
 * Google OAuth 인증 URL을 반환하는 엔드포인트.
 * 팝업 창에서 열리므로 JSON으로 URL 반환 (리다이렉트 X).
 */

import { buildGoogleAuthUrl } from "@/lib/google/oauth"
import { getServerUser } from "@/lib/auth/get-server-user"
import { NextResponse } from "next/server"
import crypto from "crypto"

export async function GET(request: Request) {
    const user = await getServerUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const forceSelect = searchParams.get("forceAccountSelect") === "true"

    // CSRF state: userId + random nonce
    const nonce = crypto.randomBytes(16).toString("hex")
    const state = Buffer.from(JSON.stringify({ userId: user.id, nonce })).toString("base64url")

    const origin = new URL(request.url).origin
    const redirectUri = `${origin}/api/google-calendar/callback`

    const authUrl = buildGoogleAuthUrl({
        redirectUri,
        state,
        forceAccountSelect: forceSelect,
    })

    return NextResponse.json({ url: authUrl })
}
