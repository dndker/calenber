import { AppSidebar } from "@/components/app-sidebar"
import { CalendarLayoutContent } from "@/components/calendar/calendar-layout-content"
import { SettingsModalProvider } from "@/components/settings/settings-modal-provider"
import {
    getServerCalendarInitialData,
    getServerMyCalendars,
} from "@/lib/calendar/server-queries"
import {
    buildCalendarMetadata,
    demoCalendarSummary,
} from "@/lib/calendar/share-metadata"
import dayjs from "@/lib/dayjs"
import { generateMockEvents, getDemoEventCategories } from "@/lib/mock-event"
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

    const { calendar } = await getServerCalendarInitialData(calendarId)

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
    const calendarTimezone =
        cookieStore.get("calendar-timezone")?.value ?? "Asia/Seoul"
    const isDemo = calendarId === "demo"
    const demoEventCategories = isDemo ? getDemoEventCategories() : []
    const [initialData, myCalendars] = await Promise.all([
        isDemo ? Promise.resolve(null) : getServerCalendarInitialData(calendarId),
        isDemo ? getServerMyCalendars() : Promise.resolve([]),
    ])
    const activeCalendar = isDemo
        ? demoCalendarSummary
        : initialData?.calendar ?? null
    const activeCalendarMembership = isDemo
        ? {
              isMember: false,
              role: null,
              status: null,
          }
        : initialData?.membership ?? {
              isMember: false,
              role: null,
              status: null,
          }
    const events = isDemo
        ? generateMockEvents(calendarTimezone, demoEventCategories)
        : initialData?.events ?? []
    const eventCategories = isDemo
        ? demoEventCategories
        : initialData?.eventCategories ?? []
    const resolvedMyCalendars = isDemo ? myCalendars : initialData?.myCalendars ?? []

    if (!isDemo && !activeCalendar) {
        redirect("/calendar/demo")
    }

    const now = dayjs().tz(calendarTimezone)
    const selectedDate = now.startOf("day").valueOf()
    const viewport = now.startOf("month").add(12, "hour").valueOf()
    const viewportMini = viewport
    const initialExcludedCategoryIds = eventCategories
        .filter((category) => category.options.visibleByDefault === false)
        .map((category) => category.id)

    return (
        <CalendarStoreProvider
            initialState={{
                myCalendars: resolvedMyCalendars,
                activeCalendar,
                activeCalendarMembership,
                events,
                eventCategories: eventCategories.map((category) => ({
                    ...category,
                    createdAt: new Date(category.createdAt).valueOf(),
                    updatedAt: new Date(category.updatedAt).valueOf(),
                })),
                eventLayout: activeCalendar?.eventLayout ?? "compact",
                calendarTimezone,
                eventFilters: {
                    excludedStatuses: ["completed", "cancelled"],
                    excludedCategoryIds: initialExcludedCategoryIds,
                },
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
