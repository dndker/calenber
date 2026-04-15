"use client"

import * as React from "react"

import { Calendars } from "@/components/calendars"
import { DatePicker } from "@/components/date-picker"
import { NavUser } from "@/components/nav-user"
import type { MyCalendarItem } from "@/lib/calendar/queries"
import { useAuthStore } from "@/store/useAuthStore"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    SidebarSeparator,
} from "@workspace/ui/components/sidebar"
import { Settings, Trash2 } from "lucide-react"

// This is sample data.
const data = {
    user: {
        id: "1",
        name: "woong",
        email: "example@gmail.com",
        avatarUrl: "/icons/square/ios/144.png",
        calendars: [
            {
                name: "플랫폼디자인팀",
                plan: "Enterprise",
            },
            {
                name: "서비스퍼블팀",
                plan: "Startup",
            },
            {
                name: "디자인실",
                plan: "Free",
            },
        ],
    },
    calendars: [
        {
            name: "My Calendars",
            items: ["Personal", "Work", "Family"],
        },
        {
            name: "Favorites",
            items: ["Holidays", "Birthdays"],
        },
        {
            name: "Other",
            items: ["Travel", "Reminders", "Deadlines"],
        },
    ],
}

export function AppSidebar({
    calendars,
    ...props
}: React.ComponentProps<typeof Sidebar> & {
    calendars: MyCalendarItem[]
}) {
    const user = useAuthStore((s) => s.user)

    return (
        <Sidebar {...props}>
            <SidebarHeader className="h-16 border-b border-sidebar-border">
                <NavUser
                    user={user ? { ...data.user, ...user } : data.user}
                    calendars={calendars}
                />
            </SidebarHeader>
            <SidebarContent>
                <DatePicker />
                <SidebarSeparator className="mx-0" />
                <Calendars calendars={data.calendars} />
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton>
                            <Trash2 />
                            <span>휴지통</span>
                        </SidebarMenuButton>
                        <SidebarMenuButton>
                            <Settings />
                            <span>설정</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
