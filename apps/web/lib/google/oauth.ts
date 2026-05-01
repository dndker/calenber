/**
 * Google OAuth 2.0 헬퍼
 * - 인증 URL 생성
 * - 코드 → 토큰 교환
 * - 액세스 토큰 갱신
 * - Google Calendar 스코프 상수
 */

export const GOOGLE_CALENDAR_SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
] as const

/**
 * Google Calendar 기능에 필요한 최소 권한.
 * calendar(full) 스코프가 있으면 readonly 요구를 충족한다 (GOOGLE_SCOPE_ALIASES 참고).
 */
export const GOOGLE_CALENDAR_REQUIRED_SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
] as const

/**
 * 이벤트 쓰기(생성·수정·삭제)에 필요한 권한 집합.
 * calendar(full) 스코프를 직접 확인한다.
 */
export const GOOGLE_CALENDAR_WRITE_SCOPES = [
    "https://www.googleapis.com/auth/calendar",
] as const

/**
 * 계정별 캘린더 목록 조회에 필요한 권한 집합.
 * 일부 토큰은 더 세분화된 calendarlist scope를 반환할 수 있어 별도 기준으로 둔다.
 */
export const GOOGLE_CALENDAR_LIST_REQUIRED_SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
] as const

/**
 * Google이 반환할 수 있는 권한 동치/상위 스코프 매핑.
 * 예: calendar(full) 권한이 있으면 readonly/calendarlist 권한 요구를 모두 충족한다.
 */
const GOOGLE_SCOPE_ALIASES: Record<string, string[]> = {
    "https://www.googleapis.com/auth/calendar.readonly": [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.calendarlist",
        "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    ],
}

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

export type GoogleTokenResponse = {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type: string
    scope: string
    id_token?: string
}

export type GoogleUserInfo = {
    id: string
    email: string
    name: string | null
    picture: string | null
}

export function normalizeGoogleScopes(
    scopes: string[] | string | null | undefined
): string[] {
    if (!scopes) return []
    if (Array.isArray(scopes)) {
        return scopes.map((scope) => scope.trim()).filter(Boolean)
    }

    const raw = scopes.trim()
    if (!raw) return []

    // Postgres text[]가 문자열로 들어오는 일부 레거시 포맷 대응: "{a,b,c}"
    if (raw.startsWith("{") && raw.endsWith("}")) {
        return raw
            .slice(1, -1)
            .split(",")
            .map((scope) => scope.replace(/^"|"$/g, "").trim())
            .filter(Boolean)
    }

    return raw
        .split(/\s+/)
        .map((scope) => scope.trim())
        .filter(Boolean)
}

/**
 * 필수 Google Calendar 스코프 누락 목록 반환.
 */
export function getMissingGoogleScopes(
    scopes: string[] | string | null | undefined,
    requiredScopes: readonly string[]
): string[] {
    const granted = new Set(normalizeGoogleScopes(scopes))
    return requiredScopes.filter((scope) => {
        if (granted.has(scope)) {
            return false
        }

        const aliases = GOOGLE_SCOPE_ALIASES[scope] ?? []
        return !aliases.some((alias) => granted.has(alias))
    })
}

export function getMissingGoogleCalendarScopes(
    scopes: string[] | string | null | undefined
): string[] {
    return getMissingGoogleScopes(scopes, GOOGLE_CALENDAR_REQUIRED_SCOPES)
}

function getClientId() {
    const id = process.env.GOOGLE_CLIENT_ID
    if (!id) throw new Error("GOOGLE_CLIENT_ID is not set")
    return id
}

function getClientSecret() {
    const secret = process.env.GOOGLE_CLIENT_SECRET
    if (!secret) throw new Error("GOOGLE_CLIENT_SECRET is not set")
    return secret
}

/**
 * Google OAuth 인증 URL 생성
 * state 파라미터로 CSRF 방어 + 콜백 후 리다이렉트 정보 전달
 */
export function buildGoogleAuthUrl(params: {
    redirectUri: string
    state: string
    /** 이미 연결된 계정을 추가하는 경우 true */
    forceAccountSelect?: boolean
}): string {
    const url = new URL(GOOGLE_AUTH_URL)
    url.searchParams.set("client_id", getClientId())
    url.searchParams.set("redirect_uri", params.redirectUri)
    url.searchParams.set("response_type", "code")
    url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "))
    // 기존 승인된 권한을 포함해 반환받아 불필요한 재동의를 줄인다.
    url.searchParams.set("include_granted_scopes", "true")
    url.searchParams.set("access_type", "offline")
    url.searchParams.set("prompt", params.forceAccountSelect ? "consent select_account" : "consent")
    url.searchParams.set("state", params.state)
    return url.toString()
}

/**
 * 인증 코드 → 액세스/리프레시 토큰 교환
 */
export async function exchangeCodeForTokens(params: {
    code: string
    redirectUri: string
}): Promise<GoogleTokenResponse> {
    const res = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code: params.code,
            client_id: getClientId(),
            client_secret: getClientSecret(),
            redirect_uri: params.redirectUri,
            grant_type: "authorization_code",
        }),
    })

    if (!res.ok) {
        const body = await res.text()
        throw new Error(`Google token exchange failed: ${res.status} ${body}`)
    }

    return res.json() as Promise<GoogleTokenResponse>
}

/**
 * 리프레시 토큰으로 액세스 토큰 갱신
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
    access_token: string
    expires_in: number
}> {
    const res = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: getClientId(),
            client_secret: getClientSecret(),
            grant_type: "refresh_token",
        }),
    })

    if (!res.ok) {
        const body = await res.text()
        throw new Error(`Google token refresh failed: ${res.status} ${body}`)
    }

    return res.json() as Promise<{ access_token: string; expires_in: number }>
}

/**
 * 액세스 토큰으로 Google 계정 정보 조회
 */
export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const res = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
        throw new Error(`Google userinfo failed: ${res.status}`)
    }

    const data = (await res.json()) as {
        id: string
        email: string
        name?: string
        picture?: string
    }

    return {
        id: data.id,
        email: data.email,
        name: data.name ?? null,
        picture: data.picture ?? null,
    }
}
