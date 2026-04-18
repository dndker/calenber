import { AppSidebar } from "@/components/app-sidebar"
import { CalendarLayoutContent } from "@/components/calendar/calendar-layout-content"
import { SettingsModalProvider } from "@/components/settings/settings-modal-provider"
import {
    getCalendarById,
    getCalendarEvents,
    getCalendarMembership,
    getMyCalendars,
} from "@/lib/calendar/queries"
import dayjs from "@/lib/dayjs"
import { generateMockEvents } from "@/lib/mock-event"
import { createServerSupabase } from "@/lib/supabase/server"
import { CalendarStoreProvider } from "@/store/useCalendarStore"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function CalendarLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ calendarId: string; eventId: string }>
}) {
    const { calendarId } = await params
    const cookieStore = await cookies()
    const supabase = await createServerSupabase()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    const calendarTimezone =
        cookieStore.get("calendar-timezone")?.value ?? "Asia/Seoul"

    const myCalendars = user ? await getMyCalendars(supabase, user.id) : []

    const isDemo = calendarId === "demo"

    const activeCalendar = isDemo
        ? {
              id: "demo",
              name: "데모 캘린더",
              avatarUrl: null,
              accessMode: "public_open" as const,
              eventLayout: "compact" as const,
              updatedAt: "",
              createdAt: "",
          }
        : await getCalendarById(supabase, calendarId)

    if (!isDemo && !activeCalendar) {
        redirect("/calendar/demo")
    }

    const activeCalendarMembership = isDemo
        ? {
              isMember: false,
              role: null,
              status: null,
          }
        : await getCalendarMembership(supabase, calendarId, user?.id ?? null)

    const events = isDemo
        ? generateMockEvents(calendarTimezone)
        : await getCalendarEvents(supabase, calendarId)

    const selectedDate = dayjs().tz(calendarTimezone).startOf("day").valueOf()
    const viewport = dayjs()
        .tz(calendarTimezone)
        .startOf("month")
        .add(12, "hour")
        .valueOf()
    const viewportMini = dayjs()
        .tz(calendarTimezone)
        .startOf("month")
        .add(12, "hour")
        .valueOf()

    return (
        <CalendarStoreProvider
            initialState={{
                myCalendars,
                activeCalendar,
                activeCalendarMembership,
                events,
                eventLayout: activeCalendar?.eventLayout ?? "compact",
                calendarTimezone,
                selectedDate,
                viewport,
                viewportMini,
            }}
        >
            <SidebarProvider className="h-screen overflow-hidden">
                <SettingsModalProvider>
                    <AppSidebar />
                    <SidebarInset className="h-screen overflow-hidden">
                        <CalendarLayoutContent>
                            {children}
                        </CalendarLayoutContent>
                    </SidebarInset>
                </SettingsModalProvider>
            </SidebarProvider>
        </CalendarStoreProvider>
    )
}
