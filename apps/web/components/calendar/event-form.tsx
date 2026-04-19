"use client"

import dayjs, { formatRelativeTime } from "@/lib/dayjs"
import { zodResolver } from "@hookform/resolvers/zod"
import {
    CalendarIcon,
    ChevronDownIcon,
    CircleCheckBigIcon,
    UsersIcon,
} from "lucide-react"
import { Controller, useForm } from "react-hook-form"

import { mapToEvent } from "./event-form.mapper"
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
    type CalendarEvent,
    defaultContent,
    eventStatus,
    eventStatusLabel,
} from "@/store/calendar-store.types"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
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
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxValue,
    useComboboxAnchor,
} from "@workspace/ui/components/combobox"
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@workspace/ui/components/hover-card"
import { Separator } from "@workspace/ui/components/separator"
import dynamic from "next/dynamic"
import { Fragment, useEffect, useRef, useState } from "react"
import ContentEditor from "../editor/content-editor"

const ContentEditorCSR = dynamic(() => import("../editor/content-editor"), {
    ssr: false,
})

const statusItems = eventStatus.map((status) => ({
    value: status,
    label: eventStatusLabel[status],
}))

export function EventForm({
    modal = false,
    event,
    onChange,
    disabled = false,
}: {
    event?: CalendarEvent
    onChange?: (patch: Partial<CalendarEvent>) => void
    disabled?: boolean
    modal?: boolean
}) {
    const form = useForm<EventFormValues>({
        resolver: zodResolver(eventFormSchema),
        defaultValues: event
            ? {
                  title: event.title,
                  content: event.content,
                  start: new Date(event.start),
                  end: new Date(event.end),
                  timezone: event.timezone,
                  color: event.color,
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
                  color: "blue",
                  allDay: false,
                  status: eventStatus[0],
              },
    })

    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const chipsInputRef = useRef<HTMLInputElement | null>(null)
    const anchor = useComboboxAnchor()
    const [items, setItems] = useState<string[]>([])
    const [open, setOpen] = useState(false)
    const [statusOpen, setStatusOpen] = useState<boolean>(false)

    const user = useAuthStore((a) => a.user)

    const timer = useRef<NodeJS.Timeout | null>(null)

    const saveNow = () => {
        const values = form.getValues()

        const title =
            values.title && values.title.trim() !== ""
                ? values.title
                : "새 일정"

        const patch = mapToEvent({
            ...values,
            title,
        })

        console.log("[patch]", patch)
        onChange?.(patch)
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

        console.log(event)

        form.reset({
            title: event.title,
            content: event.content,
            start: new Date(event.start),
            end: new Date(event.end),
            timezone: event.timezone,
            color: event.color,
            allDay: event.allDay,
            recurrence: event.recurrence,
            exceptions: event.exceptions,
            status: event.status,
        })
    }, [event, form])

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
                                    autoSave()
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
                    <Field className="md:flex-row md:gap-3">
                        <FieldLabel className="flex h-8.5 items-center md:w-32.5">
                            <UsersIcon className="size-4" />
                            참가자
                        </FieldLabel>

                        <div className="flex w-full flex-wrap justify-start gap-1.5 px-1 md:flex-1">
                            <HoverCard openDelay={10} closeDelay={100}>
                                <HoverCardTrigger asChild>
                                    <div
                                        key={event?.author?.id}
                                        className="flex cursor-default items-center gap-1.25 rounded-full border border-border px-1.5 py-1 pr-1.75 text-sm select-none dark:bg-input/30"
                                    >
                                        <Avatar className="size-5.5">
                                            <AvatarImage
                                                src={
                                                    event?.author?.avatarUrl ??
                                                    undefined
                                                }
                                                alt={
                                                    event?.author?.name ??
                                                    "작성자"
                                                }
                                            />
                                            <AvatarFallback className="text-xs">
                                                {event?.author?.name?.[0]?.toUpperCase() ??
                                                    "?"}
                                            </AvatarFallback>
                                        </Avatar>

                                        {event?.author?.name}
                                    </div>
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
                                        <span className="truncate text-xs tracking-tight text-muted-foreground [word-spacing:-0.5px]">
                                            {formatRelativeTime(
                                                event?.updatedAt
                                            )}{" "}
                                            수정
                                        </span>
                                    </div>
                                </HoverCardContent>
                            </HoverCard>
                        </div>
                    </Field>

                    <CollapsibleContent>
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
                                        <Combobox
                                            open={statusOpen}
                                            onOpenChange={setStatusOpen}
                                            disabled={disabled}
                                            multiple
                                            autoHighlight
                                            items={statusItems}
                                            value={[field.value]}
                                            onValueChange={(values) => {
                                                const last =
                                                    values[values.length - 1]!

                                                field.onChange(last)
                                                setStatusOpen(false)
                                                chipsInputRef.current?.blur()
                                                autoSave()
                                            }}
                                        >
                                            <ComboboxChips
                                                {...field}
                                                ref={anchor}
                                                className="w-full cursor-pointer bg-input/10 py-0.75 not-focus-within:border-transparent! not-focus-within:bg-transparent!"
                                            >
                                                <ComboboxValue>
                                                    {(values) => (
                                                        <Fragment>
                                                            {values.map(
                                                                (
                                                                    value: string
                                                                ) => {
                                                                    const item =
                                                                        statusItems.find(
                                                                            (
                                                                                s
                                                                            ) =>
                                                                                s.value ===
                                                                                value
                                                                        )

                                                                    return (
                                                                        <ComboboxChip
                                                                            className="flex h-full items-center gap-1.5 rounded-full px-2.5! pr-2.75! text-sm dark:bg-input/50 [&_button]:hidden"
                                                                            key={
                                                                                value
                                                                            }
                                                                        >
                                                                            <span className="size-2 rounded-full bg-primary"></span>
                                                                            {item?.label ??
                                                                                value}
                                                                        </ComboboxChip>
                                                                    )
                                                                }
                                                            )}
                                                            <ComboboxChipsInput
                                                                ref={
                                                                    chipsInputRef
                                                                }
                                                                className="cursor-pointer focus:cursor-text"
                                                            />
                                                        </Fragment>
                                                    )}
                                                </ComboboxValue>
                                            </ComboboxChips>
                                            <ComboboxContent
                                                anchor={anchor}
                                                className="dark:bg-muted"
                                            >
                                                <ComboboxEmpty>
                                                    No items found.
                                                </ComboboxEmpty>
                                                <ComboboxList>
                                                    {(status) => (
                                                        <ComboboxItem
                                                            className="py-1.5 dark:hover:bg-input/50"
                                                            key={status.value}
                                                            value={status.value}
                                                        >
                                                            {status.label}
                                                        </ComboboxItem>
                                                    )}
                                                </ComboboxList>
                                            </ComboboxContent>
                                        </Combobox>
                                    </div>
                                </Field>
                            )}
                        />
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
                                    onChange={(val) => {
                                        if (disabled) return
                                        field.onChange(val)
                                        autoSave()
                                    }}
                                />
                            ) : (
                                <ContentEditorCSR
                                    value={field.value}
                                    editable={!disabled}
                                    onChange={(val) => {
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
