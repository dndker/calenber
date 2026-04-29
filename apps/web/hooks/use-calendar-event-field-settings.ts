"use client"

import {
    normalizeCalendarEventFieldSettings,
} from "@/lib/calendar/event-field-settings"
import { canManageCalendar } from "@/lib/calendar/permissions"
import { useCalendarStore } from "@/store/useCalendarStore"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { toast } from "sonner"

export function useCalendarEventFieldSettings() {
    const t = useDebugTranslations("settings.calendarData")
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const updateCalendarSnapshot = useCalendarStore(
        (s) => s.updateCalendarSnapshot
    )
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
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
        if (!canManageCalendar(activeCalendarMembership)) {
            toast.error(t("fieldSettingsPermissionDenied"))
            return false
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
            toast.error(t("fieldSettingsSaveFailed"))
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
