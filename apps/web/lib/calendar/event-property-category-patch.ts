import type { CalendarCategoryColor } from "@/lib/calendar/category-color"
import {
    normalizeCategoryName,
    normalizeNames,
} from "@/lib/calendar/event-form-names"
import type {
    CalendarEvent,
    CalendarEventCategory,
    CalendarEventPatch,
} from "@/store/calendar-store.types"

/**
 * 일정에 매핑할 `categories` / `category` 패치를 만든다. 이름 목록이 기존과 같으면 null.
 *
 * @param sourceEvent 비교 기준이 되는 현재 일정
 * @param nextCategoryNames 적용할 카테고리 표시 이름 목록 (순서 유지)
 * @param categorySource 캘린더에 등록된 카테고리 스냅샷(미등록 이름은 임시 객체로 채움)
 * @param getDraftCategoryColor 신규 이름에 대한 임시 색
 * @param activeCalendarId 데모/로컬 드래프트용 calendarId
 */
export function buildEventCategoriesAssignmentPatch(
    sourceEvent: CalendarEvent,
    nextCategoryNames: string[],
    categorySource: CalendarEventCategory[],
    getDraftCategoryColor: (name: string) => CalendarCategoryColor,
    activeCalendarId: string
): Pick<CalendarEventPatch, "categories" | "category"> | null {
    const nextNames = normalizeNames(nextCategoryNames)
    const sourceNames = normalizeNames(
        sourceEvent.categories.map((category) => category.name)
    )

    if (JSON.stringify(sourceNames) === JSON.stringify(nextNames)) {
        return null
    }

    const nextCategories: CalendarEventCategory[] = nextNames.map(
        (categoryName) => {
            const matchedCategory =
                categorySource.find(
                    (category) =>
                        normalizeCategoryName(category.name) ===
                        normalizeCategoryName(categoryName)
                ) ?? null

            return (
                matchedCategory ?? {
                    id: "",
                    calendarId: activeCalendarId,
                    name: categoryName,
                    options: {
                        visibleByDefault: true,
                        color: getDraftCategoryColor(categoryName),
                    },
                    createdById: null,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                }
            )
        }
    )

    return {
        categories: nextCategories,
        category: nextCategories[0] ?? null,
    }
}
