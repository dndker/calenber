"use client"

import { useCopyToClipboard } from "@/hooks/use-copy"
import { getShortCalendarEventPath } from "@/lib/calendar/short-link"
import { toast } from "sonner"

type CopyCalendarEventLinkParams = {
    calendarId: string
    eventId: string
    modal?: boolean
}

export function useCopyCalendarEventLink() {
    const { copyToClipboard, isCopied } = useCopyToClipboard()

    const copyEventLink = async ({
        calendarId,
        eventId,
        modal = false,
    }: CopyCalendarEventLinkParams) => {
        if (typeof window === "undefined") {
            toast.error("링크를 복사하지 못했습니다.")
            return false
        }

        const shortPath = getShortCalendarEventPath(calendarId, eventId, {
            modal,
        })
        const shortUrl = new URL(shortPath, window.location.origin).toString()
        const hasCopied = await copyToClipboard(shortUrl)

        if (hasCopied) {
            toast.success("클립보드에 일정 링크가 복사되었습니다.")
            return true
        }

        toast.error("링크를 복사하지 못했습니다.")
        return false
    }

    return {
        copyEventLink,
        isCopied,
    }
}
