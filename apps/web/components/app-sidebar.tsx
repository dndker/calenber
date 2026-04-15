"use client"

import * as React from "react"

import { Calendars } from "@/components/calendars"
import { DatePicker } from "@/components/date-picker"
import { NavUser } from "@/components/nav-user"
import { useSettingsModal } from "@/components/settings/settings-modal-provider"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const user = useAuthStore((s) => s.user)
    const { openSettings } = useSettingsModal()
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )

    return (
        <Sidebar {...props}>
            <SidebarHeader className="h-16 border-b border-sidebar-border">
                <NavUser user={user ? { ...data.user, ...user } : data.user} />
            </SidebarHeader>
            <SidebarContent>
                <DatePicker />
                <SidebarSeparator className="mx-0" />
                <Calendars calendars={data.calendars} />
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        {activeCalendarMembership.role === "owner" ? (
                            <>
                                <SidebarMenuButton>
                                    <Trash2 />
                                    <span>휴지통</span>
                                </SidebarMenuButton>
                                <SidebarMenuButton
                                    onClick={() =>
                                        openSettings("calendar_general")
                                    }
                                >
                                    <Settings />
                                    <span>설정</span>
                                </SidebarMenuButton>
                            </>
                        ) : null}
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
