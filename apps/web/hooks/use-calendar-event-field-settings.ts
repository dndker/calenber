"use client"

import {
    normalizeCalendarEventFieldSettings,
} from "@/lib/calendar/event-field-settings"
import { useCalendarStore } from "@/store/useCalendarStore"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { toast } from "sonner"

export function useCalendarEventFieldSettings() {
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const updateCalendarSnapshot = useCalendarStore(
        (s) => s.updateCalendarSnapshot
    )

    const eventFieldSettings = normalizeCalendarEventFieldSettings(
        activeCalendar?.eventFieldSettings
    )

    const saveEventFieldSettings = async (
        nextSettings: Parameters<typeof normalizeCalendarEventFieldSettings>[0]
    ) => {
        if (!activeCalendar || activeCalendar.id === "demo") {
            return true
        }

        const previousSettings = normalizeCalendarEventFieldSettings(
            activeCalendar.eventFieldSettings
        )
        const normalizedNextSettings =
            normalizeCalendarEventFieldSettings(nextSettings)

        updateCalendarSnapshot(activeCalendar.id, {
            eventFieldSettings: normalizedNextSettings,
        })

        const supabase = createBrowserSupabase()
        const { error } = await supabase
            .from("calendars")
            .update({
                event_field_settings: normalizedNextSettings,
            })
            .eq("id", activeCalendar.id)

        if (error) {
            updateCalendarSnapshot(activeCalendar.id, {
                eventFieldSettings: previousSettings,
            })
            console.error("Failed to update calendar event field settings:", error)
            toast.error("일정 속성 설정을 저장하지 못했습니다.")
            return false
        }

        return true
    }

    return {
        activeCalendar,
        eventFieldSettings,
        saveEventFieldSettings,
    }
}
