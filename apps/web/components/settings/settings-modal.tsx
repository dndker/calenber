"use client"

import { CalendarGeneralSettingsPanel } from "@/components/settings/panels/calendar-general-settings-panel"
import { CalendarMembersSettingsPanel } from "@/components/settings/panels/calendar-members-settings-panel"
import { EmptySettingsPanel } from "@/components/settings/panels/empty-settings-panel"
import { ProfileNotificationSettingsPanel } from "@/components/settings/panels/profile-notification-settings-panel"
import { ProfileSettingsPanel } from "@/components/settings/panels/profile-settings-panel"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@workspace/ui/components/dialog"
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
import { BellIcon, Calendar1Icon, Settings2Icon, UsersIcon } from "lucide-react"
import type { ComponentType } from "react"
import { useState } from "react"

export type SettingsTabId =
    | "profile"
    | "profile_notification"
    | "calendar_general"
    | "calendar_members"

const SETTINGS_TABS: Array<{
    id: SettingsTabId
    label: string
    group: "account" | "calendar"
    icon: typeof Settings2Icon
}> = [
    {
        id: "profile",
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
        icon: Calendar1Icon,
    },
    {
        id: "calendar_members",
        label: "맴버",
        group: "calendar",
        icon: UsersIcon,
    },
]

const SETTINGS_TAB_PANELS: Partial<Record<SettingsTabId, ComponentType>> = {
    profile: ProfileSettingsPanel,
    profile_notification: ProfileNotificationSettingsPanel,
    calendar_general: CalendarGeneralSettingsPanel,
    calendar_members: CalendarMembersSettingsPanel,
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
    const fallbackTab = SETTINGS_TABS[0]?.id ?? initialTab
    const [activeTab, setActiveTab] = useState<SettingsTabId>(
        SETTINGS_TABS.find((tab) => tab.id === initialTab)?.id ?? fallbackTab
    )

    return (
        <div className="flex h-full overflow-hidden">
            <Sidebar className="relative h-full w-60 shrink-0 border-r-0!">
                <SidebarContent className="h-full p-1">
                    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                        <SidebarGroupLabel>계정 설정</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {SETTINGS_TABS.filter(
                                    (tab) => tab.group === "account"
                                ).map((tab) => (
                                    <SidebarMenuItem key={tab.id}>
                                        <SidebarMenuButton
                                            isActive={activeTab === tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                        >
                                            <tab.icon />
                                            <span>{tab.label}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>

                    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                        <SidebarGroupLabel>캘린더</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {SETTINGS_TABS.filter(
                                    (tab) => tab.group === "calendar"
                                ).map((tab) => (
                                    <SidebarMenuItem key={tab.id}>
                                        <SidebarMenuButton
                                            isActive={activeTab === tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                        >
                                            <tab.icon />
                                            <span>{tab.label}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>

            <section className="flex-1 overflow-auto p-8">
                <div className="mx-auto max-w-200">
                    {SETTINGS_TABS.map((tab) => (
                        <SettingsPanelSlot
                            key={tab.id}
                            tabId={tab.id}
                            tabLabel={tab.label}
                            active={activeTab === tab.id}
                        />
                    ))}
                </div>
            </section>
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
