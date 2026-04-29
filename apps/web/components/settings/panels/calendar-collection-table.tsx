"use client"

import {
    calendarCollectionColorLabels,
    calendarCollectionColors,
    getCalendarCollectionPaletteClassName,
    type CalendarCollectionColor,
} from "@/lib/calendar/collection-color"
import type { CalendarEventCollection } from "@/store/calendar-store.types"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { Loader2Icon, MoreHorizontalIcon, PlusIcon } from "lucide-react"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { useCallback, useEffect, useRef, useState } from "react"

export type CalendarCollectionTableRow = CalendarEventCollection & {
    usageCount: number
}

function CollectionNameInput({
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
    const t = useDebugTranslations("settings.collectionTable")
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
        <div className="flex items-center gap-2">
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
                    if (event.key === "Enter") {
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
                placeholder={t("namePlaceholder")}
            />
            {isSaving ? (
                <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
            ) : null}
        </div>
    )
}

export function CalendarCollectionTable({
    rows,
    newCollectionName,
    canManageEvents,
    isCreatingCollection,
    isDisabled,
    busyCollectionIds,
    onNewCollectionNameChange,
    onCreateCollection,
    onRenameCollection,
    onChangeCollectionColor,
    onChangeCollectionDefaultVisibility,
    onRemoveCollection,
}: {
    rows: CalendarCollectionTableRow[]
    newCollectionName: string
    canManageEvents: boolean
    isCreatingCollection: boolean
    isDisabled: boolean
    busyCollectionIds: string[]
    onNewCollectionNameChange: (value: string) => void
    onCreateCollection: () => void
    onRenameCollection: (
        collectionId: string,
        nextName: string
    ) => Promise<boolean>
    onChangeCollectionColor: (
        collection: CalendarEventCollection,
        color: CalendarCollectionColor
    ) => void
    onChangeCollectionDefaultVisibility: (
        collection: CalendarEventCollection,
        visibleByDefault: boolean
    ) => void
    onRemoveCollection: (collection: CalendarEventCollection) => void
}) {
    const t = useDebugTranslations("settings.collectionTable")
    const tData = useDebugTranslations("settings.calendarData")
    return (
        <div className="rounded-xl border">
            <div className="flex flex-col gap-3 border-b px-3 py-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                    <Input
                        value={newCollectionName}
                        disabled={
                            !canManageEvents || isCreatingCollection || isDisabled
                        }
                        onChange={(event) => {
                            onNewCollectionNameChange(event.target.value)
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault()
                                onCreateCollection()
                            }
                        }}
                        placeholder={t("newCollectionPlaceholder")}
                        className="h-9"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                        {t("totalCount", { count: rows.length })}
                    </Badge>
                    <Button
                        type="button"
                        size="sm"
                        disabled={
                            !canManageEvents ||
                            isCreatingCollection ||
                            !newCollectionName.trim()
                        }
                        onClick={onCreateCollection}
                    >
                        {isCreatingCollection ? (
                            <Loader2Icon className="animate-spin" />
                        ) : (
                            <PlusIcon />
                        )}
                        {t("add")}
                    </Button>
                </div>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-full pl-3.5">
                            {t("name")}
                        </TableHead>
                        <TableHead className="w-44">{t("color")}</TableHead>
                        <TableHead className="w-34">
                            {t("defaultChecked")}
                        </TableHead>
                        <TableHead className="w-28">
                            {t("linkedEvents")}
                        </TableHead>
                        <TableHead className="w-12 text-right" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.length ? (
                        rows.map((row) => {
                            const isBusy = busyCollectionIds.includes(row.id)

                            return (
                                <TableRow key={row.id}>
                                    <TableCell className="pl-3.5">
                                        <div className="space-y-1">
                                            <CollectionNameInput
                                                key={`${row.id}-${row.updatedAt}`}
                                                collection={row}
                                                disabled={
                                                    !canManageEvents || isBusy
                                                }
                                                isSaving={isBusy}
                                                onRename={onRenameCollection}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={row.options.color}
                                            onValueChange={(value) => {
                                                onChangeCollectionColor(
                                                    row,
                                                    value as CalendarCollectionColor
                                                )
                                            }}
                                            disabled={
                                                !canManageEvents || isBusy
                                            }
                                        >
                                            <SelectTrigger className="-ml-2 w-35 border-0 px-2 shadow-none hover:bg-muted">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {calendarCollectionColors.map(
                                                    (color) => (
                                                        <SelectItem
                                                            key={color}
                                                            value={color}
                                                        >
                                                            <span className="flex cursor-pointer items-center gap-1.75 px-0.5 py-0.5">
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
                                                            </span>
                                                        </SelectItem>
                                                    )
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={
                                                row.options
                                                    .visibleByDefault
                                                    ? "visible"
                                                    : "hidden"
                                            }
                                            onValueChange={(value) => {
                                                onChangeCollectionDefaultVisibility(
                                                    row,
                                                    value === "visible"
                                                )
                                            }}
                                            disabled={
                                                !canManageEvents || isBusy
                                            }
                                        >
                                            <SelectTrigger className="-ml-2 w-25 border-0 px-2 shadow-none hover:bg-muted">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectItem value="visible">
                                                        {tData("collectionVisibleDefault")}
                                                    </SelectItem>
                                                    <SelectItem value="hidden">
                                                        {tData("collectionHiddenDefault")}
                                                    </SelectItem>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className="font-normal"
                                        >
                                            {tData("collectionLinkedEventsCount", { count: row.usageCount })}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    disabled={
                                                        !canManageEvents ||
                                                        isBusy
                                                    }
                                                >
                                                    {isBusy ? (
                                                        <Loader2Icon className="animate-spin" />
                                                    ) : (
                                                        <MoreHorizontalIcon />
                                                    )}
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    onSelect={() => {
                                                        onRemoveCollection(
                                                            row
                                                        )
                                                    }}
                                                >
                                                    {tData("collectionDeleteAction")}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )
                        })
                    ) : (
                        <TableRow>
                            <TableCell
                                colSpan={5}
                                className="h-24 text-center text-muted-foreground"
                            >
                                {tData("collectionEmpty")}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
