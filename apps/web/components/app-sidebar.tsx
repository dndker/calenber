"use client"

import * as React from "react"

import { CalendarFilter } from "@/components/calendar-filter"
import { DatePicker } from "@/components/date-picker"
import { NavUser } from "@/components/nav-user"
import { useSettingsModal } from "@/components/settings/settings-modal-provider"
import { eventStatus, eventStatusLabel } from "@/store/calendar-store.types"
import { shallow } from "@/store/createSSRStore"
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
import { Settings } from "lucide-react"
import { CalendarSidebarEvents } from "./calendar-sidebar-events"

const fallbackUser = {
    user: {
        id: "1",
        name: "woong",
        email: "example@gmail.com",
        avatarUrl: "/icons/square/ios/144.png",
    },
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const user = useAuthStore((s) => s.user)
    const { openSettings } = useSettingsModal()
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )
    const eventCategories = useCalendarStore((s) => s.eventCategories)
    const eventFilters = useCalendarStore((s) => s.eventFilters, shallow)
    const toggleEventStatusFilter = useCalendarStore(
        (s) => s.toggleEventStatusFilter
    )
    const toggleEventCategoryFilter = useCalendarStore(
        (s) => s.toggleEventCategoryFilter
    )

    const excludedStatusSet = React.useMemo(
        () => new Set(eventFilters.excludedStatuses),
        [eventFilters.excludedStatuses]
    )
    const excludedCategoryIdSet = React.useMemo(
        () => new Set(eventFilters.excludedCategoryIds),
        [eventFilters.excludedCategoryIds]
    )

    const filterGroups = React.useMemo(
        () => [
            {
                id: "status",
                name: "상태",
                items: eventStatus.map((status) => ({
                    id: status,
                    label: eventStatusLabel[status],
                    checked: !excludedStatusSet.has(status),
                })),
            },
            {
                id: "category",
                name: "카테고리",
                items:
                    eventCategories.length > 0
                        ? eventCategories.map((category) => ({
                              id: category.id,
                              label: category.name,
                              color: category.options.color,
                              checked: !excludedCategoryIdSet.has(category.id),
                          }))
                        : [
                              //   {
                              //       id: "empty-category",
                              //       label: "등록된 카테고리가 없습니다.",
                              //       checked: false,
                              //       disabled: false,
                              //   },
                          ],
            },
        ],
        [eventCategories, excludedCategoryIdSet, excludedStatusSet]
    )

    const handleFilterItemCheckedChange = React.useCallback(
        (groupId: string, itemId: string) => {
            if (groupId === "status") {
                toggleEventStatusFilter(itemId as (typeof eventStatus)[number])
                return
            }

            if (groupId === "category") {
                toggleEventCategoryFilter(itemId)
            }
        },
        [toggleEventCategoryFilter, toggleEventStatusFilter]
    )

    return (
        <Sidebar {...props}>
            <SidebarHeader className="h-16 border-b border-sidebar-border">
                <NavUser
                    user={
                        user
                            ? { ...fallbackUser.user, ...user }
                            : fallbackUser.user
                    }
                />
            </SidebarHeader>
            <SidebarContent>
                <DatePicker />
                <SidebarSeparator className="mx-0" />

                <CalendarSidebarEvents />

                <CalendarFilter
                    groups={filterGroups}
                    onItemCheckedChange={handleFilterItemCheckedChange}
                />
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
