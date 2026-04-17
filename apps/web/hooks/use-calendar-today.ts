"use client"

import dayjs from "@/lib/dayjs"
import { useEffect, useMemo, useState } from "react"

function getCalendarToday(timezone?: string) {
    return timezone ? dayjs().tz(timezone).startOf("day") : dayjs().startOf("day")
}

function getMsUntilNextCalendarDay(timezone?: string) {
    const now = timezone ? dayjs().tz(timezone) : dayjs()
    const nextDay = now.add(1, "day").startOf("day")

    return Math.max(1, nextDay.diff(now, "millisecond") + 50)
}

export function useCalendarToday(timezone?: string) {
    const [today, setToday] = useState(() => getCalendarToday(timezone))

    useEffect(() => {
        setToday(getCalendarToday(timezone))

        let timeoutId: ReturnType<typeof setTimeout> | null = null

        const schedule = () => {
            timeoutId = setTimeout(() => {
                setToday(getCalendarToday(timezone))
                schedule()
            }, getMsUntilNextCalendarDay(timezone))
        }

        schedule()

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        }
    }, [timezone])

    return useMemo(
        () => ({
            today,
            todayDate: today.format("YYYY-MM-DD"),
        }),
        [today]
    )
}
