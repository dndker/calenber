import { AppSidebar } from "@/components/app-sidebar"
import { CalendarLayoutContent } from "@/components/calendar/calendar-layout-content"
import { SettingsModalProvider } from "@/components/settings/settings-modal-provider"
import { getServerUser } from "@/lib/auth/get-server-user"
import {
    getCalendarById,
    getCalendarEvents,
    getCalendarMembership,
    getMyCalendars,
} from "@/lib/calendar/queries"
import {
    buildCalendarMetadata,
    demoCalendarSummary,
} from "@/lib/calendar/share-metadata"
import dayjs from "@/lib/dayjs"
import { generateMockEvents } from "@/lib/mock-event"
import { createServerSupabase } from "@/lib/supabase/server"
import { CalendarStoreProvider } from "@/store/useCalendarStore"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export async function generateMetadata({
    params,
}: {
    params: Promise<{ calendarId: string }>
}): Promise<Metadata> {
    const { calendarId } = await params

    if (calendarId === "demo") {
        return buildCalendarMetadata({
            calendar: demoCalendarSummary,
            calendarId,
        })
    }

    const supabase = await createServerSupabase()
    const calendar = await getCalendarById(supabase, calendarId)

    return buildCalendarMetadata({
        calendar,
        calendarId,
    })
}

export default async function CalendarLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ calendarId: string }>
}) {
    const { calendarId } = await params
    const cookieStore = await cookies()
    const supabase = await createServerSupabase()
    const user = await getServerUser()
    const calendarTimezone =
        cookieStore.get("calendar-timezone")?.value ?? "Asia/Seoul"
    const isDemo = calendarId === "demo"
    const guestMembership = {
        isMember: false,
        role: null,
        status: null,
    }

    const [myCalendars, activeCalendar, activeCalendarMembership, events] =
        await Promise.all([
            user ? getMyCalendars(supabase, user.id) : Promise.resolve([]),
            isDemo
                ? Promise.resolve(demoCalendarSummary)
                : getCalendarById(supabase, calendarId),
            isDemo
                ? Promise.resolve(guestMembership)
                : getCalendarMembership(supabase, calendarId, user?.id ?? null),
            isDemo
                ? Promise.resolve(generateMockEvents(calendarTimezone))
                : getCalendarEvents(supabase, calendarId),
        ])

    if (!isDemo && !activeCalendar) {
        redirect("/calendar/demo")
    }

    const now = dayjs().tz(calendarTimezone)
    const selectedDate = now.startOf("day").valueOf()
    const viewport = now.startOf("month").add(12, "hour").valueOf()
    const viewportMini = viewport

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
