"use client"

import * as React from "react"

import { Checkbox } from "@workspace/ui/components/checkbox"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
} from "@workspace/ui/components/sidebar"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { ChevronRightIcon } from "lucide-react"

export const CalendarFilter = React.memo(function CalendarFilter({
    groups,
    onItemCheckedChange,
}: {
    groups: {
        id: string
        name: string
        items: {
            id: string
            label: string
            checked: boolean
            disabled?: boolean
            description?: string
        }[]
    }[]
    onItemCheckedChange?: (
        groupId: string,
        itemId: string,
        checked: boolean
    ) => void
}) {
    return (
        <>
            {groups.map((group) => (
                <React.Fragment key={group.id}>
                    <SidebarGroup>
                        <Collapsible
                            defaultOpen={true}
                            className="group/collapsible"
                        >
                            <SidebarGroupLabel
                                asChild
                                className="group/label w-full text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            >
                                <CollapsibleTrigger>
                                    {group.name}
                                    <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                                </CollapsibleTrigger>
                            </SidebarGroupLabel>
                            <CollapsibleContent>
                                <SidebarGroupContent>
                                    <SidebarMenu>
                                        {group.items.map((item, index) => {
                                            return (
                                                <SidebarMenuItem key={item.id}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <SidebarMenuButton
                                                                asChild
                                                                className="py-0!"
                                                            >
                                                                <Field
                                                                    orientation="horizontal"
                                                                    data-disabled={
                                                                        item.disabled
                                                                    }
                                                                >
                                                                    <Checkbox
                                                                        id={`calendar-checkbox-${group.id}-${item.id}-${index}`}
                                                                        name={`calendar-checkbox-${group.id}-${item.id}-${index}`}
                                                                        checked={item.checked}
                                                                        disabled={item.disabled}
                                                                        onCheckedChange={(
                                                                            checked
                                                                        ) => {
                                                                            if (
                                                                                item.disabled
                                                                            ) {
                                                                                return
                                                                            }

                                                                            onItemCheckedChange?.(
                                                                                group.id,
                                                                                item.id,
                                                                                Boolean(
                                                                                    checked
                                                                                )
                                                                            )
                                                                        }}
                                                                    />
                                                                    <FieldLabel
                                                                        htmlFor={`calendar-checkbox-${group.id}-${item.id}-${index}`}
                                                                        className="h-full cursor-pointer"
                                                                    >
                                                                        {item.label}
                                                                    </FieldLabel>
                                                                </Field>
                                                            </SidebarMenuButton>
                                                        </TooltipTrigger>
                                                        {item.disabled && (
                                                            <TooltipContent side="bottom">
                                                                <p>
                                                                    {item.description ??
                                                                        "사용이 중지되었습니다."}
                                                                </p>
                                                            </TooltipContent>
                                                        )}
                                                    </Tooltip>
                                                </SidebarMenuItem>
                                            )
                                        })}
                                    </SidebarMenu>
                                </SidebarGroupContent>
                            </CollapsibleContent>
                        </Collapsible>
                    </SidebarGroup>
                    <SidebarSeparator className="mx-0" />
                </React.Fragment>
            ))}
        </>
    )
})

CalendarFilter.displayName = "CalendarFilter"
