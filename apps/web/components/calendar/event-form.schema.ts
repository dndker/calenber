import dayjs from "@/lib/dayjs"
import { eventStatus } from "@/store/calendar-store.types"
import { z } from "zod"

export const recurrenceSchema = z
    .object({
        type: z.enum(["daily", "weekly", "monthly", "yearly"]),
        interval: z.number().min(1, "반복 간격은 1 이상이어야 합니다"),
        byWeekday: z.array(z.number().int().min(0).max(6)).optional(),
        until: z.string().datetime().optional(),
        count: z.number().int().min(1).optional(),
    })
    .refine(
        (data) => !(data.until && data.count),
        "until과 count는 동시에 사용할 수 없습니다"
    )
    .refine(
        (data) => {
            if (data.type === "weekly") {
                return data.byWeekday && data.byWeekday.length > 0
            }
            return true
        },
        {
            message: "요일 선택이 필요합니다",
            path: ["byWeekday"],
        }
    )

export const eventFormSchema = z
    .object({
        title: z.string().min(1, "제목을 입력해주세요."),
        content: z.any().default([]),

        start: z.date(),
        end: z.date(),

        allDay: z.boolean().optional(),

        timezone: z.string().min(1),
        categoryNames: z.array(z.string().trim().min(1)).default([]),
        participantIds: z.array(z.string()).default([]),

        recurrence: recurrenceSchema.optional(),

        exceptions: z.array(z.string().datetime()).optional(),
        status: z.enum(eventStatus).optional(),
    })
    .refine((data) => data.end >= data.start, {
        message: "종료 시간이 시작 시간보다 늦어야 합니다",
        path: ["end"],
    })
    .superRefine((data, ctx) => {
        if (!data.recurrence?.until) {
            return
        }

        const recurrenceUntil = dayjs
            .tz(data.recurrence.until, data.timezone)
            .endOf("day")
        const startDay = dayjs.tz(data.start, data.timezone).startOf("day")

        if (recurrenceUntil.isBefore(startDay)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "종료일이 시작일보다 빠를 수 없습니다",
                path: ["recurrence", "until"],
            })
        }
    })

export type EventFormValues = z.infer<typeof eventFormSchema>
