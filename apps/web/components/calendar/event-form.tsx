"use client"

import {
    getDefaultNewEventTimedSchedule,
    getTimedScheduleRangeAfterAllDayOff,
} from "@/lib/calendar/default-timed-schedule"
import {
    normalizeCollectionName,
    normalizeNames,
} from "@/lib/calendar/event-form-names"
import { isGeneratedSubscriptionEventId } from "@/lib/calendar/event-id"
import { buildEventCollectionsAssignmentPatch } from "@/lib/calendar/event-property-collection-patch"
import { createCalendarEventCollection } from "@/lib/calendar/mutations"
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
    XIcon,
} from "lucide-react"
import type { DateRange } from "react-day-picker"
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form"

import { useEventFormDraftCollectionColor } from "@/hooks/use-event-form-draft-collection-color"
import {
    makeGoogleCalendarEventId,
    parseGoogleCalendarEventId,
} from "@/lib/google/calendar-event-mapper"
import { EventChipsCombobox } from "./event-chips-combobox"
import { EventCollectionSettingsPanel } from "./event-collection-settings-panel"
import {
    EventFormCollectionChipsField,
    isGoogleCollectionOptionValue,
    makeGoogleCollectionOptionValue,
    parseGoogleCollectionOptionValue,
} from "./event-form-collection-field"
import {
    EventFormPropertyRow,
    type EventFormPropertyMenuItem,
    type EventFormPropertyVisibility,
} from "./event-form-property-row"
import { EventFormRecurrenceField } from "./event-form-recurrence-field"
import { EventFormStatusChipsField } from "./event-form-status-field"
import { eventFormSchema, type EventFormValues } from "./event-form.schema"
import { TimezoneSelect } from "./timezone-select"

import { Button } from "@workspace/ui/components/button"
import { Field, FieldError, FieldGroup } from "@workspace/ui/components/field"

import { CalendarPicker } from "@workspace/ui/components/calendar-picker"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@workspace/ui/components/popover"

import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { useCalendarEventFieldSettings } from "@/hooks/use-calendar-event-field-settings"
import { formatCalendarEventScheduleLabel } from "@/lib/calendar/event-date-format"
import {
    getCalendarEventFieldDefinitions,
    isCalendarEventFieldVisible,
    moveCalendarEventFieldSettings,
    setCalendarEventFieldVisibility,
} from "@/lib/calendar/event-field-settings"
import { navigateCalendarModal } from "@/lib/calendar/modal-navigation"
import { getCalendarModalOpenPath } from "@/lib/calendar/modal-route"
import { type Locale } from "@/lib/i18n/config"
import { getDayPickerLocale } from "@/lib/i18n/day-picker-locale"
import { formatIntlDate } from "@/lib/i18n/intl-date"
import {
    defaultContent,
    eventStatus,
    type CalendarEvent,
    type CalendarEventCollection,
    type CalendarEventParticipant,
    type CalendarEventPatch,
    type CalendarSubscriptionCatalogItem,
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
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
} from "@workspace/ui/components/sidebar"
import { Switch } from "@workspace/ui/components/switch"
import { useLocale } from "next-intl"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import ContentEditor from "../editor/content-editor"
import {
    WheelPicker,
    WheelPickerOption,
    WheelPickerWrapper,
} from "../wheel-picker"
import { EventSubscriptionCard } from "./event-subscription-card"

const createArray = (length: number, add = 0): WheelPickerOption<number>[] =>
    Array.from({ length }, (_, i) => {
        const value = i + add
        return {
            label: value.toString().padStart(2, "0"),
            value: value,
        }
    })

const hourOptions = createArray(12, 1)
const minuteOptions = createArray(60)
const meridiemOptions: WheelPickerOption<"am" | "pm">[] = [
    { label: "AM", value: "am" },
    { label: "PM", value: "pm" },
]

const ContentEditorCSR = dynamic(() => import("../editor/content-editor"), {
    ssr: false,
})

const eventFieldIconMap = {
    schedule: CalendarRangeIcon,
    participants: UsersIcon,
    collections: TagsIcon,
    status: CircleCheckBigIcon,
    recurrence: Repeat2Icon,
    exceptions: ClockAlertIcon,
    timezone: EarthIcon,
    place: MapPinIcon,
    notification: BellIcon,
} as const

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

function normalizeIds(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)))
}

type ScheduleBoundary = "start" | "end"
type SchedulePickerPanel = "date" | "time"
type ScheduleChangeKind = "date" | "time"
type WheelTimeValue = ReturnType<typeof getMeridiemHourMinute>

const MINIMUM_END_MINUTES = 5
const START_BOUNDARY_FALLBACK_HOURS = 1
const WHEEL_COMMIT_DELAY_MS = 500

function toMinuteOfDay(value: WheelTimeValue) {
    return toHour24(value.meridiem, value.hour12) * 60 + value.minute
}

function isWheelTimeAllowed({
    boundary,
    candidate,
    start,
    end,
    timezone,
}: {
    boundary: ScheduleBoundary
    candidate: WheelTimeValue
    start: Date
    end: Date
    timezone: string
}) {
    if (!isSameScheduleDay(start, end, timezone)) {
        return true
    }

    const startValue = getMeridiemHourMinute(start, timezone)
    const endValue = getMeridiemHourMinute(end, timezone)
    const candidateMinute = toMinuteOfDay(candidate)
    const startMinute = toMinuteOfDay(startValue)
    const endMinute = toMinuteOfDay(endValue)

    if (boundary === "start") {
        return candidateMinute < endMinute
    }

    return candidateMinute > startMinute
}

function isSameScheduleDay(start: Date, end: Date, timezone: string) {
    return dayjs(start).tz(timezone).isSame(dayjs(end).tz(timezone), "day")
}

function formatDateInputValue(date: Date, timezone: string) {
    return dayjs(date).tz(timezone).format("YYYY-MM-DD")
}

function formatEventFormDateLabel(
    date: Date | string,
    timezone: string,
    locale: Locale
) {
    return formatIntlDate(date, {
        locale,
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    })
}

function formatEventFormTimeLabel(
    date: Date | string,
    timezone: string,
    locale: Locale
) {
    return formatIntlDate(date, {
        locale,
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
    })
}

function getMeridiemHourMinute(
    date: Date,
    timezone: string
): {
    meridiem: "am" | "pm"
    hour12: number
    minute: number
} {
    const zoned = dayjs(date).tz(timezone)
    const hour24 = zoned.hour()
    const meridiem = hour24 < 12 ? "am" : "pm"
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12

    return {
        meridiem,
        hour12,
        minute: zoned.minute(),
    }
}

function toHour24(meridiem: "am" | "pm", hour12: number) {
    const normalizedHour = hour12 === 12 ? 0 : hour12
    return meridiem === "pm" ? normalizedHour + 12 : normalizedHour
}

function getMinimumEndDate(start: Date, timezone: string) {
    return dayjs(start).tz(timezone).add(MINIMUM_END_MINUTES, "minute").toDate()
}

function addScheduleTime(
    date: Date,
    amount: number,
    unit: "day" | "hour" | "minute",
    timezone: string
) {
    return dayjs(date)
        .tz(timezone)
        .add(amount, unit)
        .second(0)
        .millisecond(0)
        .toDate()
}

function setDateParts(baseDate: Date, value: string, timezone: string) {
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

    const zonedBaseDate = dayjs(baseDate).tz(timezone)
    const candidate = zonedBaseDate
        .year(year)
        .month(month - 1)
        .date(day)
        .second(0)
        .millisecond(0)
    const isValidDate =
        candidate.year() === year &&
        candidate.month() === month - 1 &&
        candidate.date() === day

    if (!isValidDate) {
        return baseDate
    }

    return candidate.toDate()
}

