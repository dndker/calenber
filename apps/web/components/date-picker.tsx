import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
    SidebarGroup,
    SidebarGroupContent,
} from "@workspace/ui/components/sidebar"

export function DatePicker() {
    const [date, setDate] = React.useState<Date | undefined>(
        new Date(new Date().getFullYear(), new Date().getMonth(), 12)
    )
    return (
        <SidebarGroup className="px-0">
            <SidebarGroupContent>
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    captionLayout="dropdown"
                    className="bg-transparent"
                />

                <div className="px-3">
                    <Button variant="default" size="sm" className="w-full">
                        일정 추가
                    </Button>
                </div>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}
