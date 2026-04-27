"use client"

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from "react"
import {
    SIDEBAR_COLLAPSE_COOKIE_MAX_AGE,
    SIDEBAR_COLLAPSE_COOKIE_NAME,
} from "@/lib/calendar/sidebar-collapse-cookie"

export { parseSidebarCollapseStateCookie } from "@/lib/calendar/sidebar-collapse-cookie"

type SidebarCollapseContextValue = {
    getOpen: (groupId: string, defaultOpen?: boolean) => boolean
    setOpen: (groupId: string, open: boolean) => void
}

export const SidebarCollapseContext =
    createContext<SidebarCollapseContextValue | null>(null)

/**
 * 서버에서 읽은 쿠키 초기값을 Context로 제공한다.
 * layout.tsx에서 `<SidebarCollapseProvider initialState={...}>` 로 감싸면 된다.
 */
export function SidebarCollapseProvider({
    initialState,
    children,
}: {
    initialState: Record<string, boolean>
    children: React.ReactNode
}) {
    const [state, setState] = useState<Record<string, boolean>>(initialState)

    // 쿠키 write는 ref로 최신 state를 참조해 stale closure 방지
    const stateRef = useRef(state)
    stateRef.current = state

    const getOpen = useCallback(
        (groupId: string, defaultOpen = true) => state[groupId] ?? defaultOpen,
        [state]
    )

    const setOpen = useCallback((groupId: string, open: boolean) => {
        setState((prev) => {
            const next = { ...prev, [groupId]: open }
            stateRef.current = next
            try {
                document.cookie = `${SIDEBAR_COLLAPSE_COOKIE_NAME}=${JSON.stringify(next)}; path=/; max-age=${SIDEBAR_COLLAPSE_COOKIE_MAX_AGE}; SameSite=Lax`
            } catch {
                // 쿠키 접근 불가 환경에서도 메모리 상태는 유지
            }
            return next
        })
    }, [])

    const value = useMemo(() => ({ getOpen, setOpen }), [getOpen, setOpen])

    return (
        <SidebarCollapseContext value={value}>
            {children}
        </SidebarCollapseContext>
    )
}

/**
 * 사이드바 그룹의 열림/닫힘 상태를 가져오고 토글한다.
 *
 * @param groupId - 그룹 고유 ID (예: "favorites", "filter-status", "subscription")
 * @param defaultOpen - 쿠키에 저장된 값이 없을 때 사용할 기본값 (기본: true)
 */
export function useSidebarCollapse(
    groupId: string,
    defaultOpen = true
): [boolean, (open: boolean) => void] {
    const ctx = useContext(SidebarCollapseContext)
    if (!ctx) {
        throw new Error(
            "useSidebarCollapse must be used within SidebarCollapseProvider"
        )
    }

    const isOpen = ctx.getOpen(groupId, defaultOpen)
    const setOpen = useCallback(
        (open: boolean) => ctx.setOpen(groupId, open),
        [ctx, groupId]
    )

    return [isOpen, setOpen]
}
