import { AppSidebar } from "@/components/app-sidebar"
import { CalendarBreadcrumb } from "@/components/calendar-breadcrumb"
import { NavActions } from "@/components/nav-actions"
import { getMyCalendars } from "@/lib/calendar/queries"
import dayjs from "@/lib/dayjs"
import { generateMockEvents } from "@/lib/mock-event"
import { createServerSupabase } from "@/lib/supabase/server"
import { CalendarStoreProvider } from "@/store/useCalendarStore"
import { Button } from "@workspace/ui/components/button"
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd"
import { Separator } from "@workspace/ui/components/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { Search } from "lucide-react"
import { cookies } from "next/headers"
import { Suspense } from "react"

export default async function Layout({
    children,
    modal,
}: {
    children: React.ReactNode
    modal?: React.ReactNode
}) {
    const cookieStore = await cookies()
    const supabase = await createServerSupabase()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    const calendarTimezone =
        cookieStore.get("calendar-timezone")?.value ?? "Asia/Seoul"
    const calendars = user ? await getMyCalendars(supabase, user.id) : []

    const events = generateMockEvents(calendarTimezone)
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
                events,
                calendarTimezone,
                selectedDate,
                viewport,
                viewportMini,
            }}
        >
            <SidebarProvider className="h-screen overflow-hidden">
                <AppSidebar calendars={calendars} />
                <SidebarInset className="h-screen overflow-hidden">
                    <header className="sticky top-0 flex h-16 shrink-0 items-center gap-2.5 border-b bg-background px-4">
                        <div className="flex shrink-0 items-center gap-1">
                            <SidebarTrigger className="-ml-1" />
                            <Separator
                                orientation="vertical"
                                className="data-vertical:h-4 data-vertical:self-auto"
                            />
                        </div>
                        <div className="flex flex-1 items-center justify-between">
                            <CalendarBreadcrumb />

                            <div className="absolute top-1/2 left-1/2 -translate-1/2">
                                <Button
                                    variant="outline"
                                    size="default"
                                    className="relative inline-flex h-8 w-full shrink-0 items-center justify-between gap-2 rounded-lg border px-2 py-2 text-sm font-normal whitespace-nowrap text-muted-foreground shadow-none transition-all outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 md:w-48 lg:w-40 xl:w-64"
                                >
                                    <div className="flex items-center gap-2">
                                        <Search className="size-4" />
                                        <span>Search</span>
                                    </div>

                                    <KbdGroup>
                                        <Kbd>⌘</Kbd>
                                        <Kbd>k</Kbd>
                                    </KbdGroup>
                                </Button>
                            </div>

                            <div className="px-3">
                                <NavActions />
                            </div>
                        </div>
                    </header>
                    <main className="box-border flex flex-1 flex-col overflow-hidden">
                        {children}

                        <Suspense fallback={null}>{modal}</Suspense>
                    </main>
                </SidebarInset>
            </SidebarProvider>
        </CalendarStoreProvider>
    )
}
