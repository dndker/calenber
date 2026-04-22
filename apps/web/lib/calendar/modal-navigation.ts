export function navigateCalendarModal(
    path: string,
    options?: {
        replace?: boolean
    }
) {
    if (typeof window === "undefined") {
        return
    }

    const nextUrl = new URL(path, window.location.origin)
    const currentUrl = new URL(window.location.href)

    if (
        currentUrl.pathname === nextUrl.pathname &&
        currentUrl.search === nextUrl.search
    ) {
        return
    }

    const method = options?.replace ? "replaceState" : "pushState"
    window.history[method](null, "", nextUrl)
}
