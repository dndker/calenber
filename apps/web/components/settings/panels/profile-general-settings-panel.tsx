"use client"

import { CountrySelect } from "@/components/calendar/country-select"
import { TimezoneSelect } from "@/components/calendar/timezone-select"
import ThemeSelect from "@/components/theme-select"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSeparator,
    FieldSet,
} from "@workspace/ui/components/field"
import { useCallback, useState } from "react"

export function ProfileGeneralSettingsPanel() {
    const user = useAuthStore((s) => s.user)
    const calendarTimezone = useCalendarStore((s) => s.calendarTimezone)
    const setCalendarTimezone = useCalendarStore((s) => s.setCalendarTimezone)
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
        null
    )
    const handleContainerRef = useCallback((node: HTMLDivElement | null) => {
        setPortalContainer(
            (node?.closest(
                '[data-slot="dialog-content"]'
            ) as HTMLElement | null) ?? null
        )
    }, [])

    if (!user) return null

    return (
        <div ref={handleContainerRef}>
            <FieldGroup>
                <FieldSet>
                    <FieldLegend className="mb-4 font-semibold">
                        테마
                    </FieldLegend>
                    <FieldGroup>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel>테마</FieldLabel>
                                <FieldDescription>
                                    이 기기에서 사용할 테마를 선택하세요.
                                </FieldDescription>
                            </FieldContent>
                            <ThemeSelect />
                        </Field>
                    </FieldGroup>
                </FieldSet>
                <FieldSeparator />
                <FieldSet>
                    <FieldLegend className="mb-4 font-semibold">
                        언어 및 시간
                    </FieldLegend>
                    <FieldGroup>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel>언어</FieldLabel>
                                <FieldDescription>
                                    Calenber에서 사용할 언어를 선택합니다.
                                </FieldDescription>
                            </FieldContent>
                            <CountrySelect portalContainer={portalContainer} />
                        </Field>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel>시간대</FieldLabel>
                                <FieldDescription>시간대 선택</FieldDescription>
                            </FieldContent>
                            <TimezoneSelect
                                portalContainer={portalContainer}
                                value={calendarTimezone}
                                onChange={(value) => {
                                    if (!value) return
                                    setCalendarTimezone(value)

                                    document.cookie = `calendar-timezone=${encodeURIComponent(
                                        value
                                    )}; path=/; max-age=31536000`
                                }}
                            />
                        </Field>
                    </FieldGroup>
                </FieldSet>
            </FieldGroup>
        </div>
    )
}
