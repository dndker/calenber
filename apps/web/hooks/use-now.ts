import dayjs from "@/lib/dayjs"
import { useEffect, useState } from "react"

export const useNow = (timezone?: string) => {
    const [now, setNow] = useState(timezone ? dayjs().tz(timezone) : dayjs())

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(timezone ? dayjs().tz(timezone) : dayjs())
        }, 1000)

        return () => clearInterval(interval)
    }, [timezone])

    return now
}
