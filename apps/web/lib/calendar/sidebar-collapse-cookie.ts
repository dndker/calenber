const COOKIE_NAME = "sidebar-collapse-state"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1년

export { COOKIE_NAME as SIDEBAR_COLLAPSE_COOKIE_NAME, COOKIE_MAX_AGE as SIDEBAR_COLLAPSE_COOKIE_MAX_AGE }

/**
 * 서버(layout.tsx)와 클라이언트(훅) 양쪽에서 쓸 수 있는 순수 파싱 함수.
 * "use client" 없이 유지해야 서버 컴포넌트에서 import 가능하다.
 */
export function parseSidebarCollapseStateCookie(
    cookieValue: string | undefined
): Record<string, boolean> {
    if (!cookieValue) return {}
    try {
        return JSON.parse(cookieValue) as Record<string, boolean>
    } catch {
        return {}
    }
}
