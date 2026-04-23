"use client"

import {
    getCalendarCategoryDotClassName,
    getCalendarCategoryLabelClassName,
    randomCalendarCategoryColor,
    type CalendarCategoryColor,
} from "@/lib/calendar/category-color"
import { createCalendarEventCategory } from "@/lib/calendar/mutations"
import {
    getCalendarMemberDirectory,
    type CalendarMemberDirectoryItem,
} from "@/lib/calendar/queries"
import dayjs from "@/lib/dayjs"
import { createBrowserSupabase } from "@/lib/supabase/client"
import { zodResolver } from "@hookform/resolvers/zod"
import {
    BellIcon,
    CalendarRangeIcon,
    ChevronDownIcon,
    CircleCheckBigIcon,
    ClockAlertIcon,
    EarthIcon,
    MapPinIcon,
    Repeat2Icon,
    Settings2Icon,
    TagsIcon,
    UsersIcon,
} from "lucide-react"
import type { DateRange } from "react-day-picker"
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form"
import { withMask } from "use-mask-input"

import { EventCategorySettingsPanel } from "./event-category-settings-panel"
import { EventChipsCombobox } from "./event-chips-combobox"
import {
    EventFormPropertyRow,
    type EventFormPropertyMenuItem,
    type EventFormPropertyVisibility,
} from "./event-form-property-row"
import { EventFormRecurrenceField } from "./event-form-recurrence-field"
import { eventFormSchema, type EventFormValues } from "./event-form.schema"
import { TimezoneSelect } from "./timezone-select"

import { Button } from "@workspace/ui/components/button"
import { Field, FieldError, FieldGroup } from "@workspace/ui/components/field"

import { CalendarPicker } from "@workspace/ui/components/calendar-picker"
import { Input } from "@workspace/ui/components/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@workspace/ui/components/popover"

import { useCalendarEventFieldSettings } from "@/hooks/use-calendar-event-field-settings"
import {
    calendarEventFieldDefinitions,
    isCalendarEventFieldVisible,
    moveCalendarEventFieldSettings,
    setCalendarEventFieldVisibility,
} from "@/lib/calendar/event-field-settings"
import {
    defaultContent,
    eventStatus,
    eventStatusLabel,
    type CalendarEvent,
    type CalendarEventCategory,
    type CalendarEventParticipant,
    type CalendarEventPatch,
    type EditorContent,
} from "@/store/calendar-store.types"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import {
    closestCenter,
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@workspace/ui/components/hover-card"
import { Separator } from "@workspace/ui/components/separator"
import { Switch } from "@workspace/ui/components/switch"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ContentEditor from "../editor/content-editor"

const ContentEditorCSR = dynamic(() => import("../editor/content-editor"), {
    ssr: false,
})

const statusItems = eventStatus.map((status) => ({
    value: status,
    label: eventStatusLabel[status],
}))

type StatusOption = (typeof statusItems)[number]

const statusLabelClassNameMap: Record<StatusOption["value"], string> = {
    scheduled:
        "bg-muted text-muted-foreground [&_button]:hidden border-0 dark:bg-input/50",
    in_progress: getCalendarCategoryLabelClassName(
        "blue",
        "[&_button]:hidden border-0"
    ),
    completed: getCalendarCategoryLabelClassName(
        "green",
        "[&_button]:hidden border-0"
    ),
    cancelled: getCalendarCategoryLabelClassName(
        "red",
        "[&_button]:hidden border-0"
    ),
}

const statusItemClassNameMap: Record<StatusOption["value"], string> = {
    scheduled:
        "inline-flex rounded-full bg-muted px-2 py-0.5 text-sm text-muted-foreground border-0 dark:bg-input/50",
    in_progress: getCalendarCategoryLabelClassName(
        "blue",
        "inline-flex rounded-full px-2 py-0.5 text-sm border-0"
    ),
    completed: getCalendarCategoryLabelClassName(
        "green",
        "inline-flex rounded-full px-2 py-0.5 text-sm border-0"
    ),
    cancelled: getCalendarCategoryLabelClassName(
        "red",
        "inline-flex rounded-full px-2 py-0.5 text-sm border-0"
    ),
}

const statusDotClassNameMap: Record<StatusOption["value"], string> = {
    scheduled: "bg-muted-foreground/70",
    in_progress: getCalendarCategoryDotClassName("blue"),
    completed: getCalendarCategoryDotClassName("green"),
    cancelled: getCalendarCategoryDotClassName("red"),
}

const eventFieldIconMap = {
    schedule: CalendarRangeIcon,
    participants: UsersIcon,
    categories: TagsIcon,
    status: CircleCheckBigIcon,
    recurrence: Repeat2Icon,
    exceptions: ClockAlertIcon,
    timezone: EarthIcon,
    place: MapPinIcon,
    notification: BellIcon,
} as const

type CategoryOption = {
    value: string
    label: string
    color?: CalendarCategoryColor
    isCreate?: boolean
    data?: CalendarEventCategory
}

type ParticipantOption = {
    value: string
    label: string
    searchText: string
    data: {
        id: string
        userId: string
        name: string | null
        email: string | null
        avatarUrl: string | null
    }
}

function normalizeNames(values: string[]) {
    return Array.from(
        new Set(values.map((value) => value.trim()).filter(Boolean))
    )
}

function normalizeCategoryName(value: string) {
    return value.trim().toLowerCase()
}

function normalizeIds(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)))
}

type ScheduleBoundary = "start" | "end"

function isSameScheduleDay(start: Date, end: Date) {
    return dayjs(start).isSame(end, "day")
}

function formatDateInputValue(date: Date) {
    return dayjs(date).format("YY.MM.DD")
}

function formatTimeInputValue(date: Date) {
    return dayjs(date).format("HH:mm")
}

function setDateParts(baseDate: Date, value: string) {
    const normalized = value.trim()
    let year = NaN
    let month = NaN
    let day = NaN

    if (/^\d{2}\.\d{2}\.\d{2}$/.test(normalized)) {
        const parts = normalized.split(".")
        year = 2000 + Number(parts[0] ?? NaN)
        month = Number(parts[1] ?? NaN)
        day = Number(parts[2] ?? NaN)
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        const parts = normalized.split("-")
        year = Number(parts[0] ?? NaN)
        month = Number(parts[1] ?? NaN)
        day = Number(parts[2] ?? NaN)
    }

    if (!year || !month || !day) {
        return baseDate
    }

    const candidate = new Date(year, month - 1, day)
    const isValidDate =
        candidate.getFullYear() === year &&
        candidate.getMonth() === month - 1 &&
        candidate.getDate() === day

    if (!isValidDate) {
        return baseDate
    }

    const nextDate = new Date(baseDate)
    nextDate.setFullYear(year, month - 1, day)
    return nextDate
}

function setTimeParts(baseDate: Date, value: string) {
    const [hour = NaN, minute = NaN] = value.split(":").map(Number)

    if (Number.isNaN(hour) || Number.isNaN(minute)) {
        return baseDate
    }

    const nextDate = new Date(baseDate)
    nextDate.setHours(hour, minute, 0, 0)
    return nextDate
}

function normalizeScheduleRange(
    start: Date,
    end: Date,
    changedBoundary: ScheduleBoundary
) {
    if (start.getTime() <= end.getTime()) {
        return { start, end }
    }

    if (changedBoundary === "start") {
        return { start, end: new Date(start) }
    }

    return { start: new Date(end), end }
}

