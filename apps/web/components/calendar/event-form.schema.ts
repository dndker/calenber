import { z } from "zod"

export const recurrenceSchema = z
    .object({
        type: z.enum(["daily", "weekly", "monthly", "yearly"]),
        interval: z.number().min(1, "반복 간격은 1 이상이어야 합니다"),
        byWeekday: z.array(z.number()).optional(),
        until: z.string().datetime().optional(),
        count: z.number().optional(),
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
        description: z.string().optional(),

        start: z.date(),
        end: z.date(),

        allDay: z.boolean().optional(),

        timezone: z.string().min(1),
        color: z.string().min(1),

        recurrence: recurrenceSchema.optional(),

        exceptions: z.array(z.string().datetime()).optional(),
    })
    .refine((data) => data.end >= data.start, {
        message: "종료 시간이 시작 시간보다 늦어야 합니다",
        path: ["end"],
    })

export type EventFormValues = z.infer<typeof eventFormSchema>
