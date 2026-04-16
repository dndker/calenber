"use client"

import dayjs from "@/lib/dayjs"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon } from "lucide-react"
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
import { Input } from "@workspace/ui/components/input"

import { CalendarPicker } from "@workspace/ui/components/calendar-picker"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@workspace/ui/components/popover"

import {
    type CalendarEvent,
    defaultContent,
} from "@/store/calendar-store.types"
import {
    Combobox,
    ComboboxContent,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@workspace/ui/components/combobox"
import { Separator } from "@workspace/ui/components/separator"
import { useRef, useState } from "react"
import ContentEditor from "../editor/content-editor"
import { TimezoneSelect } from "./timezone-select"

export function EventForm({
    event,
    onChange,
    disabled = false,
}: {
    event?: CalendarEvent
    onChange?: (patch: Partial<CalendarEvent>) => void
    disabled?: boolean
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
              }
            : {
                  title: "",
                  content: defaultContent,
                  start: new Date(),
                  end: new Date(),
                  timezone: "Asia/Seoul",
                  color: "blue",
                  allDay: false,
              },
    })

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

        onChange?.(patch)
    }

    const autoSave = () => {
        if (timer.current) clearTimeout(timer.current)

        if (disabled) {
            return
        }

        timer.current = setTimeout(() => {
            saveNow()
        }, 350)
    }

    const [items, setItems] = useState<string[]>([])
    const [open, setOpen] = useState(false)

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

    return (
        <form
            className="flex flex-col gap-6"
            onSubmit={(e) => e.preventDefault()}
        >
            <FieldGroup>
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
                                    className="*ring-0! h-auto border-0! bg-background! font-bold opacity-100! shadow-none! ring-0! outline-0! *:h-auto *:rounded-md *:p-0 *:text-primary! *:opacity-100! *:not-focus:hover:bg-muted/60 *:data-[slot=input-group-addon]:hidden *:md:text-4xl"
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

                {/* 기간 */}
                <Controller
                    name="start"
                    control={form.control}
                    render={() => {
                        const start = form.getValues("start")
                        const end = form.getValues("end")

                        return (
                            <Field className="md:flex-row md:gap-3">
                                <FieldLabel className="flex justify-between bg-background! md:w-30">
                                    기간
                                    {/* <div className="flex items-center space-x-1">
                                        <Label className="text-sm text-muted-foreground">
                                            종일
                                        </Label>
                                        <Switch size="sm" />
                                    </div> */}
                                </FieldLabel>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start md:flex-1"
                                            disabled={disabled}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {`${dayjs(start).format(
                                                "YYYY-MM-DD HH:mm"
                                            )} ~ ${dayjs(end).format(
                                                "YYYY-MM-DD HH:mm"
                                            )}`}
                                        </Button>
                                    </PopoverTrigger>

                                    <PopoverContent className="w-auto p-0">
                                        <CalendarPicker
                                            mode="range"
                                            selected={{
                                                from: start,
                                                to: end,
                                            }}
                                            onSelect={(r) => {
                                                if (disabled) return
                                                if (!r?.from) return

                                                form.setValue("start", r.from)
                                                if (r.to)
                                                    form.setValue("end", r.to)

                                                autoSave()
                                            }}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </Field>
                        )
                    }}
                />

                {/* 색상 */}
                <Controller
                    name="color"
                    control={form.control}
                    render={({ field }) => (
                        <Field className="md:flex-row md:gap-3">
                            <FieldLabel className="flex justify-between bg-background! md:w-30">
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
                />

                {/* 타임존 */}
                <Controller
                    name="timezone"
                    control={form.control}
                    render={({ field }) => (
                        <Field className="md:flex-row md:gap-3">
                            <FieldLabel className="flex justify-between bg-background! md:w-30">
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
                />

                <Separator />

                {/* 내용 */}
                {/* <Controller
                    name="content"
                    control={form.control}
                    render={({ field }) => (
                        <Field>
                            <FieldLabel>내용</FieldLabel>
                            <Input
                                {...field}
                                onChange={(e) => {
                                    field.onChange(e)
                                    autoSave()
                                }}
                            />
                        </Field>
                    )}
                /> */}

                <Controller
                    name="content"
                    control={form.control}
                    render={({ field }) => (
                        <Field>
                            <ContentEditor
                                value={field.value}
                                editable={!disabled}
                                onChange={(val) => {
                                    if (disabled) return
                                    field.onChange(val)
                                    autoSave() // 🔥 기존 debounce 그대로 사용
                                }}
                            />
                        </Field>
                    )}
                />
            </FieldGroup>
        </form>
    )
}
