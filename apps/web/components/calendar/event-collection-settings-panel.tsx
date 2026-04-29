"use client"

import {
    calendarCollectionColorLabels,
    calendarCollectionColors,
    getCalendarCollectionLabelClassName,
    getCalendarCollectionPaletteClassName,
    type CalendarCollectionColor,
} from "@/lib/calendar/collection-color"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { normalizeCollectionName } from "@/lib/calendar/event-form-names"
import {
    createCalendarEventCollection,
    deleteCalendarEventCollection,
    getCollectionPublishStatus,
    updateCalendarEventCollection,
} from "@/lib/calendar/mutations"
import { createBrowserSupabase } from "@/lib/supabase/client"
import type { CalendarEventCollection } from "@/store/calendar-store.types"
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
import { Globe2Icon, PlusIcon, Settings2Icon, Trash2Icon } from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { CollectionShareDialog } from "./collection-share-dialog"

function CollectionRenameInput({
    collection,
    disabled,
    isSaving,
    onRename,
}: {
    collection: CalendarEventCollection
    disabled: boolean
    isSaving: boolean
    onRename: (collectionId: string, nextName: string) => Promise<boolean>
}) {
    const tCollectionTable = useDebugTranslations("settings.collectionTable")
    const [draft, setDraft] = useState(collection.name)
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    const flushRename = useCallback(
        async (value: string) => {
            const trimmedValue = value.trim()
            const trimmedName = collection.name.trim()

            if (!trimmedValue) {
                setDraft(collection.name)
                return
            }

            if (trimmedValue === trimmedName) {
                if (value !== collection.name) {
                    setDraft(collection.name)
                }
                return
            }

            const ok = await onRename(collection.id, trimmedValue)

            if (!ok) {
                setDraft(collection.name)
            }
        },
        [collection.id, collection.name, onRename]
    )
    useEffect(() => {
        if (disabled || isSaving) {
            return
        }

        const trimmedDraft = draft.trim()
        const trimmedName = collection.name.trim()

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
    }, [collection.name, disabled, draft, flushRename, isSaving])

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

                        setDraft(collection.name)
                        event.currentTarget.blur()
                    }
                }}
                placeholder={tCollectionTable("namePlaceholder")}
                className="h-8"
            />
            {isSaving ? <Spinner className="size-4 shrink-0" /> : null}
        </div>
    )
}