function setTimeParts(baseDate: Date, value: string, timezone: string) {
    const [hour = NaN, minute = NaN] = value.split(":").map(Number)

    if (Number.isNaN(hour) || Number.isNaN(minute)) {
        return baseDate
    }

    return dayjs(baseDate)
        .tz(timezone)
        .hour(hour)
        .minute(minute)
        .second(0)
        .millisecond(0)
        .toDate()
}

function normalizeTimedScheduleRange({
    start,
    end,
    changedBoundary,
    changeKind,
    timezone,
}: {
    start: Date
    end: Date
    changedBoundary: ScheduleBoundary
    changeKind: ScheduleChangeKind
    timezone: string
}) {
    if (start.getTime() <= end.getTime()) {
        return { start, end, didCoerce: false }
    }

    if (changedBoundary === "start") {
        if (changeKind === "time") {
            const previousDayStart = addScheduleTime(start, -1, "day", timezone)

            if (previousDayStart.getTime() <= end.getTime()) {
                return {
                    start: previousDayStart,
                    end,
                    didCoerce: true,
                }
            }
        }

        return {
            start: addScheduleTime(
                end,
                -START_BOUNDARY_FALLBACK_HOURS,
                "hour",
                timezone
            ),
            end,
            didCoerce: true,
        }
    }

    if (changeKind === "time") {
        const nextDayEnd = addScheduleTime(end, 1, "day", timezone)

        if (nextDayEnd.getTime() >= start.getTime()) {
            return {
                start,
                end: nextDayEnd,
                didCoerce: true,
            }
        }
    }

    return {
        start,
        end: getMinimumEndDate(start, timezone),
        didCoerce: true,
    }
}

function getRangeModifiers(start: Date, end: Date, timezone: string) {
    if (isSameScheduleDay(start, end, timezone)) {
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

function formatExceptionDateTagLabel(
    exceptionDateIso: string,
    timezone: string,
    locale: Locale
) {
    const parsed = dayjs(exceptionDateIso).tz(timezone)

    if (!parsed.isValid()) {
        return exceptionDateIso
    }

    return formatIntlDate(parsed.toDate(), {
        locale,
        timeZone: timezone,
        year: "2-digit",
        month: "numeric",
        day: "numeric",
    })
}

function normalizeAllDaySchedule(start: Date, end: Date, timezone: string) {
    const normalizedStart = dayjs(start).tz(timezone).startOf("day")
    const normalizedEnd = dayjs(end).tz(timezone).endOf("day")
    const safeEnd = normalizedEnd.isBefore(normalizedStart)
        ? normalizedStart.endOf("day")
        : normalizedEnd

    return {
        start: normalizedStart.toDate(),
        end: safeEnd.toDate(),
    }
}

function preserveDateTimeInTimezone(
    date: Date,
    fromTimezone: string,
    toTimezone: string
) {
    if (fromTimezone === toTimezone) {
        return new Date(date)
    }

    const localDateTime = dayjs(date)
        .tz(fromTimezone)
        .format("YYYY-MM-DDTHH:mm:ss.SSS")

    return dayjs.tz(localDateTime, toTimezone).toDate()
}

function normalizeValuesForPersistence(
    values: EventFormValues
): EventFormValues {
    if (!values.allDay) {
        return values
    }

    const normalized = normalizeAllDaySchedule(
        values.start,
        values.end,
        values.timezone || "Asia/Seoul"
    )
    return {
        ...values,
        start: normalized.start,
        end: normalized.end,
    }
}

const ScheduleTimeWheelPicker = memo(function ScheduleTimeWheelPicker({
    value,
    disabled,
    meridiemOptions,
    hourOptions,
    minuteOptions,
    onCommit,
}: {
    value: WheelTimeValue
    disabled?: boolean
    meridiemOptions: WheelPickerOption<"am" | "pm">[]
    hourOptions: WheelPickerOption<number>[]
    minuteOptions: WheelPickerOption<number>[]
    onCommit: (value: WheelTimeValue) => {
        value: WheelTimeValue
        locked: boolean
    }
}) {
    const [draft, setDraft] = useState<WheelTimeValue>(value)
    const draftRef = useRef(value)
    const commitTimerRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        return () => {
            if (commitTimerRef.current) {
                clearTimeout(commitTimerRef.current)
            }
        }
    }, [])

    const queueCommit = useCallback(
        (nextDraft: WheelTimeValue) => {
            if (commitTimerRef.current) {
                clearTimeout(commitTimerRef.current)
            }

            commitTimerRef.current = setTimeout(() => {
                const result = onCommit(nextDraft)
                draftRef.current = result.value
                setDraft(result.value)
            }, WHEEL_COMMIT_DELAY_MS)
        },
        [onCommit]
    )

    const handlePartChange = useCallback(
        (nextPart: Partial<WheelTimeValue>) => {
            if (disabled) {
                return
            }

            const nextDraft = {
                ...draftRef.current,
                ...nextPart,
            }
            const isSameDraft =
                nextDraft.meridiem === draftRef.current.meridiem &&
                nextDraft.hour12 === draftRef.current.hour12 &&
                nextDraft.minute === draftRef.current.minute

            if (isSameDraft) {
                return
            }

            draftRef.current = nextDraft
            setDraft(nextDraft)
            queueCommit(nextDraft)
        },
        [disabled, queueCommit]
    )

    return (
        <div className="w-full">
            <WheelPickerWrapper
                className={`w-full border-0 p-0 shadow-none ${disabled ? "pointer-events-none opacity-80" : ""}`}
            >
                <WheelPicker
                    options={meridiemOptions}
                    value={draft.meridiem}
                    dragSensitivity={160}
                    scrollSensitivity={10}
                    onValueChange={(nextValue) => {
                        handlePartChange({
                            meridiem: nextValue as "am" | "pm",
                        })
                    }}
                />
                <WheelPicker
                    options={hourOptions}
                    value={draft.hour12}
                    dragSensitivity={160}
                    scrollSensitivity={10}
                    onValueChange={(nextValue) => {
                        handlePartChange({
                            hour12: nextValue as number,
                        })
                    }}
                />
                <WheelPicker
                    options={minuteOptions}
                    value={draft.minute}
                    dragSensitivity={160}
                    scrollSensitivity={10}
                    onValueChange={(nextValue) => {
                        handlePartChange({
                            minute: nextValue as number,
                        })
                    }}
                />
            </WheelPickerWrapper>
        </div>
    )
})

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

