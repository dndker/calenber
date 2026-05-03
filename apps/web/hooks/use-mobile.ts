import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

export function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState(false)

    React.useEffect(() => {
        const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY)

        const sync = () => {
            setIsMobile(mediaQuery.matches)
        }

        sync()
        mediaQuery.addEventListener("change", sync)

        return () => {
            mediaQuery.removeEventListener("change", sync)
        }
    }, [])

    return isMobile
}