function getRangeModifiers(start: Date, end: Date) {
    if (isSameScheduleDay(start, end)) {
        return {
            selected: [start],
            range_start: [start],
            range_end: [end],
            range_middle: [],
        }
    }

    return {
        selected: {
            from: start,
            to: end,
        },
        range_start: [start],
        range_end: [end],
        range_middle: [
            {
                after: start,
                before: end,
            },
        ],
    }
}

function formatScheduleTriggerLabel({
    start,
    end,
    allDay,
}: {
    start: Date
    end: Date
    allDay: boolean
}) {
    if (allDay) {
        if (isSameScheduleDay(start, end)) {
            return dayjs(start).format("YYYY년 M월 D일")
        }

        return `${dayjs(start).format("YYYY년 M월 D일")} ~ ${dayjs(end).format("YYYY년 M월 D일")}`
    }

    if (isSameScheduleDay(start, end)) {
        return `${dayjs(start).format("YYYY년 M월 D일 HH:mm")} - ${dayjs(end).format("HH:mm")}`
    }

    return `${dayjs(start).format("YYYY년 M월 D일 HH:mm")} ~ ${dayjs(end).format("YYYY년 M월 D일 HH:mm")}`
}

const EMPTY_MEMBER_DIRECTORY: CalendarMemberDirectoryItem[] = []

function getDefaultParticipantIds({
    event,
    currentUserId,
}: {
    event?: CalendarEvent
    currentUserId?: string | null
}) {
    const eventParticipantIds =
        event?.participants.map((participant) => participant.userId) ?? []

    if (eventParticipantIds.length > 0) {
        return normalizeIds(eventParticipantIds)
    }

    const fallbackUserId = event?.authorId ?? currentUserId ?? null

    return fallbackUserId ? [fallbackUserId] : []
}

