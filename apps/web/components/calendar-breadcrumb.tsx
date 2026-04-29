"use client"

import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { getCalendarBasePath } from "@/lib/calendar/routes"
import dayjs from "@/lib/dayjs"
import { useCalendarStore } from "@/store/useCalendarStore"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import Link from "next/link"
import { usePathname } from "next/navigation"

export const CalendarBreadcrumb = () => {
    const tCommon = useDebugTranslations("common.labels")
    const tCalendar = useDebugTranslations("calendar")
    const viewport = useCalendarStore((s) => s.viewport)
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const calendarTimezone = useCalendarStore((s) => s.calendarTimezone)

    const pathname = usePathname()
    const calendarBasePath = getCalendarBasePath(pathname)

    const eventId = pathname.startsWith("/calendar/")
        ? (pathname.split("/")[3] ?? null)
        : null

    const event = useCalendarStore((s) =>
        eventId ? s.events.find((e) => e.id === eventId) : null
    )

    return (
        <Breadcrumb>
            <BreadcrumbList>
                {event ? (
                    <>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link href={calendarBasePath}>
                                    {activeCalendar?.name}
                                </Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>
                                {event.title === "" ? tCommon("newEvent") : event.title}
                            </BreadcrumbPage>
                        </BreadcrumbItem>
                    </>
                ) : (
                    <BreadcrumbItem>
                        <BreadcrumbPage className="text-base font-medium">
                            {dayjs
                                .tz(viewport, calendarTimezone)
                                .format(tCalendar("dateFormatYearMonth"))}
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                )}
            </BreadcrumbList>
        </Breadcrumb>
    )
}
