"use client"

import type { CalendarEventFieldId } from "@/store/calendar-store.types"
import { useSortable } from "@dnd-kit/sortable"
import { Button } from "@workspace/ui/components/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Field } from "@workspace/ui/components/field"
import { cn } from "@workspace/ui/lib/utils"
import type { LucideIcon } from "lucide-react"
import { EyeOffIcon, GripVerticalIcon } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"

export type EventFormPropertyVisibility = "visible" | "hidden"

type EventFormPropertyMenuRadioOption = {
    value: string
    label: string
}

export type EventFormPropertyMenuItem =
    | {
          type: "item"
          key: string
          label: string
          icon?: LucideIcon
          onSelect?: () => void
          disabled?: boolean
      }
    | {
          type: "separator"
          key: string
      }
    | {
          type: "submenu"
          key: string
          label: string
          icon?: LucideIcon
          items: EventFormPropertyMenuItem[]
      }
    | {
          type: "radio-group"
          key: string
          value: string
          onValueChange?: (value: string) => void
          items: EventFormPropertyMenuRadioOption[]
      }
    | {
          type: "panel"
          key: string
          label: string
          icon?: LucideIcon
          disabled?: boolean
          content: ReactNode
          contentClassName?: string
      }

type PropertyPanelMenuItem = Extract<
    EventFormPropertyMenuItem,
    { type: "panel" }
>

function findPanelMenuItem(
    items: EventFormPropertyMenuItem[],
    key: string | null
): PropertyPanelMenuItem | null {
    if (!key) {
        return null
    }

    for (const item of items) {
        if (item.type === "panel" && item.key === key) {
            return item
        }

        if (item.type === "submenu") {
            const nestedPanel = findPanelMenuItem(item.items, key)

            if (nestedPanel) {
                return nestedPanel
            }
        }
    }

    return null
}

