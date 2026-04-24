import dayjs from "@/lib/dayjs"
import { useEffect, useState } from "react"

export const useNow = (timezone?: string) => {
    const [, setRefreshToken] = useState(0)
    const now = timezone ? dayjs().tz(timezone) : dayjs()

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        const scheduleNextUpdate = () => {
            const currentNow = timezone ? dayjs().tz(timezone) : dayjs()
            const nextDay = currentNow.add(1, "day").startOf("day")
            const delay = Math.max(nextDay.diff(currentNow) + 50, 1000)

            timeoutId = setTimeout(() => {
                setRefreshToken((value) => value + 1)
                scheduleNextUpdate()
            }, delay)
        }

        scheduleNextUpdate()

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        }
    }, [timezone])

    return now
}
