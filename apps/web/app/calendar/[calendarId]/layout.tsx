import { AppSidebar } from "@/components/app-sidebar"
import { parseSidebarCollapseStateCookie } from "@/lib/calendar/sidebar-collapse-cookie"
import { SidebarCollapseProvider } from "@/hooks/use-sidebar-collapse-state"
import { CalendarLayoutContent } from "@/components/calendar/calendar-layout-content"
import { SettingsModalProvider } from "@/components/settings/settings-modal-provider"
import {
    getServerCalendarInitialData,
    getServerMyCalendars,
} from "@/lib/calendar/server-queries"
import { resolveCalendarIdFromPathParam } from "@/lib/calendar/routes"
import {
    buildCalendarMetadata,
    demoCalendarSummary,
} from "@/lib/calendar/share-metadata"
import dayjs from "@/lib/dayjs"
import { generateMockEvents, getDemoEventCollections } from "@/lib/mock-event"
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
    const { calendarId: rawCalendarId } = await params
    const calendarId = resolveCalendarIdFromPathParam(rawCalendarId)

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
    const { calendarId: rawCalendarId } = await params
    const calendarId = resolveCalendarIdFromPathParam(rawCalendarId)
    const cookieStore = await cookies()
    const calendarTimezone =
        cookieStore.get("calendar-timezone")?.value ?? "Asia/Seoul"
    const sidebarCollapseState = parseSidebarCollapseStateCookie(
        cookieStore.get("sidebar-collapse-state")?.value
    )
    const isDemo = calendarId === "demo"
    const demoEventCollections = isDemo ? getDemoEventCollections() : []
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
        ? generateMockEvents(calendarTimezone, demoEventCollections)
        : initialData?.events ?? []
    const eventCollections = isDemo
        ? demoEventCollections
        : initialData?.eventCollections ?? []
    const resolvedMyCalendars = isDemo ? myCalendars : initialData?.myCalendars ?? []

    if (!isDemo && !activeCalendar) {
        redirect("/calendar/demo")
    }

    const now = dayjs().tz(calendarTimezone)
    const selectedDate = now.startOf("day").valueOf()
    const viewport = now.startOf("month").add(12, "hour").valueOf()
    const viewportMini = viewport
    const initialExcludedCollectionIds = eventCollections
        .filter((collection) => collection.options.visibleByDefault === false)
        .map((collection) => collection.id)
    const favoriteEventMap = {
        ...Object.fromEntries(
            events
                .filter((event) => event.isFavorite)
                .map((event) => [event.id, event.favoritedAt ?? event.updatedAt])
        ),
        ...Object.fromEntries(
            (initialData?.subscriptionFavoriteEventIds ?? []).map((favorite) => [
                favorite.eventId,
                favorite.favoritedAt,
            ])
        ),
    }

    return (
        <CalendarStoreProvider
            initialState={{
                myCalendars: resolvedMyCalendars,
                activeCalendar,
                activeCalendarMembership,
                favoriteEventMap,
                events,
                eventCollections: eventCollections.map((collection) => ({
                    ...collection,
                    createdAt: new Date(collection.createdAt).valueOf(),
                    updatedAt: new Date(collection.updatedAt).valueOf(),
                })),
                eventLayout: activeCalendar?.eventLayout ?? "compact",
                calendarTimezone,
                eventFilters: {
                    excludedStatuses: ["completed", "cancelled"],
                    excludedCollectionIds: initialExcludedCollectionIds,
                    excludedWithoutCollection: false,
                },
                subscriptionCatalogs: initialData?.subscriptionCatalogs ?? [],
                subscriptionState: initialData?.subscriptionState ?? {
                    installedSubscriptionIds: [],
                    hiddenSubscriptionIds: [],
                },
                selectedDate,
                viewport,
                viewportMini,
            }}
        >
            <SidebarCollapseProvider initialState={sidebarCollapseState}>
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
            </SidebarCollapseProvider>
        </CalendarStoreProvider>
    )
}