function renderMenuItems({
    items,
    onOpenPanel,
}: {
    items: EventFormPropertyMenuItem[]
    onOpenPanel: (key: string) => void
}) {
    return items.map((item) => {
        if (item.type === "separator") {
            return <DropdownMenuSeparator key={item.key} />
        }

        if (item.type === "item") {
            const Icon = item.icon

            return (
                <DropdownMenuItem
                    key={item.key}
                    onSelect={() => {
                        item.onSelect?.()
                    }}
                    disabled={item.disabled}
                >
                    {Icon ? <Icon /> : null}
                    {item.label}
                </DropdownMenuItem>
            )
        }

        if (item.type === "panel") {
            const Icon = item.icon

            return (
                <DropdownMenuItem
                    key={item.key}
                    onSelect={(event) => {
                        event.preventDefault()
                        onOpenPanel(item.key)
                    }}
                    disabled={item.disabled}
                >
                    {Icon ? <Icon /> : null}
                    {item.label}
                </DropdownMenuItem>
            )
        }

        if (item.type === "radio-group") {
            return (
                <DropdownMenuRadioGroup
                    key={item.key}
                    value={item.value}
                    onValueChange={item.onValueChange}
                >
                    {item.items.map((option) => (
                        <DropdownMenuRadioItem
                            key={option.value}
                            value={option.value}
                        >
                            {option.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            )
        }

        const Icon = item.icon

        return (
            <DropdownMenuSub key={item.key}>
                <DropdownMenuSubTrigger>
                    {Icon ? <Icon /> : null}
                    {item.label}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                        <DropdownMenuGroup>
                            {renderMenuItems({
                                items: item.items,
                                onOpenPanel,
                            })}
                        </DropdownMenuGroup>
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
        )
    })
}

export function EventFormPropertyRow({
    fieldId,
    label,
    icon: Icon,
    disabled = false,
    visibility = "visible",
    onVisibilityChange,
    commonMenuItems = [],
    propertyMenuItems = [],
    propertyMenuItemsPlacement = "after-common",
    children,
}: {
    fieldId: CalendarEventFieldId
    label: string
    icon: LucideIcon
    disabled?: boolean
    visibility?: EventFormPropertyVisibility
    onVisibilityChange?: (value: EventFormPropertyVisibility) => void
    commonMenuItems?: EventFormPropertyMenuItem[]
    propertyMenuItems?: EventFormPropertyMenuItem[]
    propertyMenuItemsPlacement?: "before-common" | "after-common"
    children: ReactNode
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: fieldId,
        disabled,
    })
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [activePanelKey, setActivePanelKey] = useState<string | null>(null)
    const defaultMenuItems = useMemo<EventFormPropertyMenuItem[]>(
        () => [
            {
                type: "submenu",
                key: "visibility",
                label: "속성 표시 여부",
                icon: EyeOffIcon,
                items: [
                    {
                        type: "radio-group",
                        key: "visibility-options",
                        value: visibility,
                        onValueChange: (value) => {
                            if (value === "visible" || value === "hidden") {
                                onVisibilityChange?.(value)
                            }
                        },
                        items: [
                            {
                                value: "visible",
                                label: "항상 표시",
                            },
                            {
                                value: "hidden",
                                label: "항상 숨김",
                            },
                        ],
                    },
                ],
            },
            ...commonMenuItems,
        ],
        [commonMenuItems, onVisibilityChange, visibility]
    )
    const menuItems = useMemo<EventFormPropertyMenuItem[]>(
        () =>
            propertyMenuItemsPlacement === "before-common"
                ? [
                      ...propertyMenuItems,
                      ...(propertyMenuItems.length > 0 &&
                      defaultMenuItems.length > 0
                          ? ([
                                {
                                    type: "separator",
                                    key: "property-menu-separator",
                                },
                            ] as const)
                          : []),
                      ...defaultMenuItems,
                  ]
                : [
                      ...defaultMenuItems,
                      ...(propertyMenuItems.length > 0
                          ? ([
                                {
                                    type: "separator",
                                    key: "property-menu-separator",
                                },
                            ] as const)
                          : []),
                      ...propertyMenuItems,
                  ],
        [defaultMenuItems, propertyMenuItems, propertyMenuItemsPlacement]
    )
    const activePanel = useMemo(
        () => findPanelMenuItem(menuItems, activePanelKey),
        [activePanelKey, menuItems]
    )

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: transform
                    ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
                    : undefined,
                transition,
            }}
            className={cn(
                "rounded-xl",
                isDragging && "z-10 cursor-grabbing bg-muted"
            )}
        >
            <Field className="md:flex-row md:gap-3">
                <div className="flex h-8.5 items-center gap-1 md:w-32.5">
                    <div className="group/property-row flex h-8.5 min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 text-sm font-medium text-foreground hover:bg-muted has-data-open:bg-muted">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="hidden h-7 w-4 cursor-grab text-muted-foreground group-hover/property-row:flex active:cursor-grabbing"
                            disabled={disabled}
                            aria-label={`${label} 속성 순서 변경`}
                            {...attributes}
                            {...listeners}
                        >
                            <GripVerticalIcon className="size-4" />
                        </Button>
                        <Icon className="inline-flex size-4 shrink-0 group-hover/property-row:hidden" />
                        <DropdownMenu
                            open={isMenuOpen}
                            onOpenChange={(nextOpen) => {
                                setIsMenuOpen(nextOpen)

                                if (!nextOpen) {
                                    setActivePanelKey(null)
                                }
                            }}
                        >
                            <DropdownMenuTrigger asChild>
                                <span className="flex h-full flex-1 cursor-pointer items-center truncate">
                                    {label}
                                </span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="start"
                                className={cn(
                                    activePanel
                                        ? activePanel.contentClassName
                                        : "w-full"
                                )}
                            >
                                {activePanel ? (
                                    activePanel.content
                                ) : (
                                    <DropdownMenuGroup>
                                        {renderMenuItems({
                                            items: menuItems,
                                            onOpenPanel: (key) => {
                                                setActivePanelKey(key)
                                            },
                                        })}
                                    </DropdownMenuGroup>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
                <div className="min-w-0 flex-1">{children}</div>
            </Field>
        </div>
    )
}
