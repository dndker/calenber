"use client"

import {
    ArrowDown,
    ArrowUp,
    Copy,
    CornerUpLeft,
    CornerUpRight,
    FileText,
    GalleryVerticalEnd,
    Info,
    LineChart,
    Link as LinkIcon,
    MoreHorizontal,
    Search,
    Settings2,
    Trash,
    Trash2,
} from "lucide-react"
import * as React from "react"

import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { Button } from "@workspace/ui/components/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import Link from "next/link"
import { CalendarWorkspacePresenceGroup } from "./calendar-workspace-presence-group"
import ThemeSwitch from "./theme-switch"
import { NotificationDropdown } from "./notifications/notification-dropdown"

const data = [
    [
        {
            label: "Customize Page",
            icon: Settings2,
        },
        {
            label: "Turn into wiki",
            icon: FileText,
        },
    ],
    [
        {
            label: "Copy Link",
            icon: LinkIcon,
        },
        {
            label: "Duplicate",
            icon: Copy,
        },
        {
            label: "Move to",
            icon: CornerUpRight,
        },
        {
            label: "Move to Trash",
            icon: Trash2,
        },
    ],
    [
        {
            label: "Undo",
            icon: CornerUpLeft,
        },
        {
            label: "View analytics",
            icon: LineChart,
        },
        {
            label: "Version History",
            icon: GalleryVerticalEnd,
        },
        {
            label: "Show delete pages",
            icon: Trash,
        },
    ],
    [
        {
            label: "Import",
            icon: ArrowUp,
        },
        {
            label: "Export",
            icon: ArrowDown,
        },
    ],
]

export function NavActions() {
    const t = useDebugTranslations("auth.signUp")
    const calendarTimezone = useCalendarStore((s) => s.calendarTimezone)
    const setCalendarTimezone = useCalendarStore((s) => s.setCalendarTimezone)

    const isLoggedIn = useAuthStore((s) => s.user != null)

    const [isOpen, setIsOpen] = React.useState(false)
    const [isNotifOpen, setIsNotifOpen] = React.useState(false)

    return (
        <div className="flex items-center gap-1 text-sm">
            <CalendarWorkspacePresenceGroup />

            {!isLoggedIn && (
                <Button
                    variant="default"
                    className="mr-1 leading-[normal] font-bold"
                    asChild
                    size="sm"
                >
                    <Link href="/signin">{t("signInLink")}</Link>
                </Button>
            )}

            <Button variant="ghost" size="icon" className="size-8 sm:hidden">
                <Search className="size-4.5" />
            </Button>

            <ThemeSwitch />

            {isLoggedIn && (
                <NotificationDropdown
                    open={isNotifOpen}
                    onOpenChange={setIsNotifOpen}
                />
            )}

            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 data-[state=open]:bg-accent"
                    >
                        <MoreHorizontal className="size-5" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-56 overflow-hidden rounded-lg p-0"
                    align="end"
                >
                    <Sidebar collapsible="none" className="bg-transparent">
                        <SidebarContent>
                            <SidebarGroup className="border-b">
                                <SidebarGroupContent className="gap-0">
                                    <SidebarMenu>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton asChild>
                                                <a href="/docs" target="_blank">
                                                    <Info />
                                                    Support
                                                </a>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    </SidebarMenu>
                                </SidebarGroupContent>
                            </SidebarGroup>
                            {data.map((group, index) => (
                                <SidebarGroup
                                    key={index}
                                    className="border-b last:border-none"
                                >
                                    <SidebarGroupContent className="gap-0">
                                        <SidebarMenu>
                                            {group.map((item, index) => (
                                                <SidebarMenuItem key={index}>
                                                    <SidebarMenuButton>
                                                        <item.icon />{" "}
                                                        <span>
                                                            {item.label}
                                                        </span>
                                                    </SidebarMenuButton>
                                                </SidebarMenuItem>
                                            ))}
                                        </SidebarMenu>
                                    </SidebarGroupContent>
                                </SidebarGroup>
                            ))}
                        </SidebarContent>
                    </Sidebar>
                </PopoverContent>
            </Popover>
        </div>
    )
}
