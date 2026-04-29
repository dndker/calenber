"use client"

import { createCalendarEventCollection } from "@/lib/calendar/mutations"
import {
    normalizeCollectionName,
    normalizeNames,
} from "@/lib/calendar/event-form-names"
import { buildEventCollectionsAssignmentPatch } from "@/lib/calendar/event-property-collection-patch"
import { createBrowserSupabase } from "@/lib/supabase/client"
import type { CalendarEventStatus } from "@/store/calendar-store.types"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useCallback } from "react"
import { useEventFormDraftCollectionColor } from "./use-event-form-draft-collection-color"

type UseEventQuickPropertySaveOptions = {
    /** `getCalendarEventSourceId`와 동일: 원본 일정 id */
    sourceEventId: string
    disabled?: boolean
}

/**
 * 컨텍스트 메뉴 등 EventForm 밖에서 상태·컬렉션만 갱신할 때 사용.
 * 스토어 `updateEvent` → `persistUpdatedEvent` 경로로 실시간/낙관적 갱신과 동일하게 동작한다.
 */
export function useEventQuickPropertySave({
    sourceEventId,
    disabled = false,
}: UseEventQuickPropertySaveOptions) {
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const eventCollections = useCalendarStore((s) => s.eventCollections)
    const upsertEventCollectionSnapshot = useCalendarStore(
        (s) => s.upsertEventCollectionSnapshot
    )
    const updateEvent = useCalendarStore((s) => s.updateEvent)
    const getDraftCollectionColor =
        useEventFormDraftCollectionColor(eventCollections)

    const ensureEventCollections = useCallback(
        async (collectionNames: string[]) => {
            if (
                !activeCalendar?.id ||
                activeCalendar.id === "demo" ||
                disabled ||
                collectionNames.length === 0
            ) {
                return useCalendarStore.getState().eventCollections
            }

            const supabase = createBrowserSupabase()
            const collectionMap = new Map(
                useCalendarStore
                    .getState()
                    .eventCollections.map((collection) => [
                        normalizeCollectionName(collection.name),
                        collection,
                    ])
            )

            for (const name of collectionNames) {
                const collectionKey = normalizeCollectionName(name)

                if (!collectionKey || collectionMap.has(collectionKey)) {
                    continue
                }

                const createdCollection = await createCalendarEventCollection(
                    supabase,
                    activeCalendar.id,
                    {
                        name,
                        options: {
                            visibleByDefault: true,
                            color: getDraftCollectionColor(name),
                        },
                    }
                )

                if (!createdCollection) {
                    continue
                }

                collectionMap.set(collectionKey, createdCollection)
                upsertEventCollectionSnapshot(createdCollection)
            }

            return useCalendarStore.getState().eventCollections
        },
        [
            activeCalendar?.id,
            disabled,
            getDraftCollectionColor,
            upsertEventCollectionSnapshot,
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

    const saveCollectionNames = useCallback(
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

            const nextCollectionNames = normalizeNames(rawNames)
            const sourceCollectionNames = normalizeNames(
                event.collections.map((collection) => collection.name)
            )

            const resolvedCollections =
                JSON.stringify(sourceCollectionNames) ===
                JSON.stringify(nextCollectionNames)
                    ? useCalendarStore.getState().eventCollections
                    : await ensureEventCollections(nextCollectionNames)

            const patch = buildEventCollectionsAssignmentPatch(
                event,
                nextCollectionNames,
                resolvedCollections,
                getDraftCollectionColor,
                activeCalendar?.id ?? event.collections[0]?.calendarId ?? ""
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
            ensureEventCollections,
            getDraftCollectionColor,
            sourceEventId,
            updateEvent,
        ]
    )

    return {
        saveStatus,
        saveCollectionNames,
        getDraftCollectionColor,
        eventCollections,
    }
}
