"use client"

import {
    calendarCategoryColorLabels,
    calendarCategoryColors,
    getCalendarCategoryLabelClassName,
    getCalendarCategoryPaletteClassName,
    type CalendarCategoryColor,
} from "@/lib/calendar/category-color"
import {
    createCalendarEventCategory,
    deleteCalendarEventCategory,
    updateCalendarEventCategory,
} from "@/lib/calendar/mutations"
import { createBrowserSupabase } from "@/lib/supabase/client"
import type { CalendarEventCategory } from "@/store/calendar-store.types"
import { useCalendarStore } from "@/store/useCalendarStore"
import { Button } from "@workspace/ui/components/button"
import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

function normalizeCategoryName(value: string) {
    return value.trim().toLowerCase()
}

function CategoryRenameInput({
    category,
    disabled,
    isSaving,
    onRename,
}: {
    category: CalendarEventCategory
    disabled: boolean
    isSaving: boolean
    onRename: (categoryId: string, nextName: string) => Promise<boolean>
}) {
    const [draft, setDraft] = useState(category.name)
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    const flushRename = useCallback(
        async (value: string) => {
            const trimmedValue = value.trim()
            const trimmedName = category.name.trim()

            if (!trimmedValue) {
                setDraft(category.name)
                return
            }

            if (trimmedValue === trimmedName) {
                if (value !== category.name) {
                    setDraft(category.name)
                }
                return
            }

            const ok = await onRename(category.id, trimmedValue)

            if (!ok) {
                setDraft(category.name)
            }
        },
        [category.id, category.name, onRename]
    )
    useEffect(() => {
        if (disabled || isSaving) {
            return
        }

        const trimmedDraft = draft.trim()
        const trimmedName = category.name.trim()

        if (!trimmedDraft || trimmedDraft === trimmedName) {
            return
        }

        debounceRef.current = setTimeout(() => {
            void flushRename(draft)
        }, 450)

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
                debounceRef.current = null
            }
        }
    }, [category.name, disabled, draft, flushRename, isSaving])

    return (
        <div className="flex items-center gap-2 p-1">
            <Input
                value={draft}
                disabled={disabled}
                onChange={(event) => {
                    setDraft(event.target.value)
                }}
                onBlur={() => {
                    if (debounceRef.current) {
                        clearTimeout(debounceRef.current)
                        debounceRef.current = null
                    }

                    void flushRename(draft)
                }}
                onKeyDown={(event) => {
                    event.stopPropagation()

                    if (event.key === "Enter") {
                        event.preventDefault()
                        event.currentTarget.blur()
                        return
                    }

                    if (event.key === "Escape") {
                        if (debounceRef.current) {
                            clearTimeout(debounceRef.current)
                            debounceRef.current = null
                        }

                        setDraft(category.name)
                        event.currentTarget.blur()
                    }
                }}
                placeholder="카테고리 이름"
                className="h-8"
            />
            {isSaving ? <Spinner className="size-4 shrink-0" /> : null}
        </div>
    )
}