function getEventFormCollectionNames(event?: CalendarEvent) {
    if (!event) {
        return []
    }

    const parsedGoogleEvent = parseGoogleCalendarEventId(event.id)

    if (parsedGoogleEvent) {
        return [makeGoogleCollectionOptionValue(parsedGoogleEvent.catalogId)]
    }

    return event.collections.map((collection) => collection.name)
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
    const tForm = useDebugTranslations("event.form")
    const tCommonTime = useDebugTranslations("common.time")
    const tCommonLabels = useDebugTranslations("common.labels")
    const tField = useDebugTranslations("event.fieldDefinition")
    const locale = useLocale() as Locale
    const pathname = usePathname()
    const calendarEventFieldDefinitions = useMemo(
        () => getCalendarEventFieldDefinitions(tField),
        [tField]
    )
    const localizedMeridiemOptions = useMemo(
        () => [
            { label: tCommonTime("am"), value: "am" as const },
            { label: tCommonTime("pm"), value: "pm" as const },
        ],
        [tCommonTime]
    )
    const user = useAuthStore((a) => a.user)
    const calendarTimezone = useCalendarStore((s) => s.calendarTimezone)
    const defaultParticipantIds = useMemo(
        () => getDefaultParticipantIds({ event, currentUserId: user?.id }),
        [event, user?.id]
    )
    const createEvent = useCalendarStore((s) => s.createEvent)
    const setActiveEventId = useCalendarStore((s) => s.setActiveEventId)
    const setViewEvent = useCalendarStore((s) => s.setViewEvent)

    const form = useForm<EventFormValues>({
        resolver: zodResolver(eventFormSchema) as Resolver<EventFormValues>,
        defaultValues: event
            ? {
                  title: event.title,
                  content: event.content,
                  start: new Date(event.start),
                  end: new Date(event.end),
                  timezone: event.timezone || calendarTimezone || "Asia/Seoul",
                  collectionNames: getEventFormCollectionNames(event),
                  participantIds: defaultParticipantIds,
                  allDay: event.allDay ?? false,
                  recurrence: event.recurrence,
                  exceptions: event.exceptions,
                  status: event.status,
              }
            : (() => {
                  const tz = calendarTimezone || "Asia/Seoul"
                  const { start, end } = getDefaultNewEventTimedSchedule(tz)

                  return {
                      title: "",
                      content: defaultContent,
                      start,
                      end,
                      timezone: tz,
                      collectionNames: [],
                      participantIds: defaultParticipantIds,
                      allDay: false,
                      status: eventStatus[0],
                  }
              })(),
    })

    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const eventCollections = useCalendarStore((s) => s.eventCollections)
    const upsertEventCollectionSnapshot = useCalendarStore(
        (s) => s.upsertEventCollectionSnapshot
    )
    const installedGoogleCalendarCatalogs = useCalendarStore((s) =>
        s.subscriptionCatalogs.filter(
            (c) =>
                c.sourceType === "google_calendar" &&
                s.subscriptionState.installedSubscriptionIds.includes(c.id)
        )
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
    const wasBootstrappedWithEventRef = useRef(Boolean(event))
    const initializedEventIdRef = useRef<string | null>(null)
    const lastAppliedUpdatedAtRef = useRef<number | null>(null)
    const [isSchedulePopoverOpen, setIsSchedulePopoverOpen] = useState(false)
    const [activeScheduleBoundary, setActiveScheduleBoundary] =
        useState<ScheduleBoundary>("start")
    const [schedulePickerPanel, setSchedulePickerPanel] =
        useState<SchedulePickerPanel>("date")
    const [pendingScheduleRange, setPendingScheduleRange] = useState<
        DateRange | undefined
    >(undefined)
    const scheduleSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
    const hasPendingScheduleSaveRef = useRef(false)
    const [schedulePickerMonth, setSchedulePickerMonth] = useState<Date>(() =>
        form.getValues("start")
    )
    const [scheduleStart, scheduleEnd, scheduleAllDay] = useWatch({
        control: form.control,
        name: ["start", "end", "allDay"],
    })
    const watchedExceptions = useWatch({
        control: form.control,
        name: "exceptions",
    })

    const getDraftCollectionColorBase = useEventFormDraftCollectionColor(
        eventCollections,
        event?.collections.map((collection) => ({
            name: collection.name,
            color: collection.options.color,
        }))
    )
    const eventCollectionColorMap = useMemo(() => {
        const map = new Map<
            string,
            NonNullable<CalendarEvent["primaryCollection"]>["options"]["color"]
        >()

        for (const collection of event?.collections ?? []) {
            map.set(
                normalizeCollectionName(collection.name),
                collection.options.color
            )
        }

        return map
    }, [event?.collections])
    const getDraftCollectionColor = useCallback(
        (name: string) => {
            const matchedEventColor = eventCollectionColorMap.get(
                normalizeCollectionName(name)
            )

            return matchedEventColor ?? getDraftCollectionColorBase(name)
        },
        [eventCollectionColorMap, getDraftCollectionColorBase]
    )
    const isSystemSubscriptionEventForm = Boolean(
        event?.id && isGeneratedSubscriptionEventId(event.id)
    )
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
                timezone:
                    targetEvent.timezone || calendarTimezone || "Asia/Seoul",
                collectionNames: getEventFormCollectionNames(targetEvent),
                participantIds: getDefaultParticipantIds({
                    event: targetEvent,
                    currentUserId: user?.id,
                }),
                allDay: targetEvent.allDay ?? false,
                recurrence: targetEvent.recurrence,
                exceptions: targetEvent.exceptions,
                status: targetEvent.status,
            })
        },
        [calendarTimezone, form, user?.id]
    )

    const resolveParticipantsFromValues = useCallback(
        (
            sourceEvent: CalendarEvent,
            participantIds: string[]
        ): CalendarEventParticipant[] => {
            const nextParticipantIds = normalizeIds(participantIds)
            const memberMap = new Map(
                memberDirectory.map((member) => [member.userId, member])
            )

            return nextParticipantIds.flatMap(
                (participantId): CalendarEventParticipant[] => {
                    const sourceParticipant = sourceEvent.participants.find(
                        (participant) => participant.userId === participantId
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
        },
        [memberDirectory, user]
    )

    const buildCollectionsFromNames = useCallback(
        (
            collectionNames: string[],
            collectionSource: CalendarEventCollection[]
        ): CalendarEvent["collections"] => {
            const collectionMap = new Map(
                collectionSource.map((collection) => [
                    normalizeCollectionName(collection.name),
                    collection,
                ])
            )

            return normalizeNames(collectionNames).map((name) => {
                const matched = collectionMap.get(normalizeCollectionName(name))

                if (matched) {
                    return matched
                }

                return {
                    id: "",
                    calendarId: activeCalendar?.id ?? "",
                    name,
                    options: {
                        visibleByDefault: true,
                        color: getDraftCollectionColor(name),
                    },
                    createdById: user?.id ?? null,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                }
            })
        },
        [activeCalendar?.id, getDraftCollectionColor, user?.id]
    )

    const buildGoogleEventViewSnapshot = useCallback(
        ({
            sourceEvent,
            targetCatalog,
            targetGoogleEventId,
            values,
        }: {
            sourceEvent: CalendarEvent
            targetCatalog: CalendarSubscriptionCatalogItem
            targetGoogleEventId: string
            values: EventFormValues
        }): CalendarEvent => {
            const color =
                targetCatalog.collectionColor ??
                sourceEvent.primaryCollection?.options.color ??
                "blue"
            const collectionId = `collection.subscription.google.${targetCatalog.id}`
            const googleEmail =
                typeof targetCatalog.config?.googleEmail === "string"
                    ? targetCatalog.config.googleEmail
                    : (sourceEvent.subscription?.googleEmail ?? null)

            return {
                ...sourceEvent,
                id: makeGoogleCalendarEventId(
                    targetCatalog.id,
                    targetGoogleEventId
                ),
                title: values.title,
                content: values.content,
                start: values.start.getTime(),
                end: values.end.getTime(),
                allDay: values.allDay ?? false,
                timezone: values.timezone,
                recurrence: values.recurrence,
                exceptions: values.exceptions,
                status: values.status ?? sourceEvent.status,
                collections: [
                    {
                        id: collectionId,
                        calendarId: "subscriptions",
                        name: targetCatalog.name,
                        options: {
                            visibleByDefault: true,
                            color,
                        },
                        createdById: null,
                        createdAt: 0,
                        updatedAt: 0,
                    },
                ],
                collectionIds: [collectionId],
                primaryCollectionId: collectionId,
                primaryCollection: {
                    id: collectionId,
                    calendarId: "subscriptions",
                    name: targetCatalog.name,
                    options: {
                        visibleByDefault: true,
                        color,
                    },
                    createdById: null,
                    createdAt: 0,
                    updatedAt: 0,
                },
                participants: resolveParticipantsFromValues(
                    sourceEvent,
                    values.participantIds
                ),
                subscription: {
                    id: targetCatalog.id,
                    name: targetCatalog.name,
                    sourceType: "google_calendar",
                    authority: "user",
                    providerName: "Google Calendar",
                    calendar: null,
                    googleEmail,
                },
                updatedAt: Date.now(),
            }
        },
        [resolveParticipantsFromValues]
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
            collectionSource = eventCollections
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

            const collectionPatch = buildEventCollectionsAssignmentPatch(
                sourceEvent,
                values.collectionNames,
                collectionSource,
                getDraftCollectionColor,
                activeCalendar?.id ?? ""
            )

            if (collectionPatch) {
                patch.collections = collectionPatch.collections
                patch.primaryCollection = collectionPatch.primaryCollection
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
            eventCollections,
            getDraftCollectionColor,
            memberDirectory,
            user,
        ]
    )

    const ensureEventCollections = useCallback(
        async (collectionNames: string[]) => {
            if (
                !activeCalendar?.id ||
                activeCalendar.id === "demo" ||
                disabled ||
                collectionNames.length === 0
            ) {
                return eventCollections
            }

            const supabase = createBrowserSupabase()
            const collectionMap = new Map(
                eventCollections.map((collection) => [
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

            return Array.from(collectionMap.values())
        },
        [
            activeCalendar?.id,
            disabled,
            eventCollections,
            getDraftCollectionColor,
            upsertEventCollectionSnapshot,
        ]
    )

    const saveNow = useCallback(
        async (
            values: EventFormValues = form.getValues(),
            options?: {
                skipValidation?: boolean
            }
        ) => {
            if (timer.current) {
                clearTimeout(timer.current)
            }

            if (activeCalendar?.id === "demo" || disabled || !event) {
                return
            }

            const normalizedValues = normalizeValuesForPersistence(values)

            if (normalizedValues !== values) {
                form.setValue("start", normalizedValues.start, {
                    shouldDirty: true,
                    shouldTouch: true,
                })
                form.setValue("end", normalizedValues.end, {
                    shouldDirty: true,
                    shouldTouch: true,
                })
            }

            if (!options?.skipValidation) {
                const isValid = await form.trigger(undefined, {
                    shouldFocus: false,
                })

                if (!isValid) {
                    return
                }
            }

            // collectionNames에서 구글 캘린더 옵션(__gcal__:xxx)과 일반 컬렉션을 분리
            const allCollectionNames = normalizedValues.collectionNames
            const googleCatalogId =
                allCollectionNames
                    .filter(isGoogleCollectionOptionValue)
                    .map((v) => parseGoogleCollectionOptionValue(v))
                    .find((id): id is string => id !== null) ?? null
            const plainCollectionNames = normalizeNames(
                allCollectionNames.filter(
                    (v) => !isGoogleCollectionOptionValue(v)
                )
            )

            // gcal:<catalogId>:<googleEventId> 이벤트는 저장 대상 선택에 따라 이동/수정 처리
            const gcalParsed = parseGoogleCalendarEventId(event.id)
            if (gcalParsed) {
                const sourceCatalog = installedGoogleCalendarCatalogs.find(
                    (c) => c.id === gcalParsed.catalogId
                )
                const sourceConfig = sourceCatalog?.config as
                    | { googleCalendarId?: string; googleAccountId?: string }
                    | undefined

                const deleteSourceGoogleEvent = async () => {
                    if (
                        !sourceConfig?.googleCalendarId ||
                        !sourceConfig?.googleAccountId
                    ) {
                        return false
                    }

                    const response = await fetch(
                        "/api/google-calendar/events",
                        {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                googleCalendarId: sourceConfig.googleCalendarId,
                                googleAccountId: sourceConfig.googleAccountId,
                                googleEventId: gcalParsed.googleEventId,
                            }),
                        }
                    )

                    return response.ok
                }

                if (
                    googleCatalogId === gcalParsed.catalogId &&
                    plainCollectionNames.length === 0
                ) {
                    if (
                        sourceConfig?.googleCalendarId &&
                        sourceConfig?.googleAccountId
                    ) {
                        void fetch("/api/google-calendar/events", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                googleCalendarId: sourceConfig.googleCalendarId,
                                googleAccountId: sourceConfig.googleAccountId,
                                googleEventId: gcalParsed.googleEventId,
                                title: normalizedValues.title,
                                start: normalizedValues.start.toISOString(),
                                end: normalizedValues.end.toISOString(),
                                allDay: normalizedValues.allDay ?? false,
                                timezone: normalizedValues.timezone,
                            }),
                        })
                    }
                    return
                }

                if (googleCatalogId) {
                    const targetCatalog = installedGoogleCalendarCatalogs.find(
                        (c) => c.id === googleCatalogId
                    )
                    const targetConfig = targetCatalog?.config as
                        | {
                              googleCalendarId?: string
                              googleAccountId?: string
                          }
                        | undefined

                    if (
                        targetCatalog &&
                        targetConfig?.googleCalendarId &&
                        targetConfig?.googleAccountId
                    ) {
                        const createResponse = await fetch(
                            "/api/google-calendar/events",
                            {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    eventId: "",
                                    title: normalizedValues.title,
                                    start: normalizedValues.start.toISOString(),
                                    end: normalizedValues.end.toISOString(),
                                    allDay: normalizedValues.allDay ?? false,
                                    timezone: normalizedValues.timezone,
                                    googleCatalogs: [
                                        {
                                            catalogId: targetCatalog.id,
                                            googleCalendarId:
                                                targetConfig.googleCalendarId,
                                            googleAccountId:
                                                targetConfig.googleAccountId,
                                        },
                                    ],
                                }),
                            }
                        )

                        if (!createResponse.ok) {
                            return
                        }

                        const createPayload = (await createResponse.json()) as {
                            succeeded?: Array<{
                                catalogId: string
                                googleEventId: string
                            }>
                        }
                        const createdGoogleEventId =
                            createPayload.succeeded?.find(
                                (item) => item.catalogId === targetCatalog.id
                            )?.googleEventId ?? null

                        if (!createdGoogleEventId) {
                            return
                        }

                        await deleteSourceGoogleEvent()

                        const nextViewEvent = buildGoogleEventViewSnapshot({
                            sourceEvent: event,
                            targetCatalog,
                            targetGoogleEventId: createdGoogleEventId,
                            values: normalizedValues,
                        })

                        setActiveEventId(nextViewEvent.id)
                        setViewEvent(nextViewEvent)
                        navigateCalendarModal(
                            getCalendarModalOpenPath({
                                pathname,
                                eventId: nextViewEvent.id,
                            }),
                            { replace: true }
                        )
                    }

                    return
                }

                const resolvedCollections =
                    plainCollectionNames.length > 0
                        ? await ensureEventCollections(plainCollectionNames)
                        : eventCollections
                const nextCollections = buildCollectionsFromNames(
                    plainCollectionNames,
                    resolvedCollections
                )
                const localEventId = crypto.randomUUID()
                const localEvent: CalendarEvent = {
                    id: localEventId,
                    title: normalizedValues.title,
                    content: normalizedValues.content,
                    start: normalizedValues.start.getTime(),
                    end: normalizedValues.end.getTime(),
                    allDay: normalizedValues.allDay ?? false,
                    timezone: normalizedValues.timezone,
                    collectionIds: nextCollections.map(
                        (collection) => collection.id
                    ),
                    collections: nextCollections,
                    primaryCollectionId: nextCollections[0]?.id ?? null,
                    primaryCollection: nextCollections[0] ?? null,
                    recurrence: normalizedValues.recurrence,
                    exceptions: normalizedValues.exceptions,
                    participants: resolveParticipantsFromValues(
                        event,
                        normalizedValues.participantIds
                    ).map((participant) => ({
                        ...participant,
                        eventId: localEventId,
                    })),
                    isFavorite: event.isFavorite,
                    favoritedAt: event.favoritedAt,
                    status: normalizedValues.status ?? event.status,
                    authorId: user?.id ?? event.authorId,
                    author: user
                        ? {
                              id: user.id,
                              name: user.name,
                              email: user.email,
                              avatarUrl: user.avatarUrl,
                          }
                        : event.author,
                    updatedById: user?.id ?? event.updatedById,
                    updatedBy: user
                        ? {
                              id: user.id,
                              name: user.name,
                              email: user.email,
                              avatarUrl: user.avatarUrl,
                          }
                        : event.updatedBy,
                    isLocked: false,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                }

                const createdEventId = createEvent(localEvent)

                if (!createdEventId) {
                    return
                }

                await deleteSourceGoogleEvent()

                const createdEvent =
                    useCalendarStore
                        .getState()
                        .events.find((item) => item.id === createdEventId) ??
                    localEvent

                setActiveEventId(createdEventId)
                setViewEvent(createdEvent)
                navigateCalendarModal(
                    getCalendarModalOpenPath({
                        pathname,
                        eventId: createdEventId,
                    }),
                    { replace: true }
                )
                return
            }

            // 구글 캘린더 단일 저장 (일반 컬렉션과 상호 배타)
            if (googleCatalogId) {
                const catalog = installedGoogleCalendarCatalogs.find(
                    (c) => c.id === googleCatalogId
                )
                const config = catalog?.config as
                    | { googleCalendarId?: string; googleAccountId?: string }
                    | undefined
                if (config?.googleCalendarId && config?.googleAccountId) {
                    void fetch("/api/google-calendar/events", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            eventId: event.id,
                            title: normalizedValues.title,
                            start: normalizedValues.start.toISOString(),
                            end: normalizedValues.end.toISOString(),
                            allDay: normalizedValues.allDay ?? false,
                            timezone: normalizedValues.timezone,
                            googleCatalogs: [
                                {
                                    catalogId: catalog!.id,
                                    googleCalendarId: config.googleCalendarId,
                                    googleAccountId: config.googleAccountId,
                                },
                            ],
                        }),
                    })
                }
                return
            }

            // 구글 미선택: Calenber에만 저장
            if (plainCollectionNames.length === 0) {
                // 컬렉션 없이 Calenber에 저장 (컬렉션 필드가 비어있는 경우)
            }

            const valuesForPatch = {
                ...normalizedValues,
                collectionNames: plainCollectionNames,
            }
            const sourceCollectionNames = normalizeNames(
                event.collections.map((collection) => collection.name)
            )
            const resolvedCollections =
                JSON.stringify(sourceCollectionNames) ===
                JSON.stringify(plainCollectionNames)
                    ? eventCollections
                    : await ensureEventCollections(plainCollectionNames)
            const patch = buildPatchFromValues(
                event,
                valuesForPatch,
                resolvedCollections
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
            buildCollectionsFromNames,
            buildPatchFromValues,
            buildGoogleEventViewSnapshot,
            createEvent,
            disabled,
            ensureEventCollections,
            event,
            eventCollections,
            form,
            installedGoogleCalendarCatalogs,
            onChange,
            pathname,
            resolveParticipantsFromValues,
            setActiveEventId,
            setViewEvent,
            user,
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

    const queueScheduleDebouncedSave = useCallback(() => {
        hasPendingScheduleSaveRef.current = true
        if (scheduleSaveTimerRef.current) {
            clearTimeout(scheduleSaveTimerRef.current)
        }
        scheduleSaveTimerRef.current = setTimeout(() => {
            if (!isSchedulePopoverOpen) {
                hasPendingScheduleSaveRef.current = false
                void saveNow(form.getValues(), {
                    skipValidation: true,
                })
            }
        }, 450)
    }, [form, isSchedulePopoverOpen, saveNow])

    const triggerDatePickerDebouncedSave = useCallback(() => {
        queueScheduleDebouncedSave()
    }, [queueScheduleDebouncedSave])

    const triggerTimePickerDebouncedSave = useCallback(() => {
        queueScheduleDebouncedSave()
    }, [queueScheduleDebouncedSave])

    const updateScheduleValues = useCallback(
        (
            nextStart: Date,
            nextEnd: Date,
            changedBoundary: ScheduleBoundary,
            options?: {
                skipAutoSave?: boolean
                changeKind?: ScheduleChangeKind
            }
        ) => {
            const currentAllDay = form.getValues("allDay")
            const timezone =
                form.getValues("timezone") || calendarTimezone || "Asia/Seoul"
            const normalized = currentAllDay
                ? normalizeAllDaySchedule(nextStart, nextEnd, timezone)
                : normalizeTimedScheduleRange({
                      start: nextStart,
                      end: nextEnd,
                      changedBoundary,
                      changeKind: options?.changeKind ?? "date",
                      timezone,
                  })

            const currentStart = form.getValues("start")
            const currentEnd = form.getValues("end")

            if (
                currentStart.getTime() === normalized.start.getTime() &&
                currentEnd.getTime() === normalized.end.getTime()
            ) {
                return normalized
            }

            form.setValue("start", normalized.start, {
                shouldDirty: true,
                shouldTouch: true,
            })
            form.setValue("end", normalized.end, {
                shouldDirty: true,
                shouldTouch: true,
            })
            if (!options?.skipAutoSave) {
                autoSave()
            }

            return normalized
        },
        [autoSave, calendarTimezone, form]
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

    const handleSchedulePickerButtonClick = useCallback(
        (boundary: ScheduleBoundary, panel: SchedulePickerPanel) => {
            setActiveScheduleBoundary(boundary)
            setSchedulePickerPanel(panel)
            const targetDate =
                boundary === "start"
                    ? form.getValues("start")
                    : form.getValues("end")
            setSchedulePickerMonth(targetDate)
        },
        [form]
    )

    const handleWheelTimeCommit = useCallback(
        (boundary: ScheduleBoundary, nextValue: WheelTimeValue) => {
            const timezone =
                form.getValues("timezone") || calendarTimezone || "Asia/Seoul"
            const currentStart = form.getValues("start")
            const currentEnd = form.getValues("end")
            const nextTime = `${String(toHour24(nextValue.meridiem, nextValue.hour12)).padStart(2, "0")}:${String(nextValue.minute).padStart(2, "0")}`
            const nextBoundaryDate = setTimeParts(
                boundary === "start" ? currentStart : currentEnd,
                nextTime,
                timezone
            )
            const normalized =
                updateScheduleValues(
                    boundary === "start" ? nextBoundaryDate : currentStart,
                    boundary === "end" ? nextBoundaryDate : currentEnd,
                    boundary,
                    {
                        skipAutoSave: true,
                        changeKind: "time",
                    }
                ) ??
                ({
                    start: currentStart,
                    end: currentEnd,
                    didCoerce: false,
                } as const)

            triggerTimePickerDebouncedSave()

            const resolvedBoundaryDate =
                boundary === "start" ? normalized.start : normalized.end

            return {
                value: getMeridiemHourMinute(resolvedBoundaryDate, timezone),
                locked:
                    resolvedBoundaryDate.getTime() !==
                    nextBoundaryDate.getTime(),
            }
        },
        [
            calendarTimezone,
            form,
            triggerTimePickerDebouncedSave,
            updateScheduleValues,
        ]
    )

    const handleScheduleRangeSelect = useCallback(
        (range: DateRange | undefined) => {
            if (!range?.from) {
                setPendingScheduleRange(undefined)
                return
            }

            const currentStart = form.getValues("start")
            const currentEnd = form.getValues("end")
            const timezone =
                form.getValues("timezone") || calendarTimezone || "Asia/Seoul"

            if (range.to) {
                setPendingScheduleRange(undefined)
                const nextStart = setDateParts(
                    currentStart,
                    formatDateInputValue(range.from, timezone),
                    timezone
                )
                const nextEnd = setDateParts(
                    currentEnd,
                    formatDateInputValue(range.to, timezone),
                    timezone
                )

                setActiveScheduleBoundary("end")
                setSchedulePickerMonth(range.to)
                updateScheduleValues(nextStart, nextEnd, "end", {
                    skipAutoSave: true,
                })
                triggerDatePickerDebouncedSave()
                return
            }

            setPendingScheduleRange({
                from: range.from,
                to: undefined,
            })
            setActiveScheduleBoundary("end")
            setSchedulePickerMonth(range.from)
        },
        [
            calendarTimezone,
            form,
            triggerDatePickerDebouncedSave,
            updateScheduleValues,
        ]
    )

    const handleSchedulePopoverOpenChange = useCallback(
        (open: boolean) => {
            if (open) {
                setPendingScheduleRange(undefined)
                setSchedulePickerPanel("date")
                const boundary =
                    activeScheduleBoundary === "end" ? "end" : "start"
                focusScheduleBoundary(boundary)
            } else {
                setPendingScheduleRange(undefined)
                setSchedulePickerPanel("date")
                if (hasPendingScheduleSaveRef.current) {
                    hasPendingScheduleSaveRef.current = false
                    if (scheduleSaveTimerRef.current) {
                        clearTimeout(scheduleSaveTimerRef.current)
                    }
                    void saveNow(form.getValues(), {
                        skipValidation: true,
                    })
                }
            }

            setIsSchedulePopoverOpen(open)
        },
        [activeScheduleBoundary, focusScheduleBoundary, form, saveNow]
    )

    const handleAllDayToggle = useCallback(
        (checked: boolean) => {
            const currentValues = form.getValues()
            const timezone =
                currentValues.timezone || calendarTimezone || "Asia/Seoul"
            let nextStart = currentValues.start
            let nextEnd = currentValues.end

            if (checked) {
                const normalized = normalizeAllDaySchedule(
                    currentValues.start,
                    currentValues.end,
                    timezone
                )
                nextStart = normalized.start
                nextEnd = normalized.end
            } else {
                setSchedulePickerPanel("date")
                const timedRange = getTimedScheduleRangeAfterAllDayOff(
                    timezone,
                    currentValues.start,
                    currentValues.end
                )
                nextStart = timedRange.start
                nextEnd = timedRange.end
            }

            form.setValue("start", nextStart, {
                shouldDirty: true,
                shouldTouch: true,
            })
            form.setValue("end", nextEnd, {
                shouldDirty: true,
                shouldTouch: true,
            })
            form.setValue("allDay", checked, {
                shouldDirty: true,
                shouldTouch: true,
            })

            void saveNow({
                ...currentValues,
                start: nextStart,
                end: nextEnd,
                allDay: checked,
            })
        },
        [calendarTimezone, form, saveNow]
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
        if (!event || event.collectionIds.length === 0) {
            return
        }

        const nextCollectionNames = event.collectionIds
            .map(
                (collectionId) =>
                    eventCollections.find((c) => c.id === collectionId)?.name ??
                    event.collections.find((c) => c.id === collectionId)
                        ?.name ??
                    null
            )
            .filter((name): name is string => Boolean(name))
        const currentCollectionNames = normalizeNames(
            form.getValues("collectionNames") ?? []
        )
        const currentCollectionIds = currentCollectionNames
            .map(
                (name) =>
                    eventCollections.find(
                        (c) =>
                            normalizeCollectionName(c.name) ===
                            normalizeCollectionName(name)
                    )?.id ??
                    event.collections.find(
                        (c) =>
                            normalizeCollectionName(c.name) ===
                            normalizeCollectionName(name)
                    )?.id ??
                    null
            )
            .filter((id): id is string => Boolean(id))

        if (
            nextCollectionNames.length !== event.collectionIds.length ||
            JSON.stringify(currentCollectionIds.sort()) !==
                JSON.stringify([...event.collectionIds].sort()) ||
            JSON.stringify(currentCollectionNames) ===
                JSON.stringify(normalizeNames(nextCollectionNames))
        ) {
            return
        }

        form.setValue("collectionNames", normalizeNames(nextCollectionNames), {
            shouldDirty: false,
            shouldTouch: false,
        })
    }, [event, eventCollections, form])

    useEffect(() => {
        return () => {
            if (timer.current) {
                clearTimeout(timer.current)
            }
            if (scheduleSaveTimerRef.current) {
                clearTimeout(scheduleSaveTimerRef.current)
            }
        }
    }, [])

    const watchedParticipantIds = useWatch({
        control: form.control,
        name: "participantIds",
    })
    const watchedStart = useWatch({
        control: form.control,
        name: "start",
    })
    const watchedTimezone = useWatch({
        control: form.control,
        name: "timezone",
    })
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
    const visiblePropertyFields = useMemo(() => {
        if (!isSystemSubscriptionEventForm) {
            return orderedFields
        }

        const systemSubscriptionVisibleFieldIds = new Set([
            "schedule",
            "collections",
        ])

        return orderedFields.filter((field) =>
            systemSubscriptionVisibleFieldIds.has(field.id)
        )
    }, [isSystemSubscriptionEventForm, orderedFields])
    const displayOrderedFields = useMemo(() => {
        if ((watchedExceptions ?? []).length > 0) {
            return visiblePropertyFields
        }

        return visiblePropertyFields.filter(
            (field) => field.id !== "exceptions"
        )
    }, [visiblePropertyFields, watchedExceptions])
    const hiddenFieldCount = useMemo(
        () =>
            visiblePropertyFields.filter(
                (field) =>
                    !isCalendarEventFieldVisible(eventFieldSettings, field.id)
            ).length,
        [eventFieldSettings, visiblePropertyFields]
    )
    const resolvedWatchedTimezone =
        watchedTimezone || calendarTimezone || "Asia/Seoul"
    const scheduleUiState = useMemo(() => {
        const start = scheduleStart ?? form.getValues("start")
        const end = scheduleEnd ?? form.getValues("end")
        const allDay = scheduleAllDay ?? false
        const timezone = resolvedWatchedTimezone
        const activeBoundaryDate =
            activeScheduleBoundary === "start" ? start : end
        const activeBoundaryTime = getMeridiemHourMinute(
            activeBoundaryDate,
            timezone
        )

        const filteredMeridiemOptions = localizedMeridiemOptions.filter(
            (option) =>
                isWheelTimeAllowed({
                    boundary: activeScheduleBoundary,
                    candidate: {
                        ...activeBoundaryTime,
                        meridiem: option.value,
                    },
                    start,
                    end,
                    timezone,
                })
        )
        const filteredHourOptions = hourOptions.filter((option) =>
            isWheelTimeAllowed({
                boundary: activeScheduleBoundary,
                candidate: {
                    ...activeBoundaryTime,
                    hour12: option.value,
                },
                start,
                end,
                timezone,
            })
        )
        const filteredMinuteOptions = minuteOptions.filter((option) =>
            isWheelTimeAllowed({
                boundary: activeScheduleBoundary,
                candidate: {
                    ...activeBoundaryTime,
                    minute: option.value,
                },
                start,
                end,
                timezone,
            })
        )

        return {
            start,
            end,
            allDay,
            timezone,
            activeBoundaryDate,
            activeBoundaryTime,
            filteredMeridiemOptions:
                filteredMeridiemOptions.length > 0
                    ? filteredMeridiemOptions
                    : localizedMeridiemOptions,
            filteredHourOptions:
                filteredHourOptions.length > 0
                    ? filteredHourOptions
                    : hourOptions,
            filteredMinuteOptions:
                filteredMinuteOptions.length > 0
                    ? filteredMinuteOptions
                    : minuteOptions,
        }
    }, [
        activeScheduleBoundary,
        form,
        localizedMeridiemOptions,
        resolvedWatchedTimezone,
        scheduleAllDay,
        scheduleEnd,
        scheduleStart,
    ])
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
                case "collections":
                    return [
                        {
                            type: "panel",
                            key: "edit-collection-property",
                            label: tForm("editProperty"),
                            icon: Settings2Icon,
                            content: (
                                <EventCollectionSettingsPanel
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
        [activeCalendar?.id, disabled, tForm]
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
            const {
                start,
                end,
                allDay,
                timezone,
                activeBoundaryTime,
                filteredMeridiemOptions,
                filteredHourOptions,
                filteredMinuteOptions,
            } = scheduleUiState
            const scheduleModifiers = {
                ...getRangeModifiers(start, end, timezone),
                focused: [activeScheduleBoundary === "end" ? end : start],
            }

            const scheduleButtonClassName =
                "h-7 flex-1 justify-start px-1.5 text-sm font-normal shadow-none"
            const scheduleRange = pendingScheduleRange ?? {
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
                                className="h-auto w-full justify-start rounded-md px-1.5 py-1 text-left text-sm font-normal hover:bg-transparent data-open:border-ring data-open:bg-input/10! data-open:ring-3 data-open:ring-ring/50"
                            >
                                {formatCalendarEventScheduleLabel({
                                    start,
                                    end,
                                    allDay,
                                    timezone,
                                    locale,
                                })}
                            </Button>
                        </PopoverTrigger>

                        <PopoverContent
                            className="w-56 overflow-hidden p-0"
                            align="start"
                            sideOffset={8}
                        >
                            <Sidebar
                                collapsible="none"
                                className="bg-transparent dark:bg-muted"
                            >
                                <SidebarContent className="p-0">
                                    <SidebarGroup className="pb-0">
                                        {allDay ? (
                                            <div className="flex rounded-lg border border-border p-0.5">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    disabled={disabled}
                                                    className={
                                                        scheduleButtonClassName
                                                    }
                                                    onClick={() =>
                                                        handleSchedulePickerButtonClick(
                                                            "start",
                                                            "date"
                                                        )
                                                    }
                                                >
                                                    {tForm("startDateValue", {
                                                        date: formatEventFormDateLabel(
                                                            start,
                                                            timezone,
                                                            locale
                                                        ),
                                                    })}
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-1.5">
                                                {(
                                                    ["start", "end"] as const
                                                ).map((boundary) => {
                                                    const value =
                                                        boundary === "start"
                                                            ? start
                                                            : end

                                                    return (
                                                        <div
                                                            key={boundary}
                                                            className="flex items-center gap-0.5 rounded-lg border border-border p-0.5"
                                                        >
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                disabled={
                                                                    disabled
                                                                }
                                                                className={
                                                                    scheduleButtonClassName
                                                                }
                                                                onClick={() =>
                                                                    handleSchedulePickerButtonClick(
                                                                        boundary,
                                                                        "date"
                                                                    )
                                                                }
                                                            >
                                                                {formatEventFormDateLabel(
                                                                    value,
                                                                    timezone,
                                                                    locale
                                                                )}
                                                            </Button>
                                                            <Separator
                                                                orientation="vertical"
                                                                className="h-5 self-center! bg-border/55"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                disabled={
                                                                    disabled
                                                                }
                                                                className={`${scheduleButtonClassName} ${schedulePickerPanel === "time" && activeScheduleBoundary === boundary ? "bg-muted/70" : ""}`}
                                                                onClick={() =>
                                                                    handleSchedulePickerButtonClick(
                                                                        boundary,
                                                                        "time"
                                                                    )
                                                                }
                                                            >
                                                                {formatEventFormTimeLabel(
                                                                    value,
                                                                    timezone,
                                                                    locale
                                                                )}
                                                            </Button>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </SidebarGroup>

                                    <SidebarGroup className="py-0">
                                        {schedulePickerPanel === "time" &&
                                        !allDay ? (
                                            <div className="w-full">
                                                <ScheduleTimeWheelPicker
                                                    key={activeScheduleBoundary}
                                                    value={activeBoundaryTime}
                                                    disabled={disabled}
                                                    meridiemOptions={
                                                        filteredMeridiemOptions
                                                    }
                                                    hourOptions={
                                                        filteredHourOptions
                                                    }
                                                    minuteOptions={
                                                        filteredMinuteOptions
                                                    }
                                                    onCommit={(
                                                        nextValue: WheelTimeValue
                                                    ) =>
                                                        handleWheelTimeCommit(
                                                            activeScheduleBoundary,
                                                            nextValue
                                                        )
                                                    }
                                                />
                                            </div>
                                        ) : (
                                            <div className="py-1.5">
                                                <CalendarPicker
                                                    locale={getDayPickerLocale(
                                                        locale
                                                    )}
                                                    className="mx-auto w-full max-w-full p-0 dark:bg-muted"
                                                    mode="range"
                                                    month={schedulePickerMonth}
                                                    timeZone={timezone}
                                                    noonSafe
                                                    onMonthChange={
                                                        setSchedulePickerMonth
                                                    }
                                                    selected={scheduleRange}
                                                    modifiers={
                                                        scheduleModifiers
                                                    }
                                                    onSelect={
                                                        handleScheduleRangeSelect
                                                    }
                                                />
                                            </div>
                                        )}
                                    </SidebarGroup>

                                    <SidebarGroup className="border-t">
                                        <SidebarGroupContent>
                                            <SidebarMenu>
                                                <SidebarMenuButton asChild>
                                                    <label className="flex cursor-pointer items-center justify-between">
                                                        {tForm("allDay")}
                                                        <Switch
                                                            size="sm"
                                                            checked={allDay}
                                                            disabled={disabled}
                                                            aria-label={tForm(
                                                                "allDayAria"
                                                            )}
                                                            onCheckedChange={
                                                                handleAllDayToggle
                                                            }
                                                        />
                                                    </label>
                                                </SidebarMenuButton>
                                            </SidebarMenu>
                                        </SidebarGroupContent>
                                    </SidebarGroup>
                                </SidebarContent>
                            </Sidebar>
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
                                        emptyText={tForm("noVisibleMembers")}
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
                                        placeholder={tForm("selectMember")}
                                        chipClassName="px-1.5 h-6.5 text-sm leading-[normal] gap-1 pr-0"
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
                                                                tCommonLabels(
                                                                    "participant"
                                                                )
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
                                                                tCommonLabels(
                                                                    "user"
                                                                )
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
                                                                    className="shrink-0 px-1.75 leading-[normal]"
                                                                >
                                                                    {tCommonLabels(
                                                                        "me"
                                                                    )}
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
                                                                ?.name ??
                                                            tCommonLabels(
                                                                "member"
                                                            )
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
                                                            tCommonLabels(
                                                                "noName"
                                                            )}
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

        if (propertyField.id === "collections") {
            return (
                <Controller
                    key={propertyField.id}
                    name="collectionNames"
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
                                <EventFormCollectionChipsField
                                    portalContainer={portalContainer}
                                    disabled={disabled}
                                    invalid={fieldState.invalid}
                                    value={field.value ?? []}
                                    eventCollections={eventCollections}
                                    getDraftCollectionColor={
                                        getDraftCollectionColor
                                    }
                                    googleCalendarCatalogs={
                                        installedGoogleCalendarCatalogs
                                    }
                                    onChange={(nextCollectionNames) => {
                                        field.onChange(nextCollectionNames)
                                        void saveNow({
                                            ...form.getValues(),
                                            collectionNames:
                                                nextCollectionNames,
                                        })
                                    }}
                                    errors={
                                        fieldState.invalid
                                            ? [fieldState.error]
                                            : undefined
                                    }
                                />
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
                                <EventFormStatusChipsField
                                    portalContainer={portalContainer}
                                    disabled={disabled}
                                    value={field.value ?? eventStatus[0]}
                                    onChange={(nextStatus) => {
                                        field.onChange(nextStatus)
                                        void saveNow({
                                            ...form.getValues(),
                                            status: nextStatus,
                                        })
                                    }}
                                />
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
                            <div className="flex h-8 flex-wrap items-center gap-1.5 px-1.5 py-0.75">
                                {(field.value ?? []).length > 0 ? (
                                    (field.value ?? []).map((exception) => (
                                        <div
                                            key={exception}
                                            className="flex h-6.5 w-fit items-center justify-center gap-1 rounded-sm bg-muted px-1.5 pr-0 text-sm leading-[normal] font-medium whitespace-nowrap text-foreground has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[slot=combobox-chip-remove]:pr-0"
                                        >
                                            {formatExceptionDateTagLabel(
                                                exception,
                                                watchedTimezone,
                                                locale
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                disabled={disabled}
                                                className="group/button dark:not[data-selected=true]:hover:bg-muted/50 hover:not[data-selected=true]:text-foreground -ml-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[min(var(--radius-md),10px)] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap opacity-50 transition-all outline-none select-none hover:bg-muted hover:opacity-100 disabled:pointer-events-none disabled:cursor-default disabled:opacity-50 in-data-[slot=button-group]:rounded-lg has-[svg]:leading-[normal] aria-expanded:bg-muted aria-expanded:text-foreground aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3"
                                                aria-label={tForm(
                                                    "removeExceptionAria",
                                                    {
                                                        label: formatExceptionDateTagLabel(
                                                            exception,
                                                            watchedTimezone,
                                                            locale
                                                        ),
                                                    }
                                                )}
                                                onClick={() => {
                                                    const nextExceptions = (
                                                        field.value ?? []
                                                    ).filter(
                                                        (value) =>
                                                            value !== exception
                                                    )

                                                    field.onChange(
                                                        nextExceptions
                                                    )
                                                    void saveNow({
                                                        ...form.getValues(),
                                                        exceptions:
                                                            nextExceptions,
                                                    })
                                                }}
                                            >
                                                <XIcon />
                                            </Button>
                                        </div>
                                    ))
                                ) : (
                                    <span className="text-sm text-muted-foreground">
                                        {tForm("noExceptionDates")}
                                    </span>
                                )}
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
                                onChange={(nextTimezone) => {
                                    const currentTimezone =
                                        field.value ||
                                        calendarTimezone ||
                                        "Asia/Seoul"
                                    const currentValues = form.getValues()
                                    const nextStart =
                                        preserveDateTimeInTimezone(
                                            currentValues.start,
                                            currentTimezone,
                                            nextTimezone
                                        )
                                    const nextEnd = preserveDateTimeInTimezone(
                                        currentValues.end,
                                        currentTimezone,
                                        nextTimezone
                                    )
                                    const nextScheduleValues =
                                        currentValues.allDay
                                            ? normalizeAllDaySchedule(
                                                  nextStart,
                                                  nextEnd,
                                                  nextTimezone
                                              )
                                            : {
                                                  start: nextStart,
                                                  end: nextEnd,
                                              }

                                    form.setValue(
                                        "start",
                                        nextScheduleValues.start,
                                        {
                                            shouldDirty: true,
                                            shouldTouch: true,
                                        }
                                    )
                                    form.setValue(
                                        "end",
                                        nextScheduleValues.end,
                                        {
                                            shouldDirty: true,
                                            shouldTouch: true,
                                        }
                                    )
                                    field.onChange(nextTimezone)
                                    void saveNow({
                                        ...currentValues,
                                        start: nextScheduleValues.start,
                                        end: nextScheduleValues.end,
                                        timezone: nextTimezone,
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
            <FieldGroup className="gap-4 md:gap-7">
                {/* 제목 */}
                <Controller
                    name="title"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            {/* <FieldLabel>제목</FieldLabel> */}
                            <input
                                {...field}
                                placeholder={tForm("titlePlaceholder")}
                                autoFocus
                                onChange={(e) => {
                                    if (disabled) {
                                        return
                                    }

                                    field.onChange(e.target.value)
                                    autoSave()
                                }}
                                className="h-auto w-full border-0 bg-transparent p-0 text-2xl font-semibold text-primary outline-0 placeholder:text-muted-foreground/70 md:text-4xl md:font-bold"
                                disabled={disabled}
                            />
                            {/* <Input
                                {...field}
                                autoFocus={true}
                                placeholder={tForm("titlePlaceholder")}
                                className="h-auto border-0 p-0 font-bold not-focus:hover:bg-muted/60 md:text-4xl"
                                onChange={(e) => {
                                    field.onChange(e)
                                    autoSave()
                                }}
                            /> */}
                            {/* {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )} */}
                        </Field>
                    )}
                />

                {event?.subscription ? (
                    <EventSubscriptionCard
                        subscription={event.subscription}
                        className="-my-1"
                        editable={Boolean(parseGoogleCalendarEventId(event.id))}
                    />
                ) : null}

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
                            items={displayOrderedFields.map(
                                (propertyField) => propertyField.id
                            )}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="flex flex-col gap-3">
                                {displayOrderedFields.map(
                                    renderSortablePropertyField
                                )}
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
                                className="group justify-center pl-1.5 leading-[normal] text-muted-foreground! not-hover:aria-expanded:bg-transparent md:min-w-32.5"
                            >
                                <ChevronDownIcon className="group-data-[state=open]:rotate-180" />
                                {tForm("hiddenProperties", {
                                    count: hiddenFieldCount,
                                })}{" "}
                                <span className="group-data-[state=open]:hidden">
                                    {tForm("showMore")}
                                </span>
                                <span className="hidden group-data-[state=open]:inline">
                                    {tForm("hide")}
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
