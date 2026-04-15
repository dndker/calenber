"use client"

import { useCalendarEventLayout } from "@/hooks/use-calendar-event-layout"
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@workspace/ui/components/field"
import {
    ToggleGroup,
    ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

export function CalendarGeneralSettingsPanel() {
    const { activeCalendar, eventLayout, saveEventLayout } =
        useCalendarEventLayout()

    if (!activeCalendar) {
        return (
            <div className="text-sm text-muted-foreground">
                캘린더를 선택하면 일반 설정을 변경할 수 있습니다.
            </div>
        )
    }

    return (
        <FieldGroup>
            <Field orientation="horizontal" className="items-center!">
                <FieldContent>
                    <FieldLabel>일정 뷰</FieldLabel>
                    <FieldDescription>
                        {activeCalendar.name} 캘린더의 기본 일정 표시 방식을
                        설정합니다.
                    </FieldDescription>
                </FieldContent>
                <ToggleGroup
                    type="single"
                    variant="outline"
                    value={eventLayout}
                    onValueChange={(value) => {
                        if (value === "compact" || value === "split") {
                            void saveEventLayout(value)
                        }
                    }}
                >
                    <ToggleGroupItem value="compact">Compact</ToggleGroupItem>
                    <ToggleGroupItem value="split">Split</ToggleGroupItem>
                </ToggleGroup>
            </Field>
        </FieldGroup>
    )
}
