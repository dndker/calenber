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

export function Calendars({
    calendars,
}: {
    calendars: {
        name: string
        items: string[]
    }[]
}) {
    return (
        <>
            {calendars.map((calendar) => (
                <React.Fragment key={calendar.name}>
                    <SidebarGroup key={calendar.name}>
                        <Collapsible
                            defaultOpen={true}
                            className="group/collapsible"
                        >
                            <SidebarGroupLabel
                                asChild
                                className="group/label w-full text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            >
                                <CollapsibleTrigger>
                                    {calendar.name}
                                    <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                                </CollapsibleTrigger>
                            </SidebarGroupLabel>
                            <CollapsibleContent>
                                <SidebarGroupContent>
                                    <SidebarMenu>
                                        {calendar.items.map((item, index) => (
                                            <SidebarMenuItem key={item}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <SidebarMenuButton
                                                            asChild
                                                            className="py-0!"
                                                        >
                                                            <Field
                                                                orientation="horizontal"
                                                                data-disabled={
                                                                    index === 2
                                                                }
                                                            >
                                                                <Checkbox
                                                                    id={`calendar-checkbox-${item}-${index}`}
                                                                    name={`calendar-checkbox-${item}-${index}`}
                                                                    disabled={
                                                                        index ===
                                                                        2
                                                                    }
                                                                />
                                                                <FieldLabel
                                                                    htmlFor={`calendar-checkbox-${item}-${index}`}
                                                                    className="h-full cursor-pointer"
                                                                >
                                                                    {item}
                                                                </FieldLabel>
                                                            </Field>
                                                        </SidebarMenuButton>
                                                    </TooltipTrigger>
                                                    {index === 2 && (
                                                        <TooltipContent side="bottom">
                                                            <p>
                                                                사용이
                                                                중지되었습니다.
                                                            </p>
                                                        </TooltipContent>
                                                    )}
                                                </Tooltip>
                                            </SidebarMenuItem>
                                        ))}
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
}
