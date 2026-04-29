"use client"

import { useCopyToClipboard } from "@/hooks/use-copy"
import { getShortCalendarEventPath } from "@/lib/calendar/short-link"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { toast } from "sonner"

type CopyCalendarEventLinkParams = {
    calendarId: string
    eventId: string
    modal?: boolean
}

export function useCopyCalendarEventLink() {
    const { copyToClipboard, isCopied } = useCopyToClipboard()
    const t = useDebugTranslations("event.toast")

    const copyEventLink = async ({
        calendarId,
        eventId,
        modal = false,
    }: CopyCalendarEventLinkParams) => {
        if (typeof window === "undefined") {
            toast.error(t("copyLinkFailed"))
            return false
        }

        const shortPath = getShortCalendarEventPath(calendarId, eventId, {
            modal,
        })
        const shortUrl = new URL(shortPath, window.location.origin).toString()
        const hasCopied = await copyToClipboard(shortUrl)

        if (hasCopied) {
            toast.success(t("linkCopied"))
            return true
        }

        toast.error(t("copyLinkFailed"))
        return false
    }

    return {
        copyEventLink,
        isCopied,
    }
}
