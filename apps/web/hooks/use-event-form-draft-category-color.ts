"use client"

import { randomCalendarCategoryColor } from "@/lib/calendar/category-color"
import type { CalendarCategoryColor } from "@/lib/calendar/category-color"
import type { CalendarEventCategory } from "@/store/calendar-store.types"
import { useCallback, useEffect, useRef } from "react"

/**
 * EventForm과 동일하게: 서버에 없는 신규 카테고리 이름에 대해 세션 동안 고정된 임시 색을 부여한다.
 * `eventCategories`에 색이 있으면 ref에 시드해 폼·퀵 편집 간 색이 어긋나지 않게 한다.
 */
export function useEventFormDraftCategoryColor(
    eventCategories: CalendarEventCategory[],
    seedCategories?: Array<{
        name: string
        color?: CalendarCategoryColor | null
    }>
) {
    const draftCategoryColorsRef = useRef<Map<string, CalendarCategoryColor>>(
        new Map()
    )

    useEffect(() => {
        for (const category of eventCategories) {
            if (category.options.color) {
                draftCategoryColorsRef.current.set(
                    category.name.trim(),
                    category.options.color
                )
            }
        }
    }, [eventCategories])

    useEffect(() => {
        if (!seedCategories || seedCategories.length === 0) {
            return
        }

        for (const category of seedCategories) {
            const name = category.name.trim()
            const color = category.color ?? undefined

            if (!name || !color) {
                continue
            }

            draftCategoryColorsRef.current.set(name, color)
        }
    }, [seedCategories])

    return useCallback((name: string) => {
        const trimmedName = name.trim()

        if (!trimmedName) {
            return randomCalendarCategoryColor()
        }

        const existingColor = draftCategoryColorsRef.current.get(trimmedName)

        if (existingColor) {
            return existingColor
        }

        const nextColor = randomCalendarCategoryColor()
        draftCategoryColorsRef.current.set(trimmedName, nextColor)
        return nextColor
    }, [])
}
