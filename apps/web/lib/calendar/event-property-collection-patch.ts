import type { CalendarCollectionColor } from "@/lib/calendar/collection-color"
import {
    normalizeCollectionName,
    normalizeNames,
} from "@/lib/calendar/event-form-names"
import type {
    CalendarEvent,
    CalendarEventCollection,
    CalendarEventPatch,
} from "@/store/calendar-store.types"

/**
 * 일정에 매핑할 `collections` / `primaryCollection` 패치를 만든다. 이름 목록이 기존과 같으면 null.
 *
 * @param sourceEvent 비교 기준이 되는 현재 일정
 * @param nextCollectionNames 적용할 컬렉션 표시 이름 목록 (순서 유지)
 * @param collectionSource 캘린더에 등록된 컬렉션 스냅샷(미등록 이름은 임시 객체로 채움)
 * @param getDraftCollectionColor 신규 이름에 대한 임시 색
 * @param activeCalendarId 데모/로컬 드래프트용 calendarId
 */
export function buildEventCollectionsAssignmentPatch(
    sourceEvent: CalendarEvent,
    nextCollectionNames: string[],
    collectionSource: CalendarEventCollection[],
    getDraftCollectionColor: (name: string) => CalendarCollectionColor,
    activeCalendarId: string
): Pick<CalendarEventPatch, "collections" | "primaryCollection"> | null {
    const nextNames = normalizeNames(nextCollectionNames)
    const sourceNames = normalizeNames(
        sourceEvent.collections.map((collection) => collection.name)
    )

    if (JSON.stringify(sourceNames) === JSON.stringify(nextNames)) {
        return null
    }

    const nextCollections: CalendarEventCollection[] = nextNames.map(
        (collectionName) => {
            const matchedCollection =
                collectionSource.find(
                    (collection) =>
                        normalizeCollectionName(collection.name) ===
                        normalizeCollectionName(collectionName)
                ) ?? null

            return (
                matchedCollection ?? {
                    id: "",
                    calendarId: activeCalendarId,
                    name: collectionName,
                    options: {
                        visibleByDefault: true,
                        color: getDraftCollectionColor(collectionName),
                    },
                    createdById: null,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                }
            )
        }
    )

    return {
        collections: nextCollections,
        primaryCollection: nextCollections[0] ?? null,
    }
}
