"use client"

import {
    getCalendarEventCategories,
    getCalendarMemberDirectory,
    type CalendarMemberDirectoryItem,
} from "@/lib/calendar/queries"
import dayjs from "@/lib/dayjs"
import { createBrowserSupabase } from "@/lib/supabase/client"
import { zodResolver } from "@hookform/resolvers/zod"
import {
    CalendarIcon,
    ChevronDownIcon,
    CircleCheckBigIcon,
    TagsIcon,
    UsersIcon,
} from "lucide-react"
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form"

import { EventChipsCombobox } from "./event-chips-combobox"
import { eventFormSchema, type EventFormValues } from "./event-form.schema"

import { Button } from "@workspace/ui/components/button"
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@workspace/ui/components/field"

import { CalendarPicker } from "@workspace/ui/components/calendar-picker"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@workspace/ui/components/popover"

import {
    defaultContent,
    eventStatus,
    eventStatusLabel,
    type CalendarEvent,
    type CalendarEventCategory,
    type CalendarEventParticipant,
    type EditorContent,
} from "@/store/calendar-store.types"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@workspace/ui/components/avatar"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
    Combobox,
    ComboboxContent,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@workspace/ui/components/combobox"
import { Separator } from "@workspace/ui/components/separator"
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

type CategoryOption = {
    value: string
    label: string
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

function normalizeIds(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)))
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
}: {
    event?: CalendarEvent
    onChange?: (
        patch: Partial<CalendarEvent>,
        options?: {
            expectedUpdatedAt?: number
        }
    ) => void
    disabled?: boolean
    modal?: boolean
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
    const setEventCategories = useCalendarStore((s) => s.setEventCategories)
    const [items, setItems] = useState<string[]>([])
    const [open, setOpen] = useState(false)
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

    const buildPatchFromValues = (
        sourceEvent: CalendarEvent,
        values: EventFormValues
    ): Partial<CalendarEvent> => {
        const normalizedTitle =
            values.title && values.title.trim() !== "" ? values.title : ""
        const patch: Partial<CalendarEvent> = {}

        if (!isSameValue(sourceEvent.title, normalizedTitle)) {
            patch.title = normalizedTitle
        }

        if (!isSameValue(sourceEvent.content, values.content, "json")) {
            patch.content = values.content
        }

        if (
            !isSameValue(sourceEvent.start, values.start.getTime(), "primitive")
        ) {
            patch.start = values.start.getTime()
        }

        if (!isSameValue(sourceEvent.end, values.end.getTime(), "primitive")) {
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
                        eventCategories.find(
                            (category) => category.name.trim() === categoryName
                        ) ?? null

                    return (
                        matchedCategory ?? {
                            id: "",
                            calendarId: activeCalendar?.id ?? "",
                            name: categoryName,
                            options: {
                                visibleByDefault: true,
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
            sourceEvent.participants.map((participant) => participant.userId)
        )

        if (!isSameValue(sourceParticipantIds, nextParticipantIds, "json")) {
            const memberMap = new Map(
                memberDirectory.map((member) => [member.userId, member])
            )

            const nextParticipants = nextParticipantIds.flatMap(
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

            patch.participants = nextParticipants
        }

        if (!isSameValue(sourceEvent.recurrence, values.recurrence, "json")) {
            patch.recurrence = values.recurrence
        }

        if (!isSameValue(sourceEvent.exceptions, values.exceptions, "json")) {
            patch.exceptions = values.exceptions
        }

        if (!isSameValue(sourceEvent.status, values.status)) {
            patch.status = values.status
        }

        return patch
    }

    const saveNow = (values: EventFormValues = form.getValues()) => {
        if (timer.current) {
            clearTimeout(timer.current)
        }

        if (activeCalendar?.id === "demo" || disabled || !event) {
            return
        }

        const patch = buildPatchFromValues(event, values)

        if (Object.keys(patch).length === 0) {
            return
        }

        onChange?.(patch, {
            expectedUpdatedAt: event.updatedAt,
        })
    }

    const autoSave = () => {
        if (timer.current) clearTimeout(timer.current)

        if (activeCalendar?.id === "demo") return

        if (disabled) {
            return
        }

        timer.current = setTimeout(() => {
            saveNow()
        }, 350)
    }

    const searchTimer = useRef<NodeJS.Timeout | null>(null)

    const events = [
        "새로운 일정 업무",
        "업무하기",
        "낮잠자기",
        "쇼핑",
        "콜라보",
    ] as const

    const fakeSearch = async (query: string): Promise<string[]> => {
        // 약간 비동기 느낌 주기 (선택)
        await new Promise((r) => setTimeout(r, 100))

        return events.filter((item) =>
            item.toLowerCase().includes(query.toLowerCase())
        )
    }

    const handleSearch = (value: string) => {
        if (searchTimer.current) clearTimeout(searchTimer.current)

        searchTimer.current = setTimeout(async () => {
            if (value.trim().length === 0) {
                setItems([])
                setOpen(false)
                return
            }

            // 🔥 여기서 실제 검색 (API or store)
            const result = await fakeSearch(value)

            setItems(result)
            setOpen(result.length > 0)
        }, 150)
    }

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

        void getCalendarEventCategories(supabase, targetCalendarId).then(
            (categories) => {
                if (cancelled) {
                    return
                }

                setEventCategories(
                    categories.map((category) => ({
                        ...category,
                        createdAt: new Date(category.createdAt).valueOf(),
                        updatedAt: new Date(category.updatedAt).valueOf(),
                    }))
                )
            }
        )

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
    }, [activeCalendar?.id, setEventCategories])

    const memberDirectory =
        !activeCalendar?.id ||
        activeCalendar.id === "demo" ||
        memberDirectoryState.calendarId !== activeCalendar.id
            ? EMPTY_MEMBER_DIRECTORY
            : memberDirectoryState.members

    useEffect(() => {
        return () => {
            if (timer.current) {
                clearTimeout(timer.current)
            }

            if (searchTimer.current) {
                clearTimeout(searchTimer.current)
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
    const selectedCategories = useMemo<CategoryOption[]>(
        () =>
            normalizeNames(watchedCategoryNames ?? []).map((categoryName) => {
                const matchedCategory =
                    eventCategories.find(
                        (category) => category.name.trim() === categoryName
                    ) ?? null

                return matchedCategory
                    ? {
                          value: matchedCategory.name,
                          label: matchedCategory.name,
                          data: matchedCategory,
                      }
                    : {
                          value: categoryName,
                          label: categoryName,
                          isCreate: true,
                      }
            }),
        [eventCategories, watchedCategoryNames]
    )
    const categoryItems = useMemo<CategoryOption[]>(
        () =>
            eventCategories.map((category) => ({
                value: category.name,
                label: category.name,
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

    return (
        <form
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
                            <Combobox
                                items={items}
                                open={open}
                                onOpenChange={(next) => {
                                    if (items.length > 0) {
                                        setOpen(next)
                                    }
                                }}
                                onValueChange={(item: string | null) => {
                                    if (!item) return false

                                    form.setValue("title", item)
                                    setOpen(false)
                                    saveNow({
                                        ...form.getValues(),
                                        title: item,
                                    })
                                }}
                            >
                                <ComboboxInput
                                    {...field}
                                    placeholder="새 일정"
                                    autoFocus={true}
                                    onChange={(e) => {
                                        const value = e.target.value

                                        if (disabled) {
                                            return
                                        }

                                        field.onChange(value)
                                        autoSave()
                                        handleSearch(value)

                                        if (!value.trim()) {
                                            setItems([])
                                            setOpen(false)
                                            return
                                        }
                                    }}
                                    className="*ring-0! h-auto border-0! bg-transparent! font-bold opacity-100! shadow-none! ring-0! outline-0! *:h-auto *:rounded-md *:p-0 *:text-primary! *:opacity-100! *:not-focus:hover:bg-muted/60 *:data-[slot=input-group-addon]:hidden *:md:text-4xl"
                                    disabled={disabled}
                                />
                                <ComboboxContent className="min-w-full">
                                    <ComboboxList>
                                        {(item) => (
                                            <ComboboxItem
                                                key={item}
                                                value={item}
                                            >
                                                {item}
                                            </ComboboxItem>
                                        )}
                                    </ComboboxList>
                                </ComboboxContent>
                            </Combobox>
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

                <Collapsible className="flex flex-col gap-3">
                    {/* 기간 */}
                    <Controller
                        name="start"
                        control={form.control}
                        render={() => {
                            const start = form.getValues("start")
                            const end = form.getValues("end")

                            return (
                                <Field className="h-8.5 md:flex-row md:gap-3">
                                    <FieldLabel className="flex items-center md:w-32.5">
                                        <CalendarIcon className="size-4" />
                                        기간
                                    </FieldLabel>

                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-full justify-start border-0! bg-transparent! px-1.5 md:flex-1"
                                                disabled={disabled}
                                            >
                                                {`${dayjs(start).format(
                                                    "YYYY-MM-DD HH:mm"
                                                )} ~ ${dayjs(end).format(
                                                    "YYYY-MM-DD HH:mm"
                                                )}`}
                                            </Button>
                                        </PopoverTrigger>

                                        <PopoverContent
                                            className="w-auto overflow-hidden p-0"
                                            align="start"
                                            alignOffset={4}
                                        >
                                            <CalendarPicker
                                                className="dark:bg-muted"
                                                mode="range"
                                                selected={{
                                                    from: start,
                                                    to: end,
                                                }}
                                                onSelect={(r) => {
                                                    if (disabled) return
                                                    if (!r?.from) return

                                                    form.setValue(
                                                        "start",
                                                        r.from
                                                    )
                                                    if (r.to)
                                                        form.setValue(
                                                            "end",
                                                            r.to
                                                        )

                                                    autoSave()
                                                }}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </Field>
                            )
                        }}
                    />

                    {/* 참가자 */}
                    <Controller
                        name="participantIds"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field
                                className="md:flex-row md:gap-3"
                                data-invalid={fieldState.invalid}
                            >
                                <FieldLabel className="flex h-8.5 items-center md:w-32.5">
                                    <UsersIcon className="size-4" />
                                    참가자
                                </FieldLabel>

                                <div className="flex w-full flex-wrap justify-start gap-1.5 md:flex-1">
                                    <EventChipsCombobox
                                        disabled={disabled}
                                        options={participantOptions}
                                        value={normalizeIds(field.value ?? [])}
                                        emptyText="표시할 멤버가 없습니다."
                                        onValueChange={(values) => {
                                            const nextParticipantIds =
                                                normalizeIds(values)

                                            field.onChange(nextParticipantIds)
                                            saveNow({
                                                ...form.getValues(),
                                                participantIds:
                                                    nextParticipantIds,
                                            })
                                        }}
                                        invalid={fieldState.invalid}
                                        placeholder="멤버 선택"
                                        renderChipContent={(participant) => (
                                            <>
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
                                                    <AvatarFallback className="text-[10px]">
                                                        {participant.data?.name?.[0]?.toUpperCase() ??
                                                            "?"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {participant.label}
                                            </>
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
                            </Field>
                        )}
                    />

                    {/* <Field className="md:flex-row md:gap-3">
                        <FieldLabel className="flex h-8.5 items-center md:w-32.5">
                            작성자
                        </FieldLabel>

                        <div className="flex w-full flex-wrap justify-start gap-1.5 px-1 md:flex-1">
                            <HoverCard openDelay={10} closeDelay={100}>
                                <HoverCardTrigger className="flex cursor-default items-center gap-1.25 rounded-full text-sm select-none">
                                    <Avatar className="size-5">
                                        <AvatarImage
                                            src={
                                                event?.author?.avatarUrl ??
                                                undefined
                                            }
                                            alt={
                                                event?.author?.name ?? "작성자"
                                            }
                                        />
                                        <AvatarFallback className="text-xs">
                                            {event?.author?.name?.[0]?.toUpperCase() ??
                                                "?"}
                                        </AvatarFallback>
                                    </Avatar>

                                    {event?.author?.name}
                                </HoverCardTrigger>
                                <HoverCardContent
                                    className="flex w-auto items-center gap-2 overflow-hidden shadow-sm"
                                    align="start"
                                >
                                    <Avatar className="shrink-0">
                                        <AvatarImage
                                            src={
                                                event?.author?.avatarUrl ||
                                                undefined
                                            }
                                            alt={
                                                event?.author?.name || "사용자"
                                            }
                                        />
                                        <AvatarFallback className="text-sm">
                                            {event?.author?.name?.[0]?.toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-1 flex-col gap-1 overflow-hidden text-start">
                                        <div className="flex flex-1 items-center gap-1">
                                            <span className="flex-initial truncate text-sm font-medium tracking-tight [word-spacing:-1px]">
                                                {event?.author?.name}
                                            </span>
                                            {user?.id === event?.authorId && (
                                                <Badge
                                                    variant="outline"
                                                    className="shrink-0 px-1.75 leading-normal"
                                                >
                                                    나
                                                </Badge>
                                            )}
                                        </div>
                                        <EventUpdatedAtText
                                            value={event?.updatedAt}
                                        />
                                    </div>
                                </HoverCardContent>
                            </HoverCard>
                        </div>
                    </Field> */}

                    <CollapsibleContent>
                        <div className="flex flex-col gap-3">
                            <Controller
                                name="categoryNames"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field
                                        className="h-8.5 md:flex-row md:gap-3"
                                        data-invalid={fieldState.invalid}
                                    >
                                        <FieldLabel className="flex items-center md:w-32.5">
                                            <TagsIcon className="size-4" />
                                            카테고리
                                        </FieldLabel>

                                        <div className="flex w-full flex-col gap-2 md:flex-1">
                                            <EventChipsCombobox
                                                disabled={disabled}
                                                options={categoryOptions}
                                                value={normalizeNames(
                                                    field.value ?? []
                                                )}
                                                emptyText="카테고리를 입력해 생성할 수 있습니다."
                                                onValueChange={(values) => {
                                                    const nextCategoryNames =
                                                        normalizeNames(values)

                                                    field.onChange(
                                                        nextCategoryNames
                                                    )

                                                    console.log(
                                                        nextCategoryNames
                                                    )
                                                    saveNow({
                                                        ...form.getValues(),
                                                        categoryNames:
                                                            nextCategoryNames,
                                                    })
                                                }}
                                                invalid={fieldState.invalid}
                                                placeholder="카테고리 추가"
                                                renderChipContent={(category) =>
                                                    category.label
                                                }
                                                renderItemContent={(
                                                    category
                                                ) =>
                                                    category.isCreate
                                                        ? `새 카테고리 생성: ${category.label}`
                                                        : category.label
                                                }
                                                createOptionFromQuery={(
                                                    query
                                                ) =>
                                                    query
                                                        ? {
                                                              value: query,
                                                              label: query,
                                                              isCreate: true,
                                                          }
                                                        : null
                                                }
                                            />
                                            {fieldState.invalid && (
                                                <FieldError
                                                    errors={[fieldState.error]}
                                                />
                                            )}
                                        </div>
                                    </Field>
                                )}
                            />

                            {/* 상태 */}
                            <Controller
                                name="status"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field
                                        className="h-8.5 md:flex-row md:gap-3"
                                        data-invalid={fieldState.invalid}
                                    >
                                        <FieldLabel className="flex items-center md:w-32.5">
                                            <CircleCheckBigIcon className="size-4" />
                                            상태
                                        </FieldLabel>

                                        <div className="flex w-full flex-wrap justify-start gap-1.5 md:flex-1">
                                            <EventChipsCombobox
                                                disabled={disabled}
                                                options={statusItems.map(
                                                    (status) => ({
                                                        value: status.value,
                                                        label: status.label,
                                                    })
                                                )}
                                                value={statusValue}
                                                emptyText="No items found."
                                                onValueChange={(values) => {
                                                    const last =
                                                        values[
                                                            values.length - 1
                                                        ]

                                                    if (!last) {
                                                        return
                                                    }

                                                    const nextStatus =
                                                        last as StatusOption["value"]

                                                    field.onChange(nextStatus)
                                                    saveNow({
                                                        ...form.getValues(),
                                                        status: nextStatus,
                                                    })
                                                }}
                                                closeOnSelect
                                                showRemove={false}
                                                renderChipContent={(status) => (
                                                    <>
                                                        <span className="size-2 rounded-full bg-primary"></span>
                                                        {status.label}
                                                    </>
                                                )}
                                                renderItemContent={(status) =>
                                                    status.label
                                                }
                                                chipClassName="[&_button]:hidden flex h-full items-center gap-1.5 rounded-full px-2.5! pr-2.75! text-sm dark:bg-input/50"
                                            />
                                        </div>
                                    </Field>
                                )}
                            />
                        </div>
                    </CollapsibleContent>

                    <CollapsibleTrigger className="w-auto self-start" asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="group justify-center pl-1.5 leading-normal text-muted-foreground! not-hover:aria-expanded:bg-transparent md:w-32.5"
                        >
                            <ChevronDownIcon className="group-data-[state=open]:rotate-180" />
                            일정 속성{" "}
                            <span className="group-data-[state=open]:hidden">
                                더 보기
                            </span>
                            <span className="hidden group-data-[state=open]:inline">
                                숨기기
                            </span>
                        </Button>
                    </CollapsibleTrigger>

                    {/* 색상 */}
                    {/* <Controller
                        name="color"
                        control={form.control}
                        render={({ field }) => (
                            <Field className="md:flex-row md:gap-3">
                                <FieldLabel className="flex justify-between bg-background! md:w-32.5">
                                    색상
                                </FieldLabel>
                                <Input
                                    {...field}
                                    className="md:flex-1"
                                    disabled={disabled}
                                    onChange={(e) => {
                                        if (disabled) return
                                        field.onChange(e)
                                        autoSave()
                                    }}
                                />
                            </Field>
                        )}
                    /> */}

                    {/* 타임존 */}
                    {/* <Controller
                        name="timezone"
                        control={form.control}
                        render={({ field }) => (
                            <Field className="md:flex-row md:gap-3">
                                <FieldLabel className="flex justify-between bg-background! md:w-32.5">
                                    타임존
                                </FieldLabel>
    
                                <TimezoneSelect
                                    value={field.value}
                                    className="flex-1"
                                    disabled={disabled}
                                    onChange={(tz) => {
                                        if (disabled) return
                                        field.onChange(tz)
                                        autoSave()
                                    }}
                                />
                            </Field>
                        )}
                    /> */}
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
                                />
                            )}
                        </Field>
                    )}
                />
            </FieldGroup>
        </form>
    )
}
