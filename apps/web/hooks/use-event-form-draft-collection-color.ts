"use client"

import { randomCalendarCollectionColor } from "@/lib/calendar/collection-color"
import type { CalendarCollectionColor } from "@/lib/calendar/collection-color"
import type { CalendarEventCollection } from "@/store/calendar-store.types"
import { useCallback, useEffect, useRef } from "react"

/**
 * EventForm과 동일하게: 서버에 없는 신규 컬렉션 이름에 대해 세션 동안 고정된 임시 색을 부여한다.
 * `eventCollections`에 색이 있으면 ref에 시드해 폼·퀵 편집 간 색이 어긋나지 않게 한다.
 */
export function useEventFormDraftCollectionColor(
    eventCollections: CalendarEventCollection[],
    seedCollections?: Array<{
        name: string
        color?: CalendarCollectionColor | null
    }>
) {
    const draftCollectionColorsRef = useRef<Map<string, CalendarCollectionColor>>(
        new Map()
    )

    useEffect(() => {
        for (const collection of eventCollections) {
            if (collection.options.color) {
                draftCollectionColorsRef.current.set(
                    collection.name.trim(),
                    collection.options.color
                )
            }
        }
    }, [eventCollections])

    useEffect(() => {
        if (!seedCollections || seedCollections.length === 0) {
            return
        }

        for (const row of seedCollections) {
            const name = row.name.trim()
            const color = row.color ?? undefined

            if (!name || !color) {
                continue
            }

            draftCollectionColorsRef.current.set(name, color)
        }
    }, [seedCollections])

    return useCallback((name: string) => {
        const trimmedName = name.trim()

        if (!trimmedName) {
            return randomCalendarCollectionColor()
        }

        const existingColor = draftCollectionColorsRef.current.get(trimmedName)

        if (existingColor) {
            return existingColor
        }

        const nextColor = randomCalendarCollectionColor()
        draftCollectionColorsRef.current.set(trimmedName, nextColor)
        return nextColor
    }, [])
}
