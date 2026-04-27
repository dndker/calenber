"use client"

import {
    calendarCategoryColorLabels,
    calendarCategoryColors,
    getCalendarCategoryPaletteClassName,
    type CalendarCategoryColor,
} from "@/lib/calendar/category-color"
import type { CalendarEventCategory } from "@/store/calendar-store.types"
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
import { useCallback, useEffect, useRef, useState } from "react"

export type CalendarCategoryTableRow = CalendarEventCategory & {
    usageCount: number
}

function CategoryNameInput({
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

                        setDraft(category.name)
                        event.currentTarget.blur()
                    }
                }}
                placeholder="컬렉션 이름"
            />
            {isSaving ? (
                <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
            ) : null}
        </div>
    )
}

export function CalendarCategoryTable({
    rows,
    newCategoryName,
    canManageEvents,
    isCreatingCategory,
    isDisabled,
    busyCategoryIds,
    onNewCategoryNameChange,
    onCreateCategory,
    onRenameCategory,
    onChangeCategoryColor,
    onChangeCategoryDefaultVisibility,
    onRemoveCategory,
}: {
    rows: CalendarCategoryTableRow[]
    newCategoryName: string
    canManageEvents: boolean
    isCreatingCategory: boolean
    isDisabled: boolean
    busyCategoryIds: string[]
    onNewCategoryNameChange: (value: string) => void
    onCreateCategory: () => void
    onRenameCategory: (categoryId: string, nextName: string) => Promise<boolean>
    onChangeCategoryColor: (
        category: CalendarEventCategory,
        color: CalendarCategoryColor
    ) => void
    onChangeCategoryDefaultVisibility: (
        category: CalendarEventCategory,
        visibleByDefault: boolean
    ) => void
    onRemoveCategory: (category: CalendarEventCategory) => void
}) {
    return (
        <div className="rounded-xl border">
            <div className="flex flex-col gap-3 border-b px-3 py-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                    <Input
                        value={newCategoryName}
                        disabled={
                            !canManageEvents || isCreatingCategory || isDisabled
                        }
                        onChange={(event) => {
                            onNewCategoryNameChange(event.target.value)
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault()
                                onCreateCategory()
                            }
                        }}
                        placeholder="새 컬렉션 추가"
                        className="h-9"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary">전체 {rows.length}개</Badge>
                    <Button
                        type="button"
                        size="sm"
                        disabled={
                            !canManageEvents ||
                            isCreatingCategory ||
                            !newCategoryName.trim()
                        }
                        onClick={onCreateCategory}
                    >
                        {isCreatingCategory ? (
                            <Loader2Icon className="animate-spin" />
                        ) : (
                            <PlusIcon />
                        )}
                        추가
                    </Button>
                </div>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-full pl-3.5">이름</TableHead>
                        <TableHead className="w-44">색상</TableHead>
                        <TableHead className="w-34">초기 체크</TableHead>
                        <TableHead className="w-28">연결 일정</TableHead>
                        <TableHead className="w-12 text-right" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.length ? (
                        rows.map((category) => {
                            const isBusy = busyCategoryIds.includes(category.id)

                            return (
                                <TableRow key={category.id}>
                                    <TableCell className="pl-3.5">
                                        <div className="space-y-1">
                                            <CategoryNameInput
                                                key={`${category.id}-${category.updatedAt}`}
                                                category={category}
                                                disabled={
                                                    !canManageEvents || isBusy
                                                }
                                                isSaving={isBusy}
                                                onRename={onRenameCategory}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={category.options.color}
                                            onValueChange={(value) => {
                                                onChangeCategoryColor(
                                                    category,
                                                    value as CalendarCategoryColor
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
                                                {calendarCategoryColors.map(
                                                    (color) => (
                                                        <SelectItem
                                                            key={color}
                                                            value={color}
                                                        >
                                                            <span className="flex cursor-pointer items-center gap-1.75 px-0.5 py-0.5">
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
                                                category.options
                                                    .visibleByDefault
                                                    ? "visible"
                                                    : "hidden"
                                            }
                                            onValueChange={(value) => {
                                                onChangeCategoryDefaultVisibility(
                                                    category,
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
                                                        기본 표시
                                                    </SelectItem>
                                                    <SelectItem value="hidden">
                                                        기본 숨김
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
                                            {category.usageCount}개 일정
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
                                                        onRemoveCategory(
                                                            category
                                                        )
                                                    }}
                                                >
                                                    컬렉션 삭제
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
                                등록된 컬렉션이 없습니다.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
