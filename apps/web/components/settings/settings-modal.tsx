"use client"

import { CalendarGeneralSettingsPanel } from "@/components/settings/panels/calendar-general-settings-panel"
import { CalendarMembersSettingsPanel } from "@/components/settings/panels/calendar-members-settings-panel"
import { EmptySettingsPanel } from "@/components/settings/panels/empty-settings-panel"
import { ProfileNotificationSettingsPanel } from "@/components/settings/panels/profile-notification-settings-panel"
import { ProfileSettingsPanel } from "@/components/settings/panels/profile-settings-panel"
import { canViewCalendarSettings } from "@/lib/calendar/permissions"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@workspace/ui/components/avatar"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@workspace/ui/components/dialog"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import {
    BellIcon,
    CalendarsIcon,
    Settings2Icon,
    SettingsIcon,
    UsersIcon,
} from "lucide-react"
import type { ComponentType } from "react"
import { useState } from "react"
import { CalendarDataSettingsPanel } from "./panels/calendar-data-settings-panel"
import { ProfileGeneralSettingsPanel } from "./panels/profile-general-settings-panel"

export type SettingsTabId =
    | "profile"
    | "profile_general"
    | "profile_notification"
    | "calendar_general"
    | "calendar_members"
    | "calendar_data"

const SETTINGS_TABS: Array<{
    id: SettingsTabId
    label: string
    group: "account" | "calendar"
    icon: typeof Settings2Icon
}> = [
    {
        id: "profile",
        label: "프로필",
        group: "account",
        icon: Settings2Icon,
    },
    {
        id: "profile_general",
        label: "기본 설정",
        group: "account",
        icon: Settings2Icon,
    },
    {
        id: "profile_notification",
        label: "알림",
        group: "account",
        icon: BellIcon,
    },
    {
        id: "calendar_general",
        label: "일반",
        group: "calendar",
        icon: SettingsIcon,
    },
    {
        id: "calendar_members",
        label: "멤버",
        group: "calendar",
        icon: UsersIcon,
    },
    {
        id: "calendar_data",
        label: "데이터",
        group: "calendar",
        icon: CalendarsIcon,
    },
]

const SETTINGS_TAB_PANELS: Partial<Record<SettingsTabId, ComponentType>> = {
    profile: ProfileSettingsPanel,
    profile_general: ProfileGeneralSettingsPanel,
    profile_notification: ProfileNotificationSettingsPanel,
    calendar_general: CalendarGeneralSettingsPanel,
    calendar_members: CalendarMembersSettingsPanel,
    calendar_data: CalendarDataSettingsPanel,
}

export function SettingsModal({
    open,
    onOpenChange,
    title = "설정",
    initialTab = "profile",
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title?: string
    initialTab?: SettingsTabId
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                aria-describedby={undefined}
                showCloseButton
                className="h-[calc(100dvh-100px)] w-[90vw] max-w-378! gap-0 overflow-hidden p-0"
            >
                <VisuallyHidden>
                    <DialogHeader className="border-b px-6 py-4">
                        <DialogTitle>{title}</DialogTitle>
                    </DialogHeader>
                </VisuallyHidden>
                {open ? (
                    <SettingsModalBody
                        key={initialTab}
                        initialTab={initialTab}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    )
}

function SettingsModalBody({ initialTab }: { initialTab: SettingsTabId }) {
    const user = useAuthStore((s) => s.user)
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )
    const fallbackTab = SETTINGS_TABS[0]?.id ?? initialTab
    const canViewCalendarTabs = canViewCalendarSettings(
        activeCalendarMembership
    )
    const availableTabs = SETTINGS_TABS.filter(
        (tab) =>
            tab.group === "account" || (activeCalendar && canViewCalendarTabs)
    )
    const [activeTab, setActiveTab] = useState<SettingsTabId>(
        availableTabs.find((tab) => tab.id === initialTab)?.id ?? fallbackTab
    )
    const resolvedActiveTab = availableTabs.some((tab) => tab.id === activeTab)
        ? activeTab
        : (availableTabs[0]?.id ?? fallbackTab)

    return (
        <div className="flex h-full overflow-hidden bg-background">
            <Sidebar className="relative h-full w-60 shrink-0 border-r-0!">
                <SidebarContent className="h-full p-1">
                    {user && (
                        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                            <SidebarGroupLabel className="px-2.5">
                                계정 설정
                            </SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu className="gap-1">
                                    {availableTabs
                                        .filter(
                                            (tab) => tab.group === "account"
                                        )
                                        .map((tab) => (
                                            <SidebarMenuItem key={tab.id}>
                                                <SidebarMenuButton
                                                    isActive={
                                                        resolvedActiveTab ===
                                                        tab.id
                                                    }
                                                    onClick={() =>
                                                        setActiveTab(tab.id)
                                                    }
                                                >
                                                    {tab.id === "profile" ? (
                                                        <Avatar
                                                            size="sm"
                                                            className="size-5.5! ring-1 ring-border"
                                                        >
                                                            <AvatarImage
                                                                className="cursor-pointer"
                                                                src={
                                                                    user.avatarUrl ??
                                                                    undefined
                                                                }
                                                                alt={
                                                                    user.name ||
                                                                    ""
                                                                }
                                                            />
                                                            <AvatarFallback className="text-2xl leading-[normal] font-medium">
                                                                {user.name?.[0]?.toUpperCase() ||
                                                                    ""}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    ) : (
                                                        <div className="flex size-5.5 items-center justify-center">
                                                            <tab.icon className="size-4.25!" />
                                                        </div>
                                                    )}
                                                    <span>{tab.label}</span>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    )}

                    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                        <SidebarGroupLabel className="px-2.5">
                            캘린더
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu className="gap-1">
                                {availableTabs
                                    .filter((tab) => tab.group === "calendar")
                                    .map((tab) => (
                                        <SidebarMenuItem key={tab.id}>
                                            <SidebarMenuButton
                                                isActive={
                                                    resolvedActiveTab === tab.id
                                                }
                                                onClick={() =>
                                                    setActiveTab(tab.id)
                                                }
                                            >
                                                <div className="flex size-5.5 items-center justify-center">
                                                    <tab.icon className="size-4.25!" />
                                                </div>
                                                <span>{tab.label}</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>

            <ScrollArea className="flex-1 overflow-auto">
                <div className="p-8">
                    <div className="mx-auto max-w-200">
                        {availableTabs.map((tab) => (
                            <SettingsPanelSlot
                                key={tab.id}
                                tabId={tab.id}
                                tabLabel={tab.label}
                                active={resolvedActiveTab === tab.id}
                            />
                        ))}
                    </div>
                </div>
            </ScrollArea>
        </div>
    )
}

function SettingsPanelSlot({
    tabId,
    tabLabel,
    active,
}: {
    tabId: SettingsTabId
    tabLabel: string
    active: boolean
}) {
    const Panel = SETTINGS_TAB_PANELS[tabId] ?? EmptySettingsPanel

    return (
        <div
            data-tab={tabId}
            hidden={!active}
            className="flex h-full flex-col gap-9"
        >
            <div className="text-[26px] font-bold">{tabLabel}</div>
            <Panel />
        </div>
    )
}
