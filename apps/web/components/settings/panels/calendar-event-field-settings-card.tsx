"use client"

import { calendarEventFieldDefinitions } from "@/lib/calendar/event-field-settings"
import type {
    CalendarEventFieldId,
    CalendarEventFieldSettings,
} from "@/store/calendar-store.types"
import { Badge } from "@workspace/ui/components/badge"
import { Switch } from "@workspace/ui/components/switch"

const definitionMap = new Map(
    calendarEventFieldDefinitions.map((field) => [field.id, field])
)

export function CalendarEventFieldSettingsCard({
    settings,
    disabled,
    onVisibilityChange,
}: {
    settings: CalendarEventFieldSettings
    disabled?: boolean
    onVisibilityChange: (fieldId: CalendarEventFieldId, visible: boolean) => void
}) {
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

            <div className="divide-y">
                {settings.items.map((item, index) => {
                    const definition = definitionMap.get(item.id)

                    if (!definition) {
                        return null
                    }

                    return (
                        <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 px-4 py-3"
                        >
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
                })}
            </div>
        </div>
    )
}
