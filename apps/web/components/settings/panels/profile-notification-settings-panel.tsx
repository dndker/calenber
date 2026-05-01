"use client"

import { useEffect } from "react"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { useNotificationStore } from "@/store/useNotificationStore"
import { useAuthStore } from "@/store/useAuthStore"
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
import { Switch } from "@workspace/ui/components/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select"
import type { NotificationType, NotificationEmailDigest } from "@/store/notification-store.types"

const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
    calendar_joined: "캘린더 가입",
    calendar_settings_changed: "캘린더 설정 변경",
    event_created: "일정 추가",
    event_updated: "일정 수정",
    event_deleted: "일정 삭제",
    event_tagged: "일정에서 언급됨",
    event_participant_added: "일정 참가자로 추가됨",
    event_comment_added: "댓글 (예정)",
    event_comment_replied: "댓글 답글 (예정)",
    event_reaction: "반응 (예정)",
}

export function ProfileNotificationSettingsPanel() {
    const t = useDebugTranslations("settings.profileNotification")
    const user = useAuthStore((s) => s.user)
    const preferences = useNotificationStore((s) => s.preferences)
    const loadPreferences = useNotificationStore((s) => s.loadPreferences)
    const savePreferences = useNotificationStore((s) => s.savePreferences)

    useEffect(() => {
        if (user && !preferences) {
            loadPreferences()
        }
    }, [user, preferences]) // eslint-disable-line react-hooks/exhaustive-deps

    if (!user || !preferences) {
        return (
            <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">
                {t("loading")}
            </div>
        )
    }

    const { pushEnabled, emailEnabled, typeSettings, emailDigest } = preferences

    function isTypeEnabled(type: NotificationType): boolean {
        return typeSettings[type] !== false // 기본값: true
    }

    async function handleTypeToggle(type: NotificationType, enabled: boolean) {
        await savePreferences({
            typeSettings: { ...typeSettings, [type]: enabled },
        })
    }

    return (
        <div className="flex flex-col gap-8">
            {/* 채널 설정 */}
            <FieldGroup>
                <FieldSet>
                    <FieldLegend className="mb-4 font-semibold">
                        {t("channelSection")}
                    </FieldLegend>
                    <FieldGroup>
                        <Field orientation="horizontal" className="items-center!">
                            <div className="flex-1">
                                <FieldLabel>{t("pushNotifications")}</FieldLabel>
                                <FieldDescription>{t("pushNotificationsDescription")}</FieldDescription>
                            </div>
                            <FieldContent>
                                <Switch
                                    checked={pushEnabled}
                                    onCheckedChange={(checked) =>
                                        savePreferences({ pushEnabled: checked })
                                    }
                                />
                            </FieldContent>
                        </Field>

                        <FieldSeparator />

                        <Field orientation="horizontal" className="items-center!">
                            <div className="flex-1">
                                <FieldLabel>{t("emailNotifications")}</FieldLabel>
                                <FieldDescription>{t("emailNotificationsDescription")}</FieldDescription>
                            </div>
                            <FieldContent>
                                <Switch
                                    checked={emailEnabled}
                                    onCheckedChange={(checked) =>
                                        savePreferences({ emailEnabled: checked })
                                    }
                                />
                            </FieldContent>
                        </Field>

                        {emailEnabled && (
                            <>
                                <FieldSeparator />
                                <Field orientation="horizontal" className="items-center!">
                                    <div className="flex-1">
                                        <FieldLabel>{t("emailFrequency")}</FieldLabel>
                                        <FieldDescription>{t("emailFrequencyDescription")}</FieldDescription>
                                    </div>
                                    <FieldContent>
                                        <Select
                                            value={emailDigest}
                                            onValueChange={(v) =>
                                                savePreferences({ emailDigest: v as NotificationEmailDigest })
                                            }
                                        >
                                            <SelectTrigger className="w-36">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="realtime">{t("frequencyRealtime")}</SelectItem>
                                                <SelectItem value="daily">{t("frequencyDaily")}</SelectItem>
                                                <SelectItem value="weekly">{t("frequencyWeekly")}</SelectItem>
                                                <SelectItem value="off">{t("frequencyOff")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FieldContent>
                                </Field>
                            </>
                        )}
                    </FieldGroup>
                </FieldSet>
            </FieldGroup>

            {/* 알림 종류별 설정 */}
            <FieldGroup>
                <FieldSet>
                    <FieldLegend className="mb-4 font-semibold">
                        {t("typeSection")}
                    </FieldLegend>
                    <FieldGroup>
                        {(Object.entries(NOTIFICATION_TYPE_LABELS) as [NotificationType, string][]).map(
                            ([type, label], idx, arr) => (
                                <div key={type}>
                                    <Field orientation="horizontal" className="items-center!">
                                        <FieldLabel className="flex-1">{label}</FieldLabel>
                                        <FieldContent>
                                            <Switch
                                                checked={isTypeEnabled(type)}
                                                onCheckedChange={(checked) => handleTypeToggle(type, checked)}
                                            />
                                        </FieldContent>
                                    </Field>
                                    {idx < arr.length - 1 && <FieldSeparator />}
                                </div>
                            )
                        )}
                    </FieldGroup>
                </FieldSet>
            </FieldGroup>
        </div>
    )
}