export function EventForm({
    event,
    onChange,
    disabled = false,
    modal = false,
    portalContainer,
}: {
    event?: CalendarEvent
    onChange?: (
        patch: CalendarEventPatch,
        options?: {
            expectedUpdatedAt?: number
        }
    ) => void
    disabled?: boolean
    modal?: boolean
    portalContainer?: HTMLElement | null
}) {
    const user = useAuthStore((a) => a.user)
    const defaultParticipantIds = useMemo(
        () => getDefaultParticipantIds({ event, currentUserId: user?.id }),
        [event, user?.id]
    )

    const form = useForm<EventFormValues>({
        resolver: zodResolver(eventFormSchema) as Resolver<EventFormValues>,
        defaultValues: event
            ? {
                  title: event.title,
                  content: event.content,
                  start: new Date(event.start),
                  end: new Date(event.end),
                  timezone: event.timezone,
                  categoryNames: event.categories.map(
                      (category) => category.name
                  ),
                  participantIds: defaultParticipantIds,
                  allDay: event.allDay,
                  recurrence: event.recurrence,
                  exceptions: event.exceptions,
                  status: event.status,
              }
            : {
                  title: "",
                  content: defaultContent,
                  start: new Date(),
                  end: new Date(),
                  timezone: "Asia/Seoul",
                  categoryNames: [],
                  participantIds: defaultParticipantIds,
                  allDay: false,
                  status: eventStatus[0],
              },
    })

    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const eventCategories = useCalendarStore((s) => s.eventCategories)
    const upsertEventCategorySnapshot = useCalendarStore(
        (s) => s.upsertEventCategorySnapshot
    )
    const { eventFieldSettings, saveEventFieldSettings } =
        useCalendarEventFieldSettings()
    const [areHiddenFieldsOpen, setAreHiddenFieldsOpen] = useState(false)
    const [memberDirectoryState, setMemberDirectoryState] = useState<{
        calendarId: string | null
        members: CalendarMemberDirectoryItem[]
    }>({
        calendarId: null,
        members: [],
    })

    const timer = useRef<NodeJS.Timeout | null>(null)
    const draftCategoryColorsRef = useRef<Map<string, CalendarCategoryColor>>(
        new Map()
    )
    const wasBootstrappedWithEventRef = useRef(Boolean(event))
    const initializedEventIdRef = useRef<string | null>(null)
    const lastAppliedUpdatedAtRef = useRef<number | null>(null)
    const [isSchedulePopoverOpen, setIsSchedulePopoverOpen] = useState(false)
    const [activeScheduleBoundary, setActiveScheduleBoundary] =
        useState<ScheduleBoundary>("start")
    const [schedulePickerMonth, setSchedulePickerMonth] = useState<Date>(() =>
        form.getValues("start")
    )
    const [scheduleStart, scheduleEnd, scheduleAllDay] = useWatch({
        control: form.control,
        name: ["start", "end", "allDay"],
    })

    const getDraftCategoryColor = useCallback((name: string) => {
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
    const memberDirectory =
        !activeCalendar?.id ||
        activeCalendar.id === "demo" ||
        memberDirectoryState.calendarId !== activeCalendar.id
            ? EMPTY_MEMBER_DIRECTORY
            : memberDirectoryState.members

    const resetFormWithEvent = useCallback(
        (targetEvent: CalendarEvent) => {
            form.reset({
                title: targetEvent.title,
                content: targetEvent.content,
                start: new Date(targetEvent.start),
                end: new Date(targetEvent.end),
                timezone: targetEvent.timezone,
                categoryNames: targetEvent.categories.map(
                    (category) => category.name
                ),
                participantIds: getDefaultParticipantIds({
                    event: targetEvent,
                    currentUserId: user?.id,
                }),
                allDay: targetEvent.allDay,
                recurrence: targetEvent.recurrence,
                exceptions: targetEvent.exceptions,
                status: targetEvent.status,
            })
        },
        [form, user?.id]
    )

    const isSameValue = (
        prevValue: unknown,
        nextValue: unknown,
        kind: "date" | "json" | "primitive" = "primitive"
    ) => {
        if (kind === "date") {
            return (
                prevValue instanceof Date &&
                nextValue instanceof Date &&
                prevValue.getTime() === nextValue.getTime()
            )
        }

        if (kind === "json") {
            return (
                JSON.stringify(prevValue ?? null) ===
                JSON.stringify(nextValue ?? null)
            )
        }

        return prevValue === nextValue
    }

    const buildPatchFromValues = useCallback(
        (
            sourceEvent: CalendarEvent,
            values: EventFormValues,
            categorySource = eventCategories
        ): CalendarEventPatch => {
            const normalizedTitle =
                values.title && values.title.trim() !== "" ? values.title : ""
            const patch: CalendarEventPatch = {}

            if (!isSameValue(sourceEvent.title, normalizedTitle)) {
                patch.title = normalizedTitle
            }

            if (!isSameValue(sourceEvent.content, values.content, "json")) {
                patch.content = values.content
            }

            if (
                !isSameValue(
                    sourceEvent.start,
                    values.start.getTime(),
                    "primitive"
                )
            ) {
                patch.start = values.start.getTime()
            }

            if (
                !isSameValue(sourceEvent.end, values.end.getTime(), "primitive")
            ) {
                patch.end = values.end.getTime()
            }

            if (!isSameValue(sourceEvent.allDay, values.allDay)) {
                patch.allDay = values.allDay
            }

            if (!isSameValue(sourceEvent.timezone, values.timezone)) {
                patch.timezone = values.timezone
            }

            const nextCategoryNames = normalizeNames(values.categoryNames)
            const sourceCategoryNames = normalizeNames(
                sourceEvent.categories.map((category) => category.name)
            )

            if (!isSameValue(sourceCategoryNames, nextCategoryNames, "json")) {
                const nextCategories = nextCategoryNames.map(
                    (categoryName): CalendarEventCategory => {
                        const matchedCategory =
                            categorySource.find(
                                (category) =>
                                    normalizeCategoryName(category.name) ===
                                    normalizeCategoryName(categoryName)
                            ) ?? null

                        return (
                            matchedCategory ?? {
                                id: "",
                                calendarId: activeCalendar?.id ?? "",
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

                patch.categories = nextCategories
                patch.category = nextCategories[0] ?? null
            }

            const nextParticipantIds = normalizeIds(values.participantIds)
            const sourceParticipantIds = normalizeIds(
                sourceEvent.participants.map(
                    (participant) => participant.userId
                )
            )

            if (
                !isSameValue(sourceParticipantIds, nextParticipantIds, "json")
            ) {
                const memberMap = new Map(
                    memberDirectory.map((member) => [member.userId, member])
                )

                const nextParticipants = nextParticipantIds.flatMap(
                    (participantId): CalendarEventParticipant[] => {
                        const sourceParticipant = sourceEvent.participants.find(
                            (participant) =>
                                participant.userId === participantId
                        )

                        if (sourceParticipant) {
                            return [sourceParticipant]
                        }

                        const member = memberMap.get(participantId)

                        if (member) {
                            return [
                                {
                                    id: member.id,
                                    eventId: sourceEvent.id,
                                    userId: member.userId,
                                    role: "participant",
                                    createdAt: Date.now(),
                                    user: {
                                        id: member.userId,
                                        name: member.name,
                                        email: member.email,
                                        avatarUrl: member.avatarUrl,
                                    },
                                },
                            ]
                        }

                        if (participantId === user?.id) {
                            return [
                                {
                                    id: `local:${participantId}`,
                                    eventId: sourceEvent.id,
                                    userId: participantId,
                                    role: "participant",
                                    createdAt: Date.now(),
                                    user: {
                                        id: participantId,
                                        name: user.name,
                                        email: user.email,
                                        avatarUrl: user.avatarUrl,
                                    },
                                },
                            ]
                        }

                        return []
                    }
                )

                patch.participants = nextParticipants
            }

            if (
                !isSameValue(sourceEvent.recurrence, values.recurrence, "json")
            ) {
                patch.recurrence = values.recurrence ?? null
            }

            if (
                !isSameValue(sourceEvent.exceptions, values.exceptions, "json")
            ) {
                patch.exceptions = values.exceptions
            }

            if (!isSameValue(sourceEvent.status, values.status)) {
                patch.status = values.status
            }

            return patch
        },
        [
            activeCalendar?.id,
            eventCategories,
            getDraftCategoryColor,
            memberDirectory,
            user,
        ]
    )

    const ensureEventCategories = useCallback(
        async (categoryNames: string[]) => {
            if (
                !activeCalendar?.id ||
                activeCalendar.id === "demo" ||
                disabled ||
                categoryNames.length === 0
            ) {
                return eventCategories
            }

            const supabase = createBrowserSupabase()
            const categoryMap = new Map(
                eventCategories.map((category) => [
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

            return Array.from(categoryMap.values())
        },
        [
            activeCalendar?.id,
            disabled,
            eventCategories,
            getDraftCategoryColor,
            upsertEventCategorySnapshot,
        ]
    )

    const saveNow = useCallback(
        async (values: EventFormValues = form.getValues()) => {
            if (timer.current) {
                clearTimeout(timer.current)
            }

            if (activeCalendar?.id === "demo" || disabled || !event) {
                return
            }

            const isValid = await form.trigger(undefined, {
                shouldFocus: false,
            })

            if (!isValid) {
                return
            }

            const nextCategoryNames = normalizeNames(values.categoryNames)
            const sourceCategoryNames = normalizeNames(
                event.categories.map((category) => category.name)
            )
            const resolvedCategories =
                JSON.stringify(sourceCategoryNames) ===
                JSON.stringify(nextCategoryNames)
                    ? eventCategories
                    : await ensureEventCategories(nextCategoryNames)
            const patch = buildPatchFromValues(
                event,
                values,
                resolvedCategories
            )

            if (Object.keys(patch).length === 0) {
                return
            }

            onChange?.(patch, {
                expectedUpdatedAt: event.updatedAt,
            })
        },
        [
            activeCalendar?.id,
            buildPatchFromValues,
            disabled,
            ensureEventCategories,
            event,
            eventCategories,
            form,
            onChange,
        ]
    )

    const autoSave = useCallback(() => {
        if (timer.current) clearTimeout(timer.current)

        if (activeCalendar?.id === "demo") return

        if (disabled) {
            return
        }

        timer.current = setTimeout(() => {
            void saveNow()
        }, 350)
    }, [activeCalendar?.id, disabled, saveNow])

    const updateScheduleValues = useCallback(
        (nextStart: Date, nextEnd: Date, changedBoundary: ScheduleBoundary) => {
            const normalized = normalizeScheduleRange(
                nextStart,
                nextEnd,
                changedBoundary
            )

            form.setValue("start", normalized.start, {
                shouldDirty: true,
                shouldTouch: true,
            })
            form.setValue("end", normalized.end, {
                shouldDirty: true,
                shouldTouch: true,
            })
            autoSave()
        },
        [autoSave, form]
    )

    const focusScheduleBoundary = useCallback(
        (boundary: ScheduleBoundary) => {
            const targetDate =
                boundary === "start"
                    ? form.getValues("start")
                    : form.getValues("end")

            setActiveScheduleBoundary(boundary)
            setSchedulePickerMonth(targetDate)
        },
        [form]
    )

    const handleScheduleDateChange = useCallback(
        (
            boundary: ScheduleBoundary,
            value: string,
            options?: { syncSameDayRange?: boolean }
        ) => {
            const currentStart = form.getValues("start")
            const currentEnd = form.getValues("end")

            if (!value) {
                return
            }

            const shouldSyncSameDayRange =
                options?.syncSameDayRange &&
                isSameScheduleDay(currentStart, currentEnd)

            const nextStart =
                boundary === "start" || shouldSyncSameDayRange
                    ? setDateParts(currentStart, value)
                    : currentStart
            const nextEnd =
                boundary === "end" || shouldSyncSameDayRange
                    ? setDateParts(currentEnd, value)
                    : currentEnd

            setSchedulePickerMonth(boundary === "end" ? nextEnd : nextStart)
            updateScheduleValues(nextStart, nextEnd, boundary)
        },
        [form, updateScheduleValues]
    )

    const handleScheduleTimeChange = useCallback(
        (boundary: ScheduleBoundary, value: string) => {
            const currentStart = form.getValues("start")
            const currentEnd = form.getValues("end")

            if (!value) {
                return
            }

            const nextStart =
                boundary === "start"
                    ? setTimeParts(currentStart, value)
                    : currentStart
            const nextEnd =
                boundary === "end"
                    ? setTimeParts(currentEnd, value)
                    : currentEnd

            updateScheduleValues(nextStart, nextEnd, boundary)
        },
        [form, updateScheduleValues]
    )

    const handleScheduleDaySelect = useCallback(
        (date: Date | undefined) => {
            if (!date) {
                return
            }

            const currentStart = form.getValues("start")
            const currentEnd = form.getValues("end")
            const shouldSyncSameDayRange = isSameScheduleDay(
                currentStart,
                currentEnd
            )
            const nextDateValue = formatDateInputValue(date)

            const nextStart =
                activeScheduleBoundary === "start" || shouldSyncSameDayRange
                    ? setDateParts(currentStart, nextDateValue)
                    : currentStart
            const nextEnd =
                activeScheduleBoundary === "end" || shouldSyncSameDayRange
                    ? setDateParts(currentEnd, nextDateValue)
                    : currentEnd

            setSchedulePickerMonth(date)
            updateScheduleValues(nextStart, nextEnd, activeScheduleBoundary)
        },
        [activeScheduleBoundary, form, updateScheduleValues]
    )

    const handleScheduleRangeSelect = useCallback(
        (range: DateRange | undefined) => {
            if (!range?.from) {
                return
            }

            const currentStart = form.getValues("start")
            const currentEnd = form.getValues("end")

            if (range.to) {
                const nextStart = setDateParts(
                    currentStart,
                    formatDateInputValue(range.from)
                )
                const nextEnd = setDateParts(
                    currentEnd,
                    formatDateInputValue(range.to)
                )

                setActiveScheduleBoundary("end")
                setSchedulePickerMonth(range.to)
                updateScheduleValues(nextStart, nextEnd, "end")
                return
            }

            handleScheduleDateChange(
                activeScheduleBoundary,
                formatDateInputValue(range.from),
                {
                    syncSameDayRange: isSameScheduleDay(
                        currentStart,
                        currentEnd
                    ),
                }
            )
        },
        [
            activeScheduleBoundary,
            form,
            handleScheduleDateChange,
            updateScheduleValues,
        ]
    )

    const handleSchedulePopoverOpenChange = useCallback(
        (open: boolean) => {
            if (open) {
                const boundary =
                    activeScheduleBoundary === "end" ? "end" : "start"
                focusScheduleBoundary(boundary)
            }

            setIsSchedulePopoverOpen(open)
        },
        [activeScheduleBoundary, focusScheduleBoundary]
    )

    const handleAllDayToggle = useCallback(
        (checked: boolean) => {
            form.setValue("allDay", checked, {
                shouldDirty: true,
                shouldTouch: true,
            })
            autoSave()
        },
        [autoSave, form]
    )

    useEffect(() => {
        if (!event) return

        if (initializedEventIdRef.current === null) {
            initializedEventIdRef.current = event.id
            lastAppliedUpdatedAtRef.current = event.updatedAt

            if (!wasBootstrappedWithEventRef.current) {
                resetFormWithEvent(event)
            }

            return
        }

        if (initializedEventIdRef.current !== event.id) {
            initializedEventIdRef.current = event.id
            lastAppliedUpdatedAtRef.current = event.updatedAt
            resetFormWithEvent(event)
            return
        }

        if (lastAppliedUpdatedAtRef.current === null) {
            lastAppliedUpdatedAtRef.current = event.updatedAt
            return
        }

        const isRemoteUpdate = event.updatedById !== (user?.id ?? null)
        const hasNewerServerVersion =
            event.updatedAt > lastAppliedUpdatedAtRef.current

        if (!isRemoteUpdate || !hasNewerServerVersion) {
            return
        }

        lastAppliedUpdatedAtRef.current = event.updatedAt
        resetFormWithEvent(event)
    }, [event, form, user?.id, resetFormWithEvent])

    useEffect(() => {
        if (event) {
            return
        }

        const currentParticipantIds = normalizeIds(
            form.getValues("participantIds") ?? []
        )

        if (
            currentParticipantIds.length > 0 ||
            defaultParticipantIds.length === 0
        ) {
            return
        }

        form.setValue("participantIds", defaultParticipantIds, {
            shouldDirty: false,
            shouldTouch: false,
        })
    }, [defaultParticipantIds, event, form])

    useEffect(() => {
        if (!activeCalendar?.id || activeCalendar.id === "demo") {
            return
        }

        let cancelled = false
        const targetCalendarId = activeCalendar.id
        const supabase = createBrowserSupabase()

        void getCalendarMemberDirectory(supabase, targetCalendarId).then(
            (members) => {
                if (cancelled) {
                    return
                }

                setMemberDirectoryState({
                    calendarId: targetCalendarId,
                    members,
                })
            }
        )

        return () => {
            cancelled = true
        }
    }, [activeCalendar?.id])

    useEffect(() => {
        eventCategories.forEach((category) => {
            if (category.options.color) {
                draftCategoryColorsRef.current.set(
                    category.name.trim(),
                    category.options.color
                )
            }
        })
    }, [eventCategories])

    useEffect(() => {
        if (!event || event.categoryIds.length === 0) {
            return
        }

        const nextCategoryNames = event.categoryIds
            .map(
                (categoryId) =>
                    eventCategories.find(
                        (category) => category.id === categoryId
                    )?.name ??
                    event.categories.find(
                        (category) => category.id === categoryId
                    )?.name ??
                    null
            )
            .filter((name): name is string => Boolean(name))
        const currentCategoryNames = normalizeNames(
            form.getValues("categoryNames") ?? []
        )
        const currentCategoryIds = currentCategoryNames
            .map(
                (categoryName) =>
                    eventCategories.find(
                        (category) =>
                            normalizeCategoryName(category.name) ===
                            normalizeCategoryName(categoryName)
                    )?.id ??
                    event.categories.find(
                        (category) =>
                            normalizeCategoryName(category.name) ===
                            normalizeCategoryName(categoryName)
                    )?.id ??
                    null
            )
            .filter((categoryId): categoryId is string => Boolean(categoryId))

        if (
            nextCategoryNames.length !== event.categoryIds.length ||
            JSON.stringify(currentCategoryIds.sort()) !==
                JSON.stringify([...event.categoryIds].sort()) ||
            JSON.stringify(currentCategoryNames) ===
                JSON.stringify(normalizeNames(nextCategoryNames))
        ) {
            return
        }

        form.setValue("categoryNames", normalizeNames(nextCategoryNames), {
            shouldDirty: false,
            shouldTouch: false,
        })
    }, [event, eventCategories, form])

    useEffect(() => {
        return () => {
            if (timer.current) {
                clearTimeout(timer.current)
            }
        }
    }, [])

    const watchedCategoryNames = useWatch({
        control: form.control,
        name: "categoryNames",
    })
    const watchedParticipantIds = useWatch({
        control: form.control,
        name: "participantIds",
    })
    const watchedStatus = useWatch({
        control: form.control,
        name: "status",
    })
    const watchedStart = useWatch({
        control: form.control,
        name: "start",
    })
    const watchedTimezone = useWatch({
        control: form.control,
        name: "timezone",
    })
    const selectedCategories = useMemo<CategoryOption[]>(
        () =>
            normalizeNames(watchedCategoryNames ?? []).map((categoryName) => {
                const matchedCategory =
                    eventCategories.find(
                        (category) =>
                            normalizeCategoryName(category.name) ===
                            normalizeCategoryName(categoryName)
                    ) ?? null

                return matchedCategory
                    ? {
                          value: matchedCategory.name,
                          label: matchedCategory.name,
                          color: matchedCategory.options.color,
                          data: matchedCategory,
                      }
                    : {
                          value: categoryName,
                          label: categoryName,
                          color: getDraftCategoryColor(categoryName),
                          isCreate: true,
                      }
            }),
        [eventCategories, getDraftCategoryColor, watchedCategoryNames]
    )
    const categoryItems = useMemo<CategoryOption[]>(
        () =>
            eventCategories.map((category) => ({
                value: category.name,
                label: category.name,
                color: category.options.color,
                data: category,
            })),
        [eventCategories]
    )
    const selectedParticipants = useMemo<ParticipantOption[]>(() => {
        const memberMap = new Map(
            memberDirectory.map((member) => [member.userId, member])
        )

        return normalizeIds(watchedParticipantIds ?? []).flatMap(
            (participantId) => {
                const member = memberMap.get(participantId)
                const sourceParticipant = event?.participants.find(
                    (participant) => participant.userId === participantId
                )

                if (member) {
                    return [
                        {
                            value: member.userId,
                            label: member.name ?? member.email ?? member.userId,
                            searchText:
                                `${member.name ?? ""} ${member.email ?? ""} ${member.userId}`.trim(),
                            data: {
                                id: member.id,
                                userId: member.userId,
                                name: member.name,
                                email: member.email,
                                avatarUrl: member.avatarUrl,
                            },
                        },
                    ]
                }

                if (sourceParticipant) {
                    return [
                        {
                            value: sourceParticipant.userId,
                            label:
                                sourceParticipant.user.name ??
                                sourceParticipant.user.email ??
                                sourceParticipant.userId,
                            searchText:
                                `${sourceParticipant.user.name ?? ""} ${sourceParticipant.user.email ?? ""} ${sourceParticipant.userId}`.trim(),
                            data: {
                                id: sourceParticipant.id,
                                userId: sourceParticipant.userId,
                                name: sourceParticipant.user.name,
                                email: sourceParticipant.user.email,
                                avatarUrl: sourceParticipant.user.avatarUrl,
                            },
                        },
                    ]
                }

                if (participantId === user?.id) {
                    return [
                        {
                            value: participantId,
                            label: user.name ?? user.email ?? participantId,
                            searchText:
                                `${user.name ?? ""} ${user.email ?? ""} ${participantId}`.trim(),
                            data: {
                                id: `local:${participantId}`,
                                userId: participantId,
                                name: user.name,
                                email: user.email,
                                avatarUrl: user.avatarUrl,
                            },
                        },
                    ]
                }

                return []
            }
        )
    }, [event?.participants, memberDirectory, user, watchedParticipantIds])
    const participantItems = useMemo<ParticipantOption[]>(
        () =>
            memberDirectory.map((member) => ({
                value: member.userId,
                label: member.name ?? member.email ?? member.userId,
                searchText:
                    `${member.name ?? ""} ${member.email ?? ""} ${member.userId}`.trim(),
                data: {
                    id: member.id,
                    userId: member.userId,
                    name: member.name,
                    email: member.email,
                    avatarUrl: member.avatarUrl,
                },
            })),
        [memberDirectory]
    )
    const categoryOptions = useMemo<CategoryOption[]>(() => {
        const optionMap = new Map<string, CategoryOption>()

        for (const option of categoryItems) {
            optionMap.set(option.value, option)
        }

        for (const option of selectedCategories) {
            if (!optionMap.has(option.value)) {
                optionMap.set(option.value, option)
            }
        }

        return Array.from(optionMap.values())
    }, [categoryItems, selectedCategories])
    const participantOptions = useMemo<ParticipantOption[]>(() => {
        const optionMap = new Map<string, ParticipantOption>()

        for (const option of participantItems) {
            optionMap.set(option.value, option)
        }

        for (const option of selectedParticipants) {
            if (!optionMap.has(option.value)) {
                optionMap.set(option.value, option)
            }
        }

        return Array.from(optionMap.values())
    }, [participantItems, selectedParticipants])
    const statusValue = watchedStatus ? [watchedStatus] : []
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    )
    const orderedFields = useMemo(
        () =>
            eventFieldSettings.items
                .map((item) => ({
                    ...item,
                    definition: calendarEventFieldDefinitions.find(
                        (field) => field.id === item.id
                    ),
                }))
                .filter(
                    (
                        item
                    ): item is (typeof eventFieldSettings.items)[number] & {
                        definition: (typeof calendarEventFieldDefinitions)[number]
                    } => Boolean(item.definition)
                ),
        [eventFieldSettings]
    )
    const hiddenFieldCount = useMemo(
        () =>
            orderedFields.filter(
                (field) =>
                    !isCalendarEventFieldVisible(eventFieldSettings, field.id)
            ).length,
        [eventFieldSettings, orderedFields]
    )

    const handleFieldVisibilityChange = useCallback(
        async (
            fieldId: (typeof orderedFields)[number]["id"],
            visible: boolean
        ) => {
            await saveEventFieldSettings(
                setCalendarEventFieldVisibility(
                    eventFieldSettings,
                    fieldId,
                    visible
                )
            )
        },
        [eventFieldSettings, saveEventFieldSettings]
    )

    const handleFieldDragEnd = useCallback(
        async (dragEvent: DragEndEvent) => {
            const activeId = String(dragEvent.active.id)
            const overId = dragEvent.over?.id ? String(dragEvent.over.id) : null

            if (!overId || activeId === overId) {
                return
            }

            await saveEventFieldSettings(
                moveCalendarEventFieldSettings(
                    eventFieldSettings,
                    activeId as (typeof orderedFields)[number]["id"],
                    overId as (typeof orderedFields)[number]["id"]
                )
            )
        },
        [eventFieldSettings, saveEventFieldSettings]
    )

    const getPropertyMenuItems = useCallback(
        (
            fieldId: (typeof orderedFields)[number]["id"]
        ): EventFormPropertyMenuItem[] => {
            switch (fieldId) {
                case "categories":
                    return [
                        {
                            type: "panel",
                            key: "edit-category-property",
                            label: "속성 편집",
                            icon: Settings2Icon,
                            content: (
                                <EventCategorySettingsPanel
                                    disabled={disabled}
                                />
                            ),
                            contentClassName: "w-auto",
                            disabled:
                                disabled ||
                                !activeCalendar?.id ||
                                activeCalendar.id === "demo",
                        },
                    ]
                default:
                    return []
            }
        },
        [activeCalendar?.id, disabled]
    )

    const renderPropertyField = (
        propertyField: (typeof orderedFields)[number]
    ) => {
        const Icon = eventFieldIconMap[propertyField.id]
        const isVisible = propertyField.visible !== false
        const visibility: EventFormPropertyVisibility = isVisible
            ? "visible"
            : "hidden"
        const handleVisibilityChange = (
            nextVisibility: EventFormPropertyVisibility
        ) => {
            void handleFieldVisibilityChange(
                propertyField.id,
                nextVisibility === "visible"
            )
        }
        const propertyMenuItems = getPropertyMenuItems(propertyField.id)

        if (propertyField.id === "schedule") {
            const start = scheduleStart ?? form.getValues("start")
            const end = scheduleEnd ?? form.getValues("end")
            const allDay = scheduleAllDay ?? false
            const scheduleModifiers = {
                ...getRangeModifiers(start, end),
                focused: [activeScheduleBoundary === "end" ? end : start],
            }

            const scheduleInputClassName =
                "h-9 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0"
            const scheduleFieldBlockClassName =
                "flex min-w-0 items-center gap-2 rounded-lg border border-input/70 bg-background px-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/20"
            const scheduleRowClassName = "flex items-center gap-2"
            const scheduleRange = {
                from: start,
                to: end,
            }

            return (
                <EventFormPropertyRow
                    key={propertyField.id}
                    fieldId={propertyField.id}
                    label={propertyField.definition.label}
                    icon={Icon}
                    disabled={disabled}
                    visibility={visibility}
                    onVisibilityChange={handleVisibilityChange}
                    propertyMenuItems={propertyMenuItems}
                >
                    <Popover
                        open={isSchedulePopoverOpen && !disabled}
                        onOpenChange={handleSchedulePopoverOpenChange}
                    >
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                disabled={disabled}
                                className="h-auto w-full justify-start px-1.5 py-1 text-left text-sm font-normal hover:bg-muted/50"
                            >
                                {formatScheduleTriggerLabel({
                                    start,
                                    end,
                                    allDay,
                                })}
                            </Button>
                        </PopoverTrigger>

                        <PopoverContent
                            className="w-58 overflow-hidden p-0"
                            align="start"
                            alignOffset={4}
                        >
                            <div className="p-2 dark:bg-muted">
                                {allDay ? (
                                    <div className="flex gap-2">
                                        {(["start", "end"] as const).map(
                                            (boundary) => {
                                                const value =
                                                    boundary === "start"
                                                        ? start
                                                        : end

                                                return (
                                                    <div
                                                        key={boundary}
                                                        className="flex min-w-0 flex-1 flex-col gap-1.5"
                                                    >
                                                        <span className="px-0.5 text-xs font-medium text-muted-foreground">
                                                            {boundary ===
                                                            "start"
                                                                ? "시작일"
                                                                : "종료일"}
                                                        </span>
                                                        <div
                                                            className={
                                                                scheduleFieldBlockClassName
                                                            }
                                                        >
                                                            <Input
                                                                type="text"
                                                                inputMode="numeric"
                                                                placeholder="26.04.23"
                                                                value={formatDateInputValue(
                                                                    value
                                                                )}
                                                                aria-label={
                                                                    boundary ===
                                                                    "start"
                                                                        ? "시작 날짜"
                                                                        : "종료 날짜"
                                                                }
                                                                disabled={
                                                                    disabled
                                                                }
                                                                className={
                                                                    scheduleInputClassName
                                                                }
                                                                ref={withMask(
                                                                    "99.99.99"
                                                                )}
                                                                onFocus={() =>
                                                                    focusScheduleBoundary(
                                                                        boundary
                                                                    )
                                                                }
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    handleScheduleDateChange(
                                                                        boundary,
                                                                        event
                                                                            .target
                                                                            .value
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            }
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {(["start", "end"] as const).map(
                                            (boundary) => {
                                                const value =
                                                    boundary === "start"
                                                        ? start
                                                        : end

                                                return (
                                                    <div
                                                        key={boundary}
                                                        className="space-y-1.5"
                                                    >
                                                        <span className="px-0.5 text-xs font-medium text-muted-foreground">
                                                            {boundary ===
                                                            "start"
                                                                ? "시작일"
                                                                : "종료일"}
                                                        </span>
                                                        <div
                                                            className={
                                                                scheduleRowClassName
                                                            }
                                                        >
                                                            <div
                                                                className={`${scheduleFieldBlockClassName} flex-1`}
                                                            >
                                                                <Input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    placeholder="26.04.23"
                                                                    value={formatDateInputValue(
                                                                        value
                                                                    )}
                                                                    aria-label={
                                                                        boundary ===
                                                                        "start"
                                                                            ? "시작 날짜"
                                                                            : "종료 날짜"
                                                                    }
                                                                    disabled={
                                                                        disabled
                                                                    }
                                                                    className={
                                                                        scheduleInputClassName
                                                                    }
                                                                    ref={withMask(
                                                                        "99.99.99"
                                                                    )}
                                                                    onFocus={() =>
                                                                        focusScheduleBoundary(
                                                                            boundary
                                                                        )
                                                                    }
                                                                    onChange={(
                                                                        event
                                                                    ) =>
                                                                        handleScheduleDateChange(
                                                                            boundary,
                                                                            event
                                                                                .target
                                                                                .value
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                            <div
                                                                className={`${scheduleFieldBlockClassName} flex-1`}
                                                            >
                                                                <Input
                                                                    type="time"
                                                                    step={60}
                                                                    value={formatTimeInputValue(
                                                                        value
                                                                    )}
                                                                    aria-label={
                                                                        boundary ===
                                                                        "start"
                                                                            ? "시작 시간"
                                                                            : "종료 시간"
                                                                    }
                                                                    disabled={
                                                                        disabled
                                                                    }
                                                                    className={
                                                                        `${scheduleInputClassName} appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none`
                                                                    }
                                                                    onFocus={() =>
                                                                        focusScheduleBoundary(
                                                                            boundary
                                                                        )
                                                                    }
                                                                    onChange={(
                                                                        event
                                                                    ) =>
                                                                        handleScheduleTimeChange(
                                                                            boundary,
                                                                            event
                                                                                .target
                                                                                .value
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            }
                                        )}
                                    </div>
                                )}

                                <CalendarPicker
                                    className="-mx-1 dark:bg-muted p-0 w-full max-w-full mx-auto"
                                    mode="range"
                                    month={schedulePickerMonth}
                                    onMonthChange={setSchedulePickerMonth}
                                    selected={scheduleRange}
                                    modifiers={scheduleModifiers}
                                    onSelect={handleScheduleRangeSelect}
                                />
                                <Separator className="-mx-3 w-auto" />
                                <div className="flex items-center justify-between px-0.5">
                                    <span className="text-sm font-medium">
                                        하루종일
                                    </span>
                                    <Switch
                                        size="sm"
                                        checked={allDay}
                                        disabled={disabled}
                                        aria-label="하루종일 일정"
                                        onCheckedChange={handleAllDayToggle}
                                    />
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </EventFormPropertyRow>
            )
        }

        if (propertyField.id === "participants") {
            return (
                <Controller
                    key={propertyField.id}
                    name="participantIds"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <div data-invalid={fieldState.invalid}>
                            <EventFormPropertyRow
                                fieldId={propertyField.id}
                                label={propertyField.definition.label}
                                icon={Icon}
                                disabled={disabled}
                                visibility={visibility}
                                onVisibilityChange={handleVisibilityChange}
                                propertyMenuItems={propertyMenuItems}
                            >
                                <div className="flex w-full flex-wrap justify-start gap-1.5">
                                    <EventChipsCombobox
                                        portalContainer={portalContainer}
                                        disabled={disabled}
                                        options={participantOptions}
                                        value={normalizeIds(field.value ?? [])}
                                        emptyText="표시할 멤버가 없습니다."
                                        onValueChange={(values) => {
                                            const nextParticipantIds =
                                                normalizeIds(values)

                                            field.onChange(nextParticipantIds)
                                            void saveNow({
                                                ...form.getValues(),
                                                participantIds:
                                                    nextParticipantIds,
                                            })
                                        }}
                                        invalid={fieldState.invalid}
                                        placeholder="멤버 선택"
                                        chipClassName="px-1.5 h-6.5 text-sm leading-normal gap-1 pr-0"
                                        renderChipContent={(participant) => (
                                            <HoverCard
                                                openDelay={10}
                                                closeDelay={100}
                                            >
                                                <HoverCardTrigger className="flex cursor-default items-center gap-1.25 rounded-full text-sm select-none">
                                                    <Avatar className="size-4.5">
                                                        <AvatarImage
                                                            src={
                                                                participant.data
                                                                    ?.avatarUrl ??
                                                                undefined
                                                            }
                                                            alt={
                                                                participant.data
                                                                    ?.name ??
                                                                "참가자"
                                                            }
                                                        />
                                                        <AvatarFallback className="text-xs">
                                                            {participant.data?.name?.[0]?.toUpperCase() ??
                                                                "?"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    {participant.label}
                                                </HoverCardTrigger>
                                                <HoverCardContent
                                                    className="flex w-auto items-center gap-2 overflow-hidden shadow-sm"
                                                    align="start"
                                                    alignOffset={-4}
                                                    sideOffset={7}
                                                >
                                                    <Avatar className="shrink-0">
                                                        <AvatarImage
                                                            src={
                                                                participant.data
                                                                    ?.avatarUrl ||
                                                                undefined
                                                            }
                                                            alt={
                                                                participant.data
                                                                    ?.name ||
                                                                "사용자"
                                                            }
                                                        />
                                                        <AvatarFallback className="text-sm">
                                                            {participant.data?.name?.[0]?.toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-1 flex-col gap-1 overflow-hidden text-start">
                                                        <div className="flex flex-1 items-center gap-1">
                                                            <span className="flex-initial truncate text-sm font-medium tracking-tight [word-spacing:-1px]">
                                                                {
                                                                    participant
                                                                        .data
                                                                        ?.name
                                                                }
                                                            </span>
                                                            {user?.id ===
                                                            participant?.data
                                                                ?.userId ? (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="shrink-0 px-1.75 leading-normal"
                                                                >
                                                                    나
                                                                </Badge>
                                                            ) : null}
                                                        </div>
                                                        <div className="truncate text-xs text-muted-foreground">
                                                            {
                                                                participant
                                                                    ?.data
                                                                    ?.email
                                                            }
                                                        </div>
                                                    </div>
                                                </HoverCardContent>
                                            </HoverCard>
                                        )}
                                        renderItemContent={(participant) => (
                                            <div className="flex min-w-0 items-center gap-2">
                                                <Avatar className="size-6">
                                                    <AvatarImage
                                                        src={
                                                            participant.data
                                                                ?.avatarUrl ??
                                                            undefined
                                                        }
                                                        alt={
                                                            participant.data
                                                                ?.name ?? "멤버"
                                                        }
                                                    />
                                                    <AvatarFallback className="text-xs">
                                                        {participant.data?.name?.[0]?.toUpperCase() ??
                                                            "?"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <div className="truncate">
                                                        {participant.data
                                                            ?.name ??
                                                            "이름 없음"}
                                                    </div>
                                                    <div className="truncate text-xs text-muted-foreground">
                                                        {participant.data
                                                            ?.email ??
                                                            participant.value}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    />
                                </div>
                                {fieldState.invalid ? (
                                    <FieldError errors={[fieldState.error]} />
                                ) : null}
                            </EventFormPropertyRow>
                        </div>
                    )}
                />
            )
        }

        if (propertyField.id === "categories") {
            return (
                <Controller
                    key={propertyField.id}
                    name="categoryNames"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <div data-invalid={fieldState.invalid}>
                            <EventFormPropertyRow
                                fieldId={propertyField.id}
                                label={propertyField.definition.label}
                                icon={Icon}
                                disabled={disabled}
                                visibility={visibility}
                                onVisibilityChange={handleVisibilityChange}
                                propertyMenuItems={propertyMenuItems}
                                propertyMenuItemsPlacement="before-common"
                            >
                                <div className="flex flex-col gap-2">
                                    <EventChipsCombobox
                                        portalContainer={portalContainer}
                                        disabled={disabled}
                                        options={categoryOptions}
                                        value={normalizeNames(
                                            field.value ?? []
                                        )}
                                        emptyText="카테고리를 입력해 생성할 수 있습니다."
                                        onValueChange={(values) => {
                                            const nextCategoryNames =
                                                normalizeNames(values)

                                            field.onChange(nextCategoryNames)
                                            void saveNow({
                                                ...form.getValues(),
                                                categoryNames:
                                                    nextCategoryNames,
                                            })
                                        }}
                                        invalid={fieldState.invalid}
                                        placeholder="카테고리 추가"
                                        chipClassName={(category) =>
                                            getCalendarCategoryLabelClassName(
                                                category.color,
                                                "h-6 gap-0 [&_button]:hover:bg-transparent leading-normal"
                                            )
                                        }
                                        renderChipContent={(category) => (
                                            <span className="inline-flex h-6.5 items-center gap-1.5 text-sm">
                                                {category.label}
                                            </span>
                                        )}
                                        renderItemContent={(category) => (
                                            <span className="inline-flex items-center gap-2">
                                                <span
                                                    className={getCalendarCategoryLabelClassName(
                                                        category.color,
                                                        "inline-flex h-6.5 items-center gap-1.5 rounded-md px-1.5 text-sm leading-normal"
                                                    )}
                                                >
                                                    {category.label}
                                                </span>
                                                {category.isCreate
                                                    ? "새 카테고리 생성"
                                                    : null}
                                            </span>
                                        )}
                                        createOptionFromQuery={(query) =>
                                            query
                                                ? {
                                                      value: query,
                                                      label: query,
                                                      color: getDraftCategoryColor(
                                                          query
                                                      ),
                                                      isCreate: true,
                                                  }
                                                : null
                                        }
                                    />
                                    {fieldState.invalid ? (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    ) : null}
                                </div>
                            </EventFormPropertyRow>
                        </div>
                    )}
                />
            )
        }

        if (propertyField.id === "status") {
            return (
                <Controller
                    key={propertyField.id}
                    name="status"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <div data-invalid={fieldState.invalid}>
                            <EventFormPropertyRow
                                fieldId={propertyField.id}
                                label={propertyField.definition.label}
                                icon={Icon}
                                disabled={disabled}
                                visibility={visibility}
                                onVisibilityChange={handleVisibilityChange}
                                propertyMenuItems={propertyMenuItems}
                            >
                                <div className="flex w-full flex-wrap justify-start gap-1.5">
                                    <EventChipsCombobox
                                        portalContainer={portalContainer}
                                        disabled={disabled}
                                        options={statusItems.map((status) => ({
                                            value: status.value,
                                            label: status.label,
                                        }))}
                                        value={statusValue}
                                        emptyText="No items found."
                                        onValueChange={(values) => {
                                            const last =
                                                values[values.length - 1]

                                            if (!last) {
                                                return
                                            }

                                            const nextStatus =
                                                last as StatusOption["value"]

                                            field.onChange(nextStatus)
                                            void saveNow({
                                                ...form.getValues(),
                                                status: nextStatus,
                                            })
                                        }}
                                        closeOnSelect
                                        showRemove={false}
                                        renderChipContent={(status) => (
                                            <span className="inline-flex items-center gap-1.5">
                                                <span
                                                    className={[
                                                        statusDotClassNameMap[
                                                            status.value as StatusOption["value"]
                                                        ],
                                                        "size-2 rounded-full",
                                                    ].join(" ")}
                                                />
                                                {status.label}
                                            </span>
                                        )}
                                        renderItemContent={(status) => (
                                            <span
                                                className={[
                                                    statusItemClassNameMap[
                                                        status.value as StatusOption["value"]
                                                    ],
                                                    "inline-flex h-6.5 items-center gap-1.5 text-sm",
                                                ].join(" ")}
                                            >
                                                <span
                                                    className={[
                                                        statusDotClassNameMap[
                                                            status.value as StatusOption["value"]
                                                        ],
                                                        "inline-block size-2 rounded-full",
                                                    ].join(" ")}
                                                />
                                                {status.label}
                                            </span>
                                        )}
                                        chipClassName={(status) =>
                                            [
                                                "flex h-full items-center gap-1.5 rounded-full px-2.5! pr-2.75! text-sm",
                                                statusLabelClassNameMap[
                                                    status.value as StatusOption["value"]
                                                ],
                                            ].join(" ")
                                        }
                                    />
                                </div>
                            </EventFormPropertyRow>
                        </div>
                    )}
                />
            )
        }

        if (propertyField.id === "recurrence") {
            return (
                <EventFormRecurrenceField
                    key={propertyField.id}
                    control={form.control}
                    disabled={disabled}
                    label={propertyField.definition.label}
                    icon={Icon}
                    visibility={visibility}
                    onVisibilityChange={handleVisibilityChange}
                    propertyMenuItems={propertyMenuItems}
                    watchedStart={watchedStart ?? new Date()}
                    watchedTimezone={watchedTimezone}
                    onRecurrenceChange={(nextRecurrence) => {
                        void saveNow({
                            ...form.getValues(),
                            recurrence: nextRecurrence,
                        })
                    }}
                />
            )
        }

        if (propertyField.id === "exceptions") {
            return (
                <Controller
                    key={propertyField.id}
                    name="exceptions"
                    control={form.control}
                    render={({ field }) => (
                        <EventFormPropertyRow
                            fieldId={propertyField.id}
                            label={propertyField.definition.label}
                            icon={Icon}
                            disabled={disabled}
                            visibility={visibility}
                            onVisibilityChange={handleVisibilityChange}
                            propertyMenuItems={propertyMenuItems}
                        >
                            <div className="flex min-h-9 items-center px-1.5 text-sm text-muted-foreground">
                                {field.value?.length
                                    ? `제외 날짜 ${field.value.length}개`
                                    : "설정된 제외 날짜가 없습니다."}
                            </div>
                        </EventFormPropertyRow>
                    )}
                />
            )
        }

        if (propertyField.id === "timezone") {
            return (
                <Controller
                    key={propertyField.id}
                    name="timezone"
                    control={form.control}
                    render={({ field }) => (
                        <EventFormPropertyRow
                            fieldId={propertyField.id}
                            label={propertyField.definition.label}
                            icon={Icon}
                            disabled={disabled}
                            visibility={visibility}
                            onVisibilityChange={handleVisibilityChange}
                            propertyMenuItems={propertyMenuItems}
                        >
                            <TimezoneSelect
                                icon={false}
                                alignOffset={0}
                                value={field.value}
                                contentClassName="w-(--anchor-width) min-w-full"
                                portalContainer={portalContainer}
                                className="w-full cursor-pointer bg-input/10 py-0.75 not-focus-within:border-transparent! not-focus-within:bg-transparent! [&_button]:hidden [&_input]:px-1.5"
                                disabled={disabled}
                                onChange={(timezone) => {
                                    field.onChange(timezone)
                                    void saveNow({
                                        ...form.getValues(),
                                        timezone,
                                    })
                                }}
                            />
                        </EventFormPropertyRow>
                    )}
                />
            )
        }

        return null
    }

    const renderSortablePropertyField = (
        propertyField: (typeof orderedFields)[number]
    ) => {
        const content = renderPropertyField(propertyField)

        if (!content) {
            return null
        }

        if (propertyField.visible !== false) {
            return content
        }

        return (
            <CollapsibleContent
                key={propertyField.id}
                className="space-y-0"
                forceMount
                hidden={!areHiddenFieldsOpen}
            >
                {content}
            </CollapsibleContent>
        )
    }

    return (
        <form
            data-modal={modal ? "true" : "false"}
            className="flex flex-col gap-6"
            onSubmit={(e) => e.preventDefault()}
        >
            <FieldGroup className="gap-7">
                {/* 제목 */}
                <Controller
                    name="title"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            {/* <FieldLabel>제목</FieldLabel> */}
                            <input
                                {...field}
                                placeholder="새 일정"
                                autoFocus
                                onChange={(e) => {
                                    if (disabled) {
                                        return
                                    }

                                    field.onChange(e.target.value)
                                    autoSave()
                                }}
                                className="h-auto w-full border-0 bg-transparent p-0 font-bold text-primary outline-0 placeholder:text-muted-foreground/70 md:text-4xl"
                                disabled={disabled}
                            />
                            {/* <Input
                                {...field}
                                autoFocus={true}
                                placeholder="새 일정"
                                className="h-auto border-0 p-0 font-bold not-focus:hover:bg-muted/60 md:text-4xl"
                                onChange={(e) => {
                                    field.onChange(e)
                                    autoSave()
                                }}
                            /> */}
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Collapsible
                    open={areHiddenFieldsOpen}
                    onOpenChange={setAreHiddenFieldsOpen}
                    className="flex flex-col gap-3"
                >
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        modifiers={[restrictToVerticalAxis]}
                        onDragEnd={(dragEvent) => {
                            void handleFieldDragEnd(dragEvent)
                        }}
                    >
                        <SortableContext
                            disabled={disabled}
                            items={orderedFields.map(
                                (propertyField) => propertyField.id
                            )}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="flex flex-col gap-3">
                                {orderedFields.map(renderSortablePropertyField)}
                            </div>
                        </SortableContext>
                    </DndContext>
                    {hiddenFieldCount > 0 ? (
                        <CollapsibleTrigger
                            className="w-auto self-start"
                            asChild
                        >
                            <Button
                                variant="ghost"
                                size="sm"
                                className="group justify-center pl-1.5 leading-normal text-muted-foreground! not-hover:aria-expanded:bg-transparent md:w-32.5"
                            >
                                <ChevronDownIcon className="group-data-[state=open]:rotate-180" />
                                속성 {hiddenFieldCount}개{" "}
                                <span className="group-data-[state=open]:hidden">
                                    더 보기
                                </span>
                                <span className="hidden group-data-[state=open]:inline">
                                    숨기기
                                </span>
                            </Button>
                        </CollapsibleTrigger>
                    ) : null}
                </Collapsible>

                <Separator />

                <Controller
                    name="content"
                    control={form.control}
                    render={({ field }) => (
                        <Field>
                            {modal ? (
                                <ContentEditor
                                    value={field.value}
                                    editable={!disabled}
                                    updatedAt={event?.updatedAt}
                                    updatedById={event?.updatedById}
                                    currentUserId={user?.id ?? null}
                                    onChange={(val: EditorContent) => {
                                        if (disabled) return
                                        field.onChange(val)
                                        autoSave()
                                    }}
                                    members={memberDirectoryState.members}
                                />
                            ) : (
                                <ContentEditorCSR
                                    value={field.value}
                                    editable={!disabled}
                                    updatedAt={event?.updatedAt}
                                    updatedById={event?.updatedById}
                                    currentUserId={user?.id ?? null}
                                    onChange={(val: EditorContent) => {
                                        if (disabled) return
                                        field.onChange(val)
                                        autoSave()
                                    }}
                                    members={memberDirectoryState.members}
                                />
                            )}
                        </Field>
                    )}
                />
            </FieldGroup>
        </form>
    )
}
