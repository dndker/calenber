"use client"

import type { CalendarEventLayout } from "@/lib/calendar/types"
import { canManageCalendar } from "@/lib/calendar/permissions"
import { useCalendarStore } from "@/store/useCalendarStore"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { toast } from "sonner"

export function useCalendarEventLayout() {
    const t = useDebugTranslations("settings.calendarGeneral")
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const updateCalendarSnapshot = useCalendarStore(
        (s) => s.updateCalendarSnapshot
    )
    const eventLayout = useCalendarStore((s) => s.eventLayout)
    const setEventLayout = useCalendarStore((s) => s.setEventLayout)
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )

    const saveEventLayout = async (layout: CalendarEventLayout) => {
        if (!canManageCalendar(activeCalendarMembership)) {
            toast.error(t("eventLayoutPermissionDenied"))
            return
        }

        setEventLayout(layout)

        if (!activeCalendar) {
            return
        }

        const previousLayout = activeCalendar.eventLayout
        updateCalendarSnapshot(activeCalendar.id, { eventLayout: layout })

        const supabase = createBrowserSupabase()
        const { error } = await supabase
            .from("calendars")
            .update({ event_layout: layout })
            .eq("id", activeCalendar.id)

        if (error) {
            updateCalendarSnapshot(activeCalendar.id, {
                eventLayout: previousLayout,
            })
            setEventLayout(previousLayout)
            console.error("Failed to update calendar event layout:", error)
            toast.error(t("layoutOptionsSaveFailed"))
        }
    }

    return {
        activeCalendar,
        eventLayout,
        saveEventLayout,
    }
}
