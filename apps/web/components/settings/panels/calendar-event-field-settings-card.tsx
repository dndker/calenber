"use client"

import { calendarEventFieldDefinitions } from "@/lib/calendar/event-field-settings"
import type {
    CalendarEventFieldId,
    CalendarEventFieldSettings,
} from "@/store/calendar-store.types"
import {
    closestCenter,
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Switch } from "@workspace/ui/components/switch"
import { cn } from "@workspace/ui/lib/utils"
import { GripVerticalIcon } from "lucide-react"

const definitionMap = new Map(
    calendarEventFieldDefinitions.map((field) => [field.id, field])
)

function CalendarEventFieldSettingsCardRow({
    item,
    index,
    disabled,
    onVisibilityChange,
}: {
    item: CalendarEventFieldSettings["items"][number]
    index: number
    disabled?: boolean
    onVisibilityChange: (fieldId: CalendarEventFieldId, visible: boolean) => void
}) {
    const definition = definitionMap.get(item.id)
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: item.id,
        disabled,
    })

    if (!definition) {
        return null
    }

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
                "flex items-center justify-between gap-3 px-4 py-3",
                isDragging && "z-10 bg-muted"
            )}
        >
            <div className="flex min-w-0 items-start gap-2.5">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="mt-0.5 h-7 w-5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
                    disabled={disabled}
                    aria-label={`${definition.label} 속성 순서 변경`}
                    {...attributes}
                    {...listeners}
                >
                    <GripVerticalIcon className="size-4" />
                </Button>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-normal">
                            {index + 1}
                        </Badge>
                        <span className="truncate font-medium">
                            {definition.label}
                        </span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                        {definition.description}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                    {item.visible ? "표시" : "숨김"}
                </span>
                <Switch
                    checked={item.visible}
                    disabled={disabled}
                    onCheckedChange={(checked) => {
                        onVisibilityChange(item.id, checked)
                    }}
                />
            </div>
        </div>
    )
}

export function CalendarEventFieldSettingsCard({
    settings,
    disabled,
    onVisibilityChange,
    onReorder,
}: {
    settings: CalendarEventFieldSettings
    disabled?: boolean
    onVisibilityChange: (fieldId: CalendarEventFieldId, visible: boolean) => void
    onReorder: (activeId: CalendarEventFieldId, overId: CalendarEventFieldId) => void
}) {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    )

    return (
        <div className="rounded-xl border">
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="space-y-1">
                    <div className="text-sm font-medium">일정 속성 표시</div>
                    <div className="text-sm text-muted-foreground">
                        이 설정은 캘린더의 모든 일정 폼에 공통 적용됩니다.
                    </div>
                </div>
                <Badge variant="secondary">캘린더 공통</Badge>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={(dragEvent) => {
                    const activeId = String(dragEvent.active.id)
                    const overId = dragEvent.over?.id
                        ? String(dragEvent.over.id)
                        : null

                    if (!overId || activeId === overId) {
                        return
                    }

                    onReorder(
                        activeId as CalendarEventFieldId,
                        overId as CalendarEventFieldId
                    )
                }}
            >
                <SortableContext
                    disabled={disabled}
                    items={settings.items.map((item) => item.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="divide-y">
                        {settings.items.map((item, index) => (
                            <CalendarEventFieldSettingsCardRow
                                key={item.id}
                                item={item}
                                index={index}
                                disabled={disabled}
                                onVisibilityChange={onVisibilityChange}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    )
}