export const EventCollectionSettingsPanel = memo(
    function EventCollectionSettingsPanel({
        disabled = false,
    }: {
        disabled?: boolean
    }) {
        const t = useDebugTranslations("calendar.collectionSettings")
        const tCollectionTable = useDebugTranslations("settings.collectionTable")
        const tCommon = useDebugTranslations("common.actions")
        const tFilterMenu = useDebugTranslations("calendar.filterMenu")
        const activeCalendar = useCalendarStore((state) => state.activeCalendar)
        const eventCollections = useCalendarStore((state) => state.eventCollections)
        const upsertEventCollectionSnapshot = useCalendarStore(
            (state) => state.upsertEventCollectionSnapshot
        )
        const removeEventCollectionSnapshot = useCalendarStore(
            (state) => state.removeEventCollectionSnapshot
        )
        const [isCreateInputOpen, setIsCreateInputOpen] = useState(false)
        const [newCollectionName, setNewCollectionName] = useState("")
        const [isCreatingCollection, setIsCreatingCollection] = useState(false)
        const [busyCollectionIds, setBusyCollectionIds] = useState<string[]>([])
        const [openCollectionId, setOpenCollectionId] = useState<string | null>(
            null
        )
        // 공유 모달 상태
        const [shareDialogCollectionId, setShareDialogCollectionId] = useState<string | null>(null)
        // collectionId → publish status
        const [publishStatusMap, setPublishStatusMap] = useState<
            Map<string, { isPublished: boolean; visibility: "public" | "unlisted" | null; subscriberCount: number; catalogId: string | null; description: string }>
        >(new Map())

        const canManageCollections = Boolean(
            !disabled && activeCalendar?.id && activeCalendar.id !== "demo"
        )
        const busyCollectionIdSet = useMemo(
            () => new Set(busyCollectionIds),
            [busyCollectionIds]
        )

        // manager/owner인 경우 카테고리별 공유 발행 상태 로드
        useEffect(() => {
            if (!canManageCollections || !activeCalendar?.id || eventCollections.length === 0) {
                return
            }

            const supabase = createBrowserSupabase()
            getCollectionPublishStatus(supabase, activeCalendar.id).then((statusList) => {
                setPublishStatusMap(
                    new Map(
                        statusList.map((s) => [
                            s.collectionId,
                            {
                                isPublished: s.isPublished,
                                visibility:
                                    s.visibility === "public" || s.visibility === "unlisted"
                                        ? s.visibility
                                        : null,
                                subscriberCount: s.subscriberCount,
                                catalogId: s.catalogId,
                                description: s.description,
                            },
                        ])
                    )
                )
            })
        }, [canManageCollections, activeCalendar?.id, eventCollections.length])

        const withBusyCollection = useCallback(
            async (collectionId: string, work: () => Promise<void>) => {
                setBusyCollectionIds((current) =>
                    current.includes(collectionId)
                        ? current
                        : [...current, collectionId]
                )

                try {
                    await work()
                } finally {
                    setBusyCollectionIds((current) =>
                        current.filter((item) => item !== collectionId)
                    )
                }
            },
            []
        )

        const createCollection = useCallback(async () => {
            if (!canManageCollections || !activeCalendar?.id) {
                return
            }

            const trimmedName = newCollectionName.trim()

            if (!trimmedName) {
                return
            }

            const existingCollection = eventCollections.find(
                (collection) =>
                    normalizeCollectionName(collection.name) ===
                    normalizeCollectionName(trimmedName)
            )

            if (existingCollection) {
                toast.message(t("duplicateName"))
                setOpenCollectionId(existingCollection.id)
                setIsCreateInputOpen(false)
                setNewCollectionName("")
                return
            }

            setIsCreatingCollection(true)

            try {
                const supabase = createBrowserSupabase()
                const createdCollection = await createCalendarEventCollection(
                    supabase,
                    activeCalendar.id,
                    {
                        name: trimmedName,
                        options: {
                            visibleByDefault: true,
                        },
                    }
                )

                if (!createdCollection) {
                    throw new Error("Collection create failed.")
                }

                upsertEventCollectionSnapshot(createdCollection)
                setOpenCollectionId(createdCollection.id)
                setNewCollectionName("")
                setIsCreateInputOpen(false)
            } catch (error) {
                console.error("Failed to create calendar collection:", error)
                toast.error(t("createFailed"))
            } finally {
                setIsCreatingCollection(false)
            }
        }, [
            activeCalendar?.id,
            canManageCollections,
            eventCollections,
            newCollectionName,
            upsertEventCollectionSnapshot,
        ])

        const renameCollection = useCallback(
            async (collectionId: string, nextName: string) => {
                if (!canManageCollections) {
                    return false
                }

                const trimmedName = nextName.trim()

                if (!trimmedName) {
                    return false
                }

                const existingCollection = eventCollections.find(
                    (collection) =>
                        collection.id !== collectionId &&
                        normalizeCollectionName(collection.name) ===
                            normalizeCollectionName(trimmedName)
                )

                if (existingCollection) {
                    toast.message(t("duplicateName"))
                    return false
                }

                let isSuccess = false

                await withBusyCollection(collectionId, async () => {
                    try {
                        const supabase = createBrowserSupabase()
                        const updatedCollection =
                            await updateCalendarEventCollection(
                                supabase,
                                collectionId,
                                {
                                    name: trimmedName,
                                }
                            )

                        if (!updatedCollection) {
                            throw new Error("Collection rename failed.")
                        }

                        upsertEventCollectionSnapshot(updatedCollection)
                        isSuccess = true
                    } catch (error) {
                        console.error(
                            "Failed to rename calendar collection:",
                            error
                        )
                        toast.error(t("renameFailed"))
                    }
                })

                return isSuccess
            },
            [
                canManageCollections,
                eventCollections,
                upsertEventCollectionSnapshot,
                withBusyCollection,
            ]
        )

        const changeCollectionColor = useCallback(
            async (
                collection: CalendarEventCollection,
                color: CalendarCollectionColor
            ) => {
                if (
                    !canManageCollections ||
                    collection.options.color === color
                ) {
                    return
                }

                await withBusyCollection(collection.id, async () => {
                    try {
                        const supabase = createBrowserSupabase()
                        const updatedCollection =
                            await updateCalendarEventCollection(
                                supabase,
                                collection.id,
                                {
                                    options: {
                                        ...collection.options,
                                        color,
                                    },
                                }
                            )

                        if (!updatedCollection) {
                            throw new Error("Collection color update failed.")
                        }

                        upsertEventCollectionSnapshot(updatedCollection)
                    } catch (error) {
                        console.error(
                            "Failed to update calendar collection color:",
                            error
                        )
                        toast.error(t("colorUpdateFailed"))
                    }
                })
            },
            [canManageCollections, upsertEventCollectionSnapshot, withBusyCollection]
        )

        const removeCollection = useCallback(
            async (collection: CalendarEventCollection) => {
                if (!canManageCollections) {
                    return
                }

                await withBusyCollection(collection.id, async () => {
                    try {
                        const supabase = createBrowserSupabase()
                        const ok = await deleteCalendarEventCollection(
                            supabase,
                            collection.id
                        )

                        if (!ok) {
                            throw new Error("Collection delete failed.")
                        }

                        removeEventCollectionSnapshot(collection.id)
                        setOpenCollectionId((current) =>
                            current === collection.id ? null : current
                        )
                    } catch (error) {
                        console.error(
                            "Failed to delete calendar collection:",
                            error
                        )
                        toast.error(t("deleteFailed"))
                    }
                })
            },
            [canManageCollections, removeEventCollectionSnapshot, withBusyCollection]
        )

        return (
            <div className="w-62 min-w-62">
                <DropdownMenuLabel className="flex h-8 items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                        {t("options")}
                    </span>
                    {!isCreateInputOpen && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={
                                !canManageCollections || isCreatingCollection
                            }
                            className="-mr-0.75 size-6"
                            onClick={() => {
                                setIsCreateInputOpen((current) => !current)
                            }}
                        >
                            {isCreatingCollection ? (
                                <Spinner className="size-4" />
                            ) : (
                                <PlusIcon className="size-4" />
                            )}
                        </Button>
                    )}
                    {isCreatingCollection && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={
                                !canManageCollections || isCreatingCollection
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
                                setNewCollectionName("")
                            }}
                            value={newCollectionName}
                            disabled={
                                !canManageCollections || isCreatingCollection
                            }
                            onChange={(event) => {
                                setNewCollectionName(event.target.value)
                            }}
                            onKeyDown={(event) => {
                                event.stopPropagation()

                                if (event.key === "Enter") {
                                    event.preventDefault()
                                    void createCollection()
                                    return
                                }

                                if (event.key === "Escape") {
                                    setIsCreateInputOpen(false)
                                    setNewCollectionName("")
                                }
                            }}
                            placeholder={tCollectionTable("newCollectionPlaceholder")}
                            className="h-7 px-2 text-sm"
                        />
                    </div>
                ) : null}

                <div className="max-h-72 overflow-y-auto">
                    {eventCollections.length > 0 ? (
                        eventCollections.map((collection) => {
                            const isBusy = busyCollectionIdSet.has(
                                collection.id
                            )

                            return (
                                <DropdownMenuSub
                                    key={collection.id}
                                    open={openCollectionId === collection.id}
                                    onOpenChange={(open) => {
                                        setOpenCollectionId(
                                            open ? collection.id : null
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
                                            setOpenCollectionId((current) =>
                                                current === collection.id
                                                    ? null
                                                    : collection.id
                                            )
                                        }}
                                        disabled={isBusy}
                                    >
                                        <span
                                            className={cn(
                                                "inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 text-sm leading-[normal]",
                                                getCalendarCollectionLabelClassName(
                                                    collection.options.color
                                                )
                                            )}
                                        >
                                            <span className="truncate">
                                                {collection.name}
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
                                                <CollectionRenameInput
                                                    key={`${collection.id}-${collection.updatedAt}`}
                                                    collection={collection}
                                                    disabled={
                                                        !canManageCollections ||
                                                        isBusy
                                                    }
                                                    isSaving={isBusy}
                                                    onRename={renameCollection}
                                                />
                                                {/* 공유 설정 진입점 */}
                                                <DropdownMenuItem
                                                    className="gap-2 px-2"
                                                    disabled={
                                                        !canManageCollections ||
                                                        isBusy
                                                    }
                                                    onSelect={(event) => {
                                                        event.preventDefault()
                                                        setOpenCollectionId(null)
                                                        setShareDialogCollectionId(
                                                            collection.id
                                                        )
                                                    }}
                                                >
                                                    {publishStatusMap.get(
                                                        collection.id
                                                    )?.isPublished ? (
                                                        <>
                                                            <Settings2Icon className="size-4" />
                                                            {tFilterMenu("shareSettings")}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Globe2Icon className="size-4" />
                                                            {tFilterMenu("share")}
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="px-2"
                                                    variant="destructive"
                                                    disabled={
                                                        !canManageCollections ||
                                                        isBusy
                                                    }
                                                    onSelect={(event) => {
                                                        event.preventDefault()
                                                        void removeCollection(
                                                            collection
                                                        )
                                                    }}
                                                >
                                                    <Trash2Icon />
                                                    {tCommon("delete")}
                                                </DropdownMenuItem>
                                            </DropdownMenuGroup>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuRadioGroup
                                                value={collection.options.color}
                                                onValueChange={(value) => {
                                                    void changeCollectionColor(
                                                        collection,
                                                        value as CalendarCollectionColor
                                                    )
                                                }}
                                            >
                                                <DropdownMenuLabel className="flex h-8 items-center">
                                                    {tCollectionTable("color")}
                                                </DropdownMenuLabel>
                                                {calendarCollectionColors.map(
                                                    (color) => (
                                                        <DropdownMenuRadioItem
                                                            key={color}
                                                            value={color}
                                                            disabled={
                                                                !canManageCollections ||
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
                                                                    getCalendarCollectionPaletteClassName(
                                                                        color
                                                                    )
                                                                )}
                                                            ></span>
                                                            <span>
                                                                {
                                                                    calendarCollectionColorLabels[
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
                            {t("empty")}
                        </div>
                    )}
                </div>

                {/* 공유 설정 모달 — DropdownMenu가 닫힌 뒤 마운트됨 */}
                {shareDialogCollectionId && (() => {
                    const target = eventCollections.find((c) => c.id === shareDialogCollectionId)
                    if (!target) return null
                    const status = publishStatusMap.get(shareDialogCollectionId)
                    return (
                        <CollectionShareDialog
                            key={shareDialogCollectionId}
                            open
                            onOpenChange={(open) => {
                                if (!open) setShareDialogCollectionId(null)
                            }}
                            collection={{
                                id: shareDialogCollectionId,
                                name: target.name,
                                description: status?.description,
                            }}
                            isPublished={status?.isPublished ?? false}
                            currentVisibility={status?.visibility}
                            subscriberCount={status?.subscriberCount}
                            onPublished={(info) => {
                                setPublishStatusMap((prev) => {
                                    const next = new Map(prev)
                                    next.set(shareDialogCollectionId, {
                                        isPublished: true,
                                        visibility: info.visibility,
                                        subscriberCount: prev.get(shareDialogCollectionId)?.subscriberCount ?? 0,
                                        catalogId: info.catalogId,
                                        description: prev.get(shareDialogCollectionId)?.description ?? "",
                                    })
                                    return next
                                })
                            }}
                            onUnpublished={() => {
                                setPublishStatusMap((prev) => {
                                    const next = new Map(prev)
                                    next.set(shareDialogCollectionId, {
                                        isPublished: false,
                                        visibility: null,
                                        subscriberCount: 0,
                                        catalogId: null,
                                        description: "",
                                    })
                                    return next
                                })
                            }}
                            onCollectionRenamed={() => {
                                // store snapshot이 source of truth — 별도 처리 불필요
                            }}
                        />
                    )
                })()}
            </div>
        )
    }
)
