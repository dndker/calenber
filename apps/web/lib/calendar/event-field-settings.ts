import type {
    CalendarEventFieldId,
    CalendarEventFieldSettings,
} from "@/store/calendar-store.types"

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number) {
    const nextItems = [...items]
    const [movedItem] = nextItems.splice(fromIndex, 1)

    if (movedItem === undefined) {
        return items
    }

    nextItems.splice(toIndex, 0, movedItem)
    return nextItems
}

export type CalendarEventFieldDefinition = {
    id: CalendarEventFieldId
    label: string
    description: string
}

const fieldDefinitionKeyMap: Array<{
    id: CalendarEventFieldId
    labelKey: string
    descriptionKey: string
}> = [
    {
        id: "schedule",
        labelKey: "scheduleLabel",
        descriptionKey: "scheduleDescription",
    },
    {
        id: "collections",
        labelKey: "collectionsLabel",
        descriptionKey: "collectionsDescription",
    },
    {
        id: "status",
        labelKey: "statusLabel",
        descriptionKey: "statusDescription",
    },
    {
        id: "participants",
        labelKey: "participantsLabel",
        descriptionKey: "participantsDescription",
    },
    {
        id: "recurrence",
        labelKey: "recurrenceLabel",
        descriptionKey: "recurrenceDescription",
    },
    {
        id: "exceptions",
        labelKey: "exceptionsLabel",
        descriptionKey: "exceptionsDescription",
    },
    {
        id: "timezone",
        labelKey: "timezoneLabel",
        descriptionKey: "timezoneDescription",
    },
    {
        id: "place",
        labelKey: "placeLabel",
        descriptionKey: "placeDescription",
    },
    {
        id: "notification",
        labelKey: "notificationLabel",
        descriptionKey: "notificationDescription",
    },
]

export function getCalendarEventFieldDefinitions(
    t: (key: string) => string
): CalendarEventFieldDefinition[] {
    return fieldDefinitionKeyMap.map((field) => ({
        id: field.id,
        label: t(field.labelKey),
        description: t(field.descriptionKey),
    }))
}

const defaultVisibleFieldIds = new Set<CalendarEventFieldId>([
    "schedule",
    "collections",
])

const defaultItems = fieldDefinitionKeyMap.map((field) => ({
    id: field.id,
    visible: defaultVisibleFieldIds.has(field.id),
}))

export function getDefaultCalendarEventFieldSettings(): CalendarEventFieldSettings {
    return {
        version: 1,
        items: defaultItems.map((item) => ({ ...item })),
    }
}

export function normalizeCalendarEventFieldSettings(
    input: unknown
): CalendarEventFieldSettings {
    const defaultSettings = getDefaultCalendarEventFieldSettings()

    if (!input || typeof input !== "object") {
        return defaultSettings
    }

    const candidate = input as Partial<CalendarEventFieldSettings>
    const inputItems = Array.isArray(candidate.items) ? candidate.items : []
    const validFieldIds = new Set(
        fieldDefinitionKeyMap.map((field) => field.id)
    )
    const inputMap = new Map(
        inputItems.flatMap((item) => {
            if (
                !item ||
                typeof item !== "object" ||
                typeof item.id !== "string" ||
                typeof item.visible !== "boolean" ||
                !validFieldIds.has(item.id as CalendarEventFieldId)
            ) {
                return []
            }

            return [[item.id as CalendarEventFieldId, item.visible] as const]
        })
    )

    const seenFieldIds = new Set<CalendarEventFieldId>()
    const items = [
        ...inputItems.flatMap((item) => {
            if (
                !item ||
                typeof item !== "object" ||
                typeof item.id !== "string" ||
                typeof item.visible !== "boolean" ||
                !validFieldIds.has(item.id as CalendarEventFieldId)
            ) {
                return []
            }

            const fieldId = item.id as CalendarEventFieldId

            if (seenFieldIds.has(fieldId)) {
                return []
            }

            seenFieldIds.add(fieldId)

            return [
                {
                    id: fieldId,
                    visible: item.visible,
                },
            ]
        }),
        ...fieldDefinitionKeyMap
            .filter((field) => !inputMap.has(field.id))
            .map((field) => ({
                id: field.id,
                visible: defaultVisibleFieldIds.has(field.id),
            })),
    ]

    return {
        version: 1,
        items,
    }
}

export function getCalendarEventFieldOrder(
    settings?: CalendarEventFieldSettings | null
) {
    return normalizeCalendarEventFieldSettings(settings).items.map(
        (item) => item.id
    )
}

export function orderCalendarEventFieldIds<T extends CalendarEventFieldId>(
    settings: CalendarEventFieldSettings | null | undefined,
    fieldIds: T[]
) {
    const orderMap = new Map(
        getCalendarEventFieldOrder(settings).map((fieldId, index) => [
            fieldId,
            index,
        ])
    )

    return [...fieldIds].sort((a, b) => {
        return (
            (orderMap.get(a) ?? Number.MAX_SAFE_INTEGER) -
            (orderMap.get(b) ?? Number.MAX_SAFE_INTEGER)
        )
    })
}

export function isCalendarEventFieldVisible(
    settings: CalendarEventFieldSettings | null | undefined,
    fieldId: CalendarEventFieldId
) {
    return (
        normalizeCalendarEventFieldSettings(settings).items.find(
            (item) => item.id === fieldId
        )?.visible !== false
    )
}

export function moveCalendarEventFieldSettings(
    settings: CalendarEventFieldSettings | null | undefined,
    activeId: CalendarEventFieldId,
    overId: CalendarEventFieldId
) {
    const normalized = normalizeCalendarEventFieldSettings(settings)
    const items = [...normalized.items]
    const activeIndex = items.findIndex((item) => item.id === activeId)
    const overIndex = items.findIndex((item) => item.id === overId)

    if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
        return normalized
    }

    return {
        ...normalized,
        items: moveArrayItem(items, activeIndex, overIndex),
    }
}

export function setCalendarEventFieldVisibility(
    settings: CalendarEventFieldSettings | null | undefined,
    fieldId: CalendarEventFieldId,
    visible: boolean
) {
    const normalized = normalizeCalendarEventFieldSettings(settings)
    const items = normalized.items.map((item) =>
        item.id === fieldId ? { ...item, visible } : item
    )

    return {
        ...normalized,
        items,
    }
}
