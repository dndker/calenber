"use client"

import { useCalendarStore } from "@/store/useCalendarStore"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from "@workspace/ui/components/breadcrumb"
import dayjs from "dayjs"
import TextTransition, { presets } from "react-text-transition"

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
                        <TextTransition springConfig={presets.stiff}>
                            {dayjs(viewport).format("YYYY년 M월")}
                        </TextTransition>
                    </BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    )
}
