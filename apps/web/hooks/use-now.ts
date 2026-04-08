import dayjs from "@/lib/dayjs"
import { useEffect, useState } from "react"

export const useNow = () => {
    const [now, setNow] = useState(dayjs())

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(dayjs())
        }, 1000)

        return () => clearInterval(interval)
    }, [])

    return now
}
