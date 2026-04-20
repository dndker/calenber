"use client"

import { useCalendarWorkspaceRealtime } from "@/hooks/use-calendar-workspace-realtime"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { CalendarBreadcrumb } from "../calendar-breadcrumb"
import { NavActions } from "../nav-actions"
import { CalendarSearchDialog } from "./calendar-search-dialog"

export function CalendarLayoutContent({
    children,
}: {
    children?: React.ReactNode
}) {
    useCalendarWorkspaceRealtime()

    return (
        <>
            <header className="sticky top-0 flex h-16 shrink-0 items-center gap-2.5 border-b bg-background px-4">
                <div className="flex shrink-0 items-center gap-1">
                    <SidebarTrigger className="-ml-1" />
                    <Separator
                        orientation="vertical"
                        className="data-vertical:h-4 data-vertical:self-auto"
                    />
                </div>
                <div className="relative flex flex-1 items-center justify-between">
                    <CalendarBreadcrumb />

                    <div className="absolute top-1/2 left-1/2 -translate-1/2">
                        <CalendarSearchDialog />
                    </div>

                    <div className="px-3">
                        <NavActions />
                    </div>
                </div>
            </header>
            <main className="relative box-border flex flex-1 flex-col overflow-hidden">
                {children}
            </main>
        </>
    )
}
