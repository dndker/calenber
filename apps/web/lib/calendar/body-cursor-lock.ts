const CURSOR_STYLE_TAG_ID = "calendar-global-cursor-lock-style"

const cursorClassMap: Record<string, string> = {
    grabbing: "calendar-cursor-grabbing",
    "ew-resize": "calendar-cursor-ew-resize",
}
const grabbingCursorClass = "calendar-cursor-grabbing"
const ewResizeCursorClass = "calendar-cursor-ew-resize"

const cursorLocks = new Map<string, string>()

function ensureCursorStyleSheet() {
    if (typeof document === "undefined") {
        return
    }

    if (document.getElementById(CURSOR_STYLE_TAG_ID)) {
        return
    }

    const style = document.createElement("style")
    style.id = CURSOR_STYLE_TAG_ID
    style.textContent = `
.calendar-cursor-grabbing,
.calendar-cursor-grabbing * {
    cursor: grabbing !important;
}

.calendar-cursor-ew-resize,
.calendar-cursor-ew-resize * {
    cursor: ew-resize !important;
}
`
    document.head.appendChild(style)
}

function applyTopCursorClass() {
    if (typeof document === "undefined") {
        return
    }

    const root = document.documentElement
    root.classList.remove(grabbingCursorClass, ewResizeCursorClass)

    const topCursor = Array.from(cursorLocks.values()).at(-1)
    if (!topCursor) {
        return
    }

    const className = cursorClassMap[topCursor]
    if (className) {
        root.classList.add(className)
    }
}

/**
 * 캘린더 드래그 세션에서 전역 커서를 강제한다.
 * 자식 요소에서 개별 cursor를 지정해도 `!important`로 일관되게 유지된다.
 */
export function lockCalendarBodyCursor(lockId: string, cursor: string) {
    if (typeof document === "undefined") {
        return () => {}
    }

    ensureCursorStyleSheet()
    cursorLocks.set(lockId, cursor)
    applyTopCursorClass()

    return () => {
        if (typeof document === "undefined") {
            return
        }

        cursorLocks.delete(lockId)
        applyTopCursorClass()
    }
}
