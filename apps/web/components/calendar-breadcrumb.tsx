"use client"

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
    const viewport = useCalendarStore((s) => s.viewport)
    const calendarTimezone = useCalendarStore((s) => s.calendarTimezone)

    const pathname = usePathname()

    const eventId = pathname.startsWith("/event/")
        ? pathname.split("/event/")[1]
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
                                <Link href={`/calendar`}>캘린더</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>{event.title}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </>
                ) : (
                    <BreadcrumbItem>
                        <BreadcrumbPage className="text-base font-medium">
                            {dayjs
                                .tz(viewport, calendarTimezone)
                                .format("YYYY년 M월")}
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                )}
            </BreadcrumbList>
        </Breadcrumb>
    )
}
