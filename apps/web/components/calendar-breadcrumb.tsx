"use client"

import { useCalendarStore } from "@/store/useCalendarStore"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from "@workspace/ui/components/breadcrumb"
import dayjs from "dayjs"

export const CalendarBreadcrumb = () => {
    const viewport = useCalendarStore((s) => s.viewport)

    return (
        <Breadcrumb>
            <BreadcrumbList>
                {/* <BreadcrumbItem>
                    <BreadcrumbPage>My Calendar</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbItem>
                    <BreadcrumbPage>Schedule Calendar</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator /> */}
                <BreadcrumbItem>
                    <BreadcrumbPage className="text-base font-medium">
                        {dayjs(viewport).format("YYYY년 M월")}
                    </BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    )
}
