"use client"

import { LanguageSelect } from "@/components/language-select"
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
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { useCallback, useState } from "react"

export function ProfileGeneralSettingsPanel() {
    const t = useDebugTranslations("settings.profileGeneral")
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
                        {t("themeSection")}
                    </FieldLegend>
                    <FieldGroup>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel>{t("themeLabel")}</FieldLabel>
                                <FieldDescription>
                                    {t("themeDescription")}
                                </FieldDescription>
                            </FieldContent>
                            <ThemeSelect />
                        </Field>
                    </FieldGroup>
                </FieldSet>
                <FieldSeparator />
                <FieldSet>
                    <FieldLegend className="mb-4 font-semibold">
                        {t("languageTimeSection")}
                    </FieldLegend>
                    <FieldGroup>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel>{t("languageLabel")}</FieldLabel>
                                <FieldDescription>
                                    {t("languageDescription")}
                                </FieldDescription>
                            </FieldContent>
                            <LanguageSelect />
                        </Field>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel>{t("timezoneLabel")}</FieldLabel>
                                <FieldDescription>
                                    {t("timezoneDescription")}
                                </FieldDescription>
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
