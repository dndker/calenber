"use client"

import { createCalendarEventCategory } from "@/lib/calendar/mutations"
import {
    normalizeCategoryName,
    normalizeNames,
} from "@/lib/calendar/event-form-names"
import { buildEventCategoriesAssignmentPatch } from "@/lib/calendar/event-property-category-patch"
import { createBrowserSupabase } from "@/lib/supabase/client"
import type { CalendarEventStatus } from "@/store/calendar-store.types"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useCallback } from "react"
import { useEventFormDraftCategoryColor } from "./use-event-form-draft-category-color"

type UseEventQuickPropertySaveOptions = {
    /** `getCalendarEventSourceId`와 동일: 원본 일정 id */
    sourceEventId: string
    disabled?: boolean
}

/**
 * 컨텍스트 메뉴 등 EventForm 밖에서 상태·카테고리만 갱신할 때 사용.
 * 스토어 `updateEvent` → `persistUpdatedEvent` 경로로 실시간/낙관적 갱신과 동일하게 동작한다.
 */
export function useEventQuickPropertySave({
    sourceEventId,
    disabled = false,
}: UseEventQuickPropertySaveOptions) {
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const eventCategories = useCalendarStore((s) => s.eventCategories)
    const upsertEventCategorySnapshot = useCalendarStore(
        (s) => s.upsertEventCategorySnapshot
    )
    const updateEvent = useCalendarStore((s) => s.updateEvent)
    const getDraftCategoryColor = useEventFormDraftCategoryColor(eventCategories)

    const ensureEventCategories = useCallback(
        async (categoryNames: string[]) => {
            if (
                !activeCalendar?.id ||
                activeCalendar.id === "demo" ||
                disabled ||
                categoryNames.length === 0
            ) {
                return useCalendarStore.getState().eventCategories
            }

            const supabase = createBrowserSupabase()
            const categoryMap = new Map(
                useCalendarStore
                    .getState()
                    .eventCategories.map((category) => [
                        normalizeCategoryName(category.name),
                        category,
                    ])
            )

            for (const categoryName of categoryNames) {
                const categoryKey = normalizeCategoryName(categoryName)

                if (!categoryKey || categoryMap.has(categoryKey)) {
                    continue
                }

                const createdCategory = await createCalendarEventCategory(
                    supabase,
                    activeCalendar.id,
                    {
                        name: categoryName,
                        options: {
                            visibleByDefault: true,
                            color: getDraftCategoryColor(categoryName),
                        },
                    }
                )

                if (!createdCategory) {
                    continue
                }

                categoryMap.set(categoryKey, createdCategory)
                upsertEventCategorySnapshot(createdCategory)
            }

            return useCalendarStore.getState().eventCategories
        },
        [
            activeCalendar?.id,
            disabled,
            getDraftCategoryColor,
            upsertEventCategorySnapshot,
        ]
    )

    const saveStatus = useCallback(
        (nextStatus: CalendarEventStatus) => {
            if (disabled) {
                return
            }

            const event = useCalendarStore
                .getState()
                .events.find((item) => item.id === sourceEventId)

            if (!event || event.status === nextStatus) {
                return
            }

            updateEvent(
                sourceEventId,
                { status: nextStatus },
                { expectedUpdatedAt: event.updatedAt }
            )
        },
        [disabled, sourceEventId, updateEvent]
    )

    const saveCategoryNames = useCallback(
        async (rawNames: string[]) => {
            if (disabled) {
                return
            }

            const event = useCalendarStore
                .getState()
                .events.find((item) => item.id === sourceEventId)

            if (!event) {
                return
            }

            const nextCategoryNames = normalizeNames(rawNames)
            const sourceCategoryNames = normalizeNames(
                event.categories.map((category) => category.name)
            )

            const resolvedCategories =
                JSON.stringify(sourceCategoryNames) ===
                JSON.stringify(nextCategoryNames)
                    ? useCalendarStore.getState().eventCategories
                    : await ensureEventCategories(nextCategoryNames)

            const patch = buildEventCategoriesAssignmentPatch(
                event,
                nextCategoryNames,
                resolvedCategories,
                getDraftCategoryColor,
                activeCalendar?.id ?? event.categories[0]?.calendarId ?? ""
            )

            if (!patch) {
                return
            }

            updateEvent(sourceEventId, patch, {
                expectedUpdatedAt: event.updatedAt,
            })
        },
        [
            activeCalendar?.id,
            disabled,
            ensureEventCategories,
            getDraftCategoryColor,
            sourceEventId,
            updateEvent,
        ]
    )

    return {
        saveStatus,
        saveCategoryNames,
        getDraftCategoryColor,
        eventCategories,
    }
}
