"use client"

import type { CalendarEventLayout } from "@/lib/calendar/types"
import { useCalendarStore } from "@/store/useCalendarStore"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { toast } from "sonner"

export function useCalendarEventLayout() {
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const updateCalendarSnapshot = useCalendarStore(
        (s) => s.updateCalendarSnapshot
    )
    const eventLayout = useCalendarStore((s) => s.eventLayout)
    const setEventLayout = useCalendarStore((s) => s.setEventLayout)

    const saveEventLayout = async (layout: CalendarEventLayout) => {
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
            toast.error("캘린더 보기 설정을 저장하지 못했습니다.")
        }
    }

    return {
        activeCalendar,
        eventLayout,
        saveEventLayout,
    }
}
