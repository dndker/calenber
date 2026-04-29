"use client"

import * as React from "react"

import { CalendarFilter } from "@/components/calendar-filter"
import { DatePicker } from "@/components/date-picker"
import { NavUser } from "@/components/nav-user"
import { useSettingsModal } from "@/components/settings/settings-modal-provider"
import {
    eventStatus,
    eventStatusTranslationKey,
} from "@/store/calendar-store.types"
import { shallow } from "@/store/createSSRStore"
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
import { Settings } from "lucide-react"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { CalendarSubscriptionManager } from "./calendar-subscription-manager"
import { CalendarSidebarEvents } from "./calendar-sidebar-events"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const tFilter = useDebugTranslations("calendar.filterSidebar")
    const tStatus = useDebugTranslations("event.status")
    const tCollection = useDebugTranslations("calendar.collection")
    const tSettings = useDebugTranslations("settings")
    const { openSettings } = useSettingsModal()
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )
    const eventCollections = useCalendarStore((s) => s.eventCollections)
    const eventFilters = useCalendarStore((s) => s.eventFilters, shallow)
    const toggleEventStatusFilter = useCalendarStore(
        (s) => s.toggleEventStatusFilter
    )
    const toggleEventCollectionFilter = useCalendarStore(
        (s) => s.toggleEventCollectionFilter
    )
    const setExcludedWithoutCollectionFilter = useCalendarStore(
        (s) => s.setExcludedWithoutCollectionFilter
    )

    const excludedStatusSet = React.useMemo(
        () => new Set(eventFilters.excludedStatuses),
        [eventFilters.excludedStatuses]
    )
    const excludedCollectionIdSet = React.useMemo(
        () => new Set(eventFilters.excludedCollectionIds),
        [eventFilters.excludedCollectionIds]
    )

    const filterGroups = React.useMemo(
        () => [
            {
                id: "status",
                name: tFilter("statusGroup"),
                items: eventStatus.map((status) => ({
                    id: status,
                    label: tStatus(eventStatusTranslationKey[status]),
                    checked: !excludedStatusSet.has(status),
                })),
            },
            {
                id: "collection",
                name: tFilter("collectionGroup"),
                items: [
                    {
                        id: "__without_collection__",
                        label: tCollection("noCollection"),
                        checked: !eventFilters.excludedWithoutCollection,
                    },
                    ...eventCollections.map((collection) => ({
                        id: collection.id,
                        label: collection.name,
                        color: collection.options.color,
                        checked: !excludedCollectionIdSet.has(collection.id),
                    })),
                ],
            },
        ],
        [
            eventCollections,
            eventFilters.excludedWithoutCollection,
            excludedCollectionIdSet,
            excludedStatusSet,
            tCollection,
            tFilter,
            tStatus,
        ]
    )

    const handleFilterItemCheckedChange = React.useCallback(
        (groupId: string, itemId: string, checked: boolean) => {
            if (groupId === "status") {
                toggleEventStatusFilter(itemId as (typeof eventStatus)[number])
                return
            }

            if (groupId === "collection") {
                if (itemId === "__without_collection__") {
                    setExcludedWithoutCollectionFilter(!checked)
                    return
                }
                toggleEventCollectionFilter(itemId)
            }
        },
        [
            setExcludedWithoutCollectionFilter,
            toggleEventCollectionFilter,
            toggleEventStatusFilter,
        ]
    )

    return (
        <Sidebar {...props}>
            <SidebarHeader className="h-16 border-b border-sidebar-border">
                <NavUser />
            </SidebarHeader>
            <SidebarContent>
                <DatePicker />
                <SidebarSeparator className="mx-0" />

                <CalendarSidebarEvents />

                <CalendarFilter
                    groups={filterGroups}
                    onItemCheckedChange={handleFilterItemCheckedChange}
                />
                <CalendarSubscriptionManager />
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        {activeCalendarMembership.role === "owner" ? (
                            <>
                                {/* <SidebarMenuButton>
                                    <Trash2 />
                                    <span>휴지통</span>
                                </SidebarMenuButton> */}
                                <SidebarMenuButton
                                    onClick={() =>
                                        openSettings("calendar_general")
                                    }
                                >
                                    <Settings />
                                    <span>{tSettings("title")}</span>
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
