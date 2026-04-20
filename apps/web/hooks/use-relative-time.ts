"use client"

import dayjs, { formatRelativeTime } from "@/lib/dayjs"
import { useEffect, useState } from "react"

type UseRelativeTimeOptions = {
    clampFuture?: boolean
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function getDelayUntilNextRelativeTimeUpdate(
    value: string | Date | number,
    nowMs: number,
    clampFuture: boolean
) {
    const targetMs = dayjs(value).valueOf()
    const effectiveTargetMs = clampFuture ? Math.min(targetMs, nowMs) : targetMs
    const diffMs = Math.abs(nowMs - effectiveTargetMs)
    const diffSeconds = diffMs / SECOND

    if (diffSeconds < 44) {
        return SECOND - (diffMs % SECOND) || SECOND
    }

    if (diffSeconds < 89) {
        return 90 * SECOND - diffMs
    }

    if (diffSeconds < 44 * 60) {
        return MINUTE - (diffMs % MINUTE) || MINUTE
    }

    if (diffSeconds < 89 * 60) {
        return 90 * MINUTE - diffMs
    }

    if (diffSeconds < 21 * 60 * 60) {
        return HOUR - (diffMs % HOUR) || HOUR
    }

    if (diffSeconds < 35 * 60 * 60) {
        return 36 * HOUR - diffMs
    }

    return DAY - (diffMs % DAY) || DAY
}

export function useRelativeTime(
    value: string | Date | number | null | undefined,
    options?: UseRelativeTimeOptions
) {
    const clampFuture = options?.clampFuture ?? false
    const [nowMs, setNowMs] = useState(() => Date.now())

    useEffect(() => {
        if (!value) {
            return
        }

        let timeoutId: number | null = null

        const schedule = () => {
            const currentNowMs = Date.now()
            setNowMs(currentNowMs)

            timeoutId = window.setTimeout(() => {
                schedule()
            }, getDelayUntilNextRelativeTimeUpdate(value, currentNowMs, clampFuture))
        }

        schedule()

        return () => {
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId)
            }
        }
    }, [clampFuture, value])

    return formatRelativeTime(value, {
        now: nowMs,
        clampFuture,
    })
}
