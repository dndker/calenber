"use client"

import {
    getCalendarEventFieldDefinitions,
    type CalendarEventFieldDefinition,
} from "@/lib/calendar/event-field-settings"
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
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"

function CalendarEventFieldSettingsCardRow({
    item,
    index,
    disabled,
    onVisibilityChange,
    definitionMap,
}: {
    item: CalendarEventFieldSettings["items"][number]
    index: number
    disabled?: boolean
    onVisibilityChange: (fieldId: CalendarEventFieldId, visible: boolean) => void
    definitionMap: Map<CalendarEventFieldId, CalendarEventFieldDefinition>
}) {
    const t = useDebugTranslations("settings.calendarData")
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
                    aria-label={t("fieldOrderAria", {
                        label: definition.label,
                    })}
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
                    {item.visible ? t("visible") : t("hidden")}
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
    const t = useDebugTranslations("settings.calendarData")
    const tField = useDebugTranslations("event.fieldDefinition")
    const fieldDefinitions = getCalendarEventFieldDefinitions(tField)
    const definitionMap = new Map(
        fieldDefinitions.map((field) => [field.id, field] as const)
    )
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
                    <div className="text-sm font-medium">
                        {t("fieldSettingsTitle")}
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {t("fieldSettingsDescription")}
                    </div>
                </div>
                <Badge variant="secondary">{t("sharedBadge")}</Badge>
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
                                definitionMap={definitionMap}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    )
}
