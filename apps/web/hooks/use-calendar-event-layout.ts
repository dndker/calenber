"use client"

import type { CalendarEventLayout } from "@/lib/calendar/types"
import { canManageCalendar } from "@/lib/calendar/permissions"
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
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )

    const saveEventLayout = async (layout: CalendarEventLayout) => {
        if (!canManageCalendar(activeCalendarMembership)) {
            toast.error("관리자 또는 소유자만 일정 레이아웃을 변경할 수 있습니다.")
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
            toast.error("캘린더 보기 설정을 저장하지 못했습니다.")
        }
    }

    return {
        activeCalendar,
        eventLayout,
        saveEventLayout,
    }
}
