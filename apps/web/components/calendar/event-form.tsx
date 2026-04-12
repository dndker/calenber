"use client"

import dayjs from "@/lib/dayjs"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon } from "lucide-react"
import { Controller, useForm } from "react-hook-form"

import { toCalendarEvent } from "./event-form.mapper"
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

import { CalendarEvent, useCalendarStore } from "@/store/useCalendarStore"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"
import { useEffect } from "react"
import { TimezoneSelect } from "./timezone-select"

export function EventForm({
    onSubmit,
}: {
    onSubmit?: (event: CalendarEvent) => void
}) {
    const selection = useCalendarStore((s) => s.selection)

    const form = useForm<EventFormValues>({
        resolver: zodResolver(eventFormSchema),
        defaultValues: {
            title: "",
            description: "",
            start: new Date(),
            end: new Date(),
            timezone: "Asia/Seoul",
            color: "blue",
            allDay: false,
        },
    })

    const handleSubmit = (values: EventFormValues) => {
        const event = toCalendarEvent(values)
        onSubmit?.(event)
    }

    useEffect(() => {
        if (!selection.start || !selection.end) return

        form.reset({
            ...form.getValues(),
            start: new Date(selection.start),
            end: new Date(selection.end),
        })
    }, [selection.start, selection.end, form])

    return (
        <form
            id="event-form"
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-6"
        >
            <FieldGroup>
                {/* 제목 */}
                <Controller
                    name="title"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel>제목</FieldLabel>
                            <Input
                                {...field}
                                placeholder="제목.."
                                aria-invalid={fieldState.invalid}
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                {/* 내용 */}
                <Controller
                    name="description"
                    control={form.control}
                    render={({ field }) => (
                        <Field>
                            <FieldLabel>내용</FieldLabel>
                            <Input {...field} placeholder="내용.." />
                        </Field>
                    )}
                />

                <Controller
                    name="start" // 아무거나 하나만 대표로 씀
                    control={form.control}
                    render={({ field }) => {
                        const start = form.getValues("start")
                        const end = form.getValues("end")

                        const range = {
                            from: start,
                            to: end,
                        }

                        return (
                            <Field>
                                <FieldLabel className="flex items-center justify-between bg-background!">
                                    기간
                                    <div className="flex items-center space-x-2">
                                        <Switch id="airplane-mode" />
                                        <Label htmlFor="airplane-mode">
                                            종일
                                        </Label>
                                    </div>
                                </FieldLabel>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {start && end
                                                ? `${dayjs(start).format("YYYY년 MM월 DD일 HH:mm")} ~ ${dayjs(end).format("YYYY년 MM월 DD일 HH:mm")}`
                                                : "날짜 선택"}
                                        </Button>
                                    </PopoverTrigger>

                                    <PopoverContent className="w-auto gap-0 p-0">
                                        <CalendarPicker
                                            mode="range"
                                            defaultMonth={range?.from}
                                            numberOfMonths={1}
                                            selected={range}
                                            onSelect={(r) => {
                                                if (!r?.from) return

                                                // 시작일
                                                const nextStart = dayjs(start)
                                                    .year(r.from.getFullYear())
                                                    .month(r.from.getMonth())
                                                    .date(r.from.getDate())
                                                    .toDate()

                                                form.setValue(
                                                    "start",
                                                    nextStart
                                                )

                                                // 종료일
                                                if (r.to) {
                                                    const nextEnd = dayjs(end)
                                                        .year(
                                                            r.to.getFullYear()
                                                        )
                                                        .month(r.to.getMonth())
                                                        .date(r.to.getDate())
                                                        .toDate()

                                                    form.setValue(
                                                        "end",
                                                        nextEnd
                                                    )
                                                }
                                            }}
                                        />

                                        {/* ⬇️ 시간은 따로 유지 */}
                                        <div className="hidden gap-2 p-2">
                                            {/* start time */}
                                            <Input
                                                type="time"
                                                value={dayjs(start).format(
                                                    "HH:mm"
                                                )}
                                                onChange={(e) => {
                                                    const [h, m] =
                                                        e.target.value.split(
                                                            ":"
                                                        )
                                                    form.setValue(
                                                        "start",
                                                        dayjs(start)
                                                            .hour(Number(h))
                                                            .minute(Number(m))
                                                            .toDate()
                                                    )
                                                }}
                                            />

                                            {/* end time */}
                                            <Input
                                                type="time"
                                                value={dayjs(end).format(
                                                    "HH:mm"
                                                )}
                                                onChange={(e) => {
                                                    const [h, m] =
                                                        e.target.value.split(
                                                            ":"
                                                        )
                                                    form.setValue(
                                                        "end",
                                                        dayjs(end)
                                                            .hour(Number(h))
                                                            .minute(Number(m))
                                                            .toDate()
                                                    )
                                                }}
                                            />
                                        </div>
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
                        <Field>
                            <FieldLabel>색상</FieldLabel>
                            <Input {...field} />
                        </Field>
                    )}
                />

                <Controller
                    name="timezone"
                    control={form.control}
                    render={({ field }) => (
                        <Field>
                            <FieldLabel>타임존</FieldLabel>

                            <TimezoneSelect
                                value={field.value}
                                onChange={(tz) => field.onChange(tz)}
                            />
                        </Field>
                    )}
                />
            </FieldGroup>

            {/* 액션 */}
            <div className="flex justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.reset()}
                >
                    초기화
                </Button>
                <Button type="submit">저장</Button>
            </div>
        </form>
    )
}