export const EventCategorySettingsPanel = memo(
    function EventCategorySettingsPanel({
        disabled = false,
    }: {
        disabled?: boolean
    }) {
        const activeCalendar = useCalendarStore((state) => state.activeCalendar)
        const eventCategories = useCalendarStore(
            (state) => state.eventCategories
        )
        const upsertEventCategorySnapshot = useCalendarStore(
            (state) => state.upsertEventCategorySnapshot
        )
        const removeEventCategorySnapshot = useCalendarStore(
            (state) => state.removeEventCategorySnapshot
        )
        const [isCreateInputOpen, setIsCreateInputOpen] = useState(false)
        const [newCategoryName, setNewCategoryName] = useState("")
        const [isCreatingCategory, setIsCreatingCategory] = useState(false)
        const [busyCategoryIds, setBusyCategoryIds] = useState<string[]>([])
        const [openCategoryId, setOpenCategoryId] = useState<string | null>(
            null
        )

        const canManageCategories = Boolean(
            !disabled && activeCalendar?.id && activeCalendar.id !== "demo"
        )
        const busyCategoryIdSet = useMemo(
            () => new Set(busyCategoryIds),
            [busyCategoryIds]
        )

        const withBusyCategory = useCallback(
            async (categoryId: string, work: () => Promise<void>) => {
                setBusyCategoryIds((current) =>
                    current.includes(categoryId)
                        ? current
                        : [...current, categoryId]
                )

                try {
                    await work()
                } finally {
                    setBusyCategoryIds((current) =>
                        current.filter((item) => item !== categoryId)
                    )
                }
            },
            []
        )

        const createCategory = useCallback(async () => {
            if (!canManageCategories || !activeCalendar?.id) {
                return
            }

            const trimmedName = newCategoryName.trim()

            if (!trimmedName) {
                return
            }

            const existingCategory = eventCategories.find(
                (category) =>
                    normalizeCategoryName(category.name) ===
                    normalizeCategoryName(trimmedName)
            )

            if (existingCategory) {
                toast.message("이미 같은 이름의 카테고리가 있습니다.")
                setOpenCategoryId(existingCategory.id)
                setIsCreateInputOpen(false)
                setNewCategoryName("")
                return
            }

            setIsCreatingCategory(true)

            try {
                const supabase = createBrowserSupabase()
                const createdCategory = await createCalendarEventCategory(
                    supabase,
                    activeCalendar.id,
                    {
                        name: trimmedName,
                        options: {
                            visibleByDefault: true,
                        },
                    }
                )

                if (!createdCategory) {
                    throw new Error("Category create failed.")
                }

                upsertEventCategorySnapshot(createdCategory)
                setOpenCategoryId(createdCategory.id)
                setNewCategoryName("")
                setIsCreateInputOpen(false)
            } catch (error) {
                console.error("Failed to create calendar category:", error)
                toast.error("카테고리를 추가하지 못했습니다.")
            } finally {
                setIsCreatingCategory(false)
            }
        }, [
            activeCalendar?.id,
            canManageCategories,
            eventCategories,
            newCategoryName,
            upsertEventCategorySnapshot,
        ])

        const renameCategory = useCallback(
            async (categoryId: string, nextName: string) => {
                if (!canManageCategories) {
                    return false
                }

                const trimmedName = nextName.trim()

                if (!trimmedName) {
                    return false
                }

                const existingCategory = eventCategories.find(
                    (category) =>
                        category.id !== categoryId &&
                        normalizeCategoryName(category.name) ===
                            normalizeCategoryName(trimmedName)
                )

                if (existingCategory) {
                    toast.message("이미 같은 이름의 카테고리가 있습니다.")
                    return false
                }

                let isSuccess = false

                await withBusyCategory(categoryId, async () => {
                    try {
                        const supabase = createBrowserSupabase()
                        const updatedCategory =
                            await updateCalendarEventCategory(
                                supabase,
                                categoryId,
                                {
                                    name: trimmedName,
                                }
                            )

                        if (!updatedCategory) {
                            throw new Error("Category rename failed.")
                        }

                        upsertEventCategorySnapshot(updatedCategory)
                        isSuccess = true
                    } catch (error) {
                        console.error(
                            "Failed to rename calendar category:",
                            error
                        )
                        toast.error("카테고리 이름을 변경하지 못했습니다.")
                    }
                })

                return isSuccess
            },
            [
                canManageCategories,
                eventCategories,
                upsertEventCategorySnapshot,
                withBusyCategory,
            ]
        )

        const changeCategoryColor = useCallback(
            async (
                category: CalendarEventCategory,
                color: CalendarCategoryColor
            ) => {
                if (!canManageCategories || category.options.color === color) {
                    return
                }

                await withBusyCategory(category.id, async () => {
                    try {
                        const supabase = createBrowserSupabase()
                        const updatedCategory =
                            await updateCalendarEventCategory(
                                supabase,
                                category.id,
                                {
                                    options: {
                                        ...category.options,
                                        color,
                                    },
                                }
                            )

                        if (!updatedCategory) {
                            throw new Error("Category color update failed.")
                        }

                        upsertEventCategorySnapshot(updatedCategory)
                    } catch (error) {
                        console.error(
                            "Failed to update calendar category color:",
                            error
                        )
                        toast.error("카테고리 색상을 변경하지 못했습니다.")
                    }
                })
            },
            [canManageCategories, upsertEventCategorySnapshot, withBusyCategory]
        )

        const removeCategory = useCallback(
            async (category: CalendarEventCategory) => {
                if (!canManageCategories) {
                    return
                }

                await withBusyCategory(category.id, async () => {
                    try {
                        const supabase = createBrowserSupabase()
                        const ok = await deleteCalendarEventCategory(
                            supabase,
                            category.id
                        )

                        if (!ok) {
                            throw new Error("Category delete failed.")
                        }

                        removeEventCategorySnapshot(category.id)
                        setOpenCategoryId((current) =>
                            current === category.id ? null : current
                        )
                    } catch (error) {
                        console.error(
                            "Failed to delete calendar category:",
                            error
                        )
                        toast.error("카테고리를 삭제하지 못했습니다.")
                    }
                })
            },
            [canManageCategories, removeEventCategorySnapshot, withBusyCategory]
        )

        return (
            <div className="w-62 min-w-62">
                <DropdownMenuLabel className="flex h-8 items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                        옵션
                    </span>
                    {!isCreateInputOpen && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={
                                !canManageCategories || isCreatingCategory
                            }
                            className="-mr-0.75 size-6"
                            onClick={() => {
                                setIsCreateInputOpen((current) => !current)
                            }}
                        >
                            {isCreatingCategory ? (
                                <Spinner className="size-4" />
                            ) : (
                                <PlusIcon className="size-4" />
                            )}
                        </Button>
                    )}
                    {isCreatingCategory && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={
                                !canManageCategories || isCreatingCategory
                            }
                            className="-mr-0.75 size-6"
                            onClick={() => {
                                setIsCreateInputOpen((current) => !current)
                            }}
                        >
                            <Spinner className="size-4" />
                        </Button>
                    )}
                </DropdownMenuLabel>

                {isCreateInputOpen ? (
                    <div className="px-1.5 pb-1">
                        <Input
                            autoFocus
                            onBlur={() => {
                                setIsCreateInputOpen(false)
                                setNewCategoryName("")
                            }}
                            value={newCategoryName}
                            disabled={
                                !canManageCategories || isCreatingCategory
                            }
                            onChange={(event) => {
                                setNewCategoryName(event.target.value)
                            }}
                            onKeyDown={(event) => {
                                event.stopPropagation()

                                if (event.key === "Enter") {
                                    event.preventDefault()
                                    void createCategory()
                                    return
                                }

                                if (event.key === "Escape") {
                                    setIsCreateInputOpen(false)
                                    setNewCategoryName("")
                                }
                            }}
                            placeholder="새 카테고리 추가"
                            className="h-7 px-2 text-sm"
                        />
                    </div>
                ) : null}

                <div className="max-h-72 overflow-y-auto">
                    {eventCategories.length > 0 ? (
                        eventCategories.map((category) => {
                            const isBusy = busyCategoryIdSet.has(category.id)

                            return (
                                <DropdownMenuSub
                                    key={category.id}
                                    open={openCategoryId === category.id}
                                    onOpenChange={(open) => {
                                        setOpenCategoryId(
                                            open ? category.id : null
                                        )
                                    }}
                                >
                                    <DropdownMenuSubTrigger
                                        className={cn(
                                            "relative gap-2 overflow-hidden py-1.25 not-data-open:focus:bg-transparent",
                                            isBusy && "[&>svg]:hidden"
                                        )}
                                        onPointerMove={(event) => {
                                            event.preventDefault()
                                        }}
                                        onPointerLeave={(event) => {
                                            event.preventDefault()
                                        }}
                                        onClick={(event) => {
                                            event.preventDefault()
                                            setOpenCategoryId((current) =>
                                                current === category.id
                                                    ? null
                                                    : category.id
                                            )
                                        }}
                                        disabled={isBusy}
                                    >
                                        <span
                                            className={cn(
                                                "inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 text-sm leading-[normal]",
                                                getCalendarCategoryLabelClassName(
                                                    category.options.color
                                                )
                                            )}
                                        >
                                            <span className="truncate">
                                                {category.name}
                                            </span>
                                        </span>
                                        {isBusy ? (
                                            <div className="absolute top-1/2 right-1.75 size-4 -translate-y-1/2">
                                                <Spinner className="size-4" />
                                            </div>
                                        ) : null}
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent className="w-64 min-w-64">
                                            <DropdownMenuGroup className="flex flex-col gap-0.5 pb-0.5">
                                                <CategoryRenameInput
                                                    key={`${category.id}-${category.updatedAt}`}
                                                    category={category}
                                                    disabled={
                                                        !canManageCategories ||
                                                        isBusy
                                                    }
                                                    isSaving={isBusy}
                                                    onRename={renameCategory}
                                                />
                                                <DropdownMenuItem
                                                    className="px-2"
                                                    variant="destructive"
                                                    disabled={
                                                        !canManageCategories ||
                                                        isBusy
                                                    }
                                                    onSelect={(event) => {
                                                        event.preventDefault()
                                                        void removeCategory(
                                                            category
                                                        )
                                                    }}
                                                >
                                                    <Trash2Icon />
                                                    삭제
                                                </DropdownMenuItem>
                                            </DropdownMenuGroup>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuRadioGroup
                                                value={category.options.color}
                                                onValueChange={(value) => {
                                                    void changeCategoryColor(
                                                        category,
                                                        value as CalendarCategoryColor
                                                    )
                                                }}
                                            >
                                                <DropdownMenuLabel className="flex h-8 items-center">
                                                    색상
                                                </DropdownMenuLabel>
                                                {calendarCategoryColors.map(
                                                    (color) => (
                                                        <DropdownMenuRadioItem
                                                            key={color}
                                                            value={color}
                                                            disabled={
                                                                !canManageCategories ||
                                                                isBusy
                                                            }
                                                            onSelect={(
                                                                event
                                                            ) => {
                                                                event.preventDefault()
                                                            }}
                                                            className="flex cursor-pointer items-center gap-1.75 px-1.5 py-1.25"
                                                        >
                                                            <span
                                                                className={cn(
                                                                    "inline-flex size-4.5 items-center gap-1.5 rounded-sm",
                                                                    getCalendarCategoryPaletteClassName(
                                                                        color
                                                                    )
                                                                )}
                                                            ></span>
                                                            <span>
                                                                {
                                                                    calendarCategoryColorLabels[
                                                                        color
                                                                    ]
                                                                }
                                                            </span>
                                                        </DropdownMenuRadioItem>
                                                    )
                                                )}
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>
                            )
                        })
                    ) : (
                        <div className="px-2 py-3 text-sm text-muted-foreground">
                            등록된 카테고리가 없습니다.
                        </div>
                    )}
                </div>
            </div>
        )
    }
)
