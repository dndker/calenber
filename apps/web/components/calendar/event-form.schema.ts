import { defaultLocale } from "@/lib/i18n/config"
import { getMessageTranslator } from "@/lib/i18n/messages"
import dayjs from "@/lib/dayjs"
import { eventStatus } from "@/store/calendar-store.types"
import { z } from "zod"

const t = getMessageTranslator(defaultLocale)

export const recurrenceSchema = z
    .object({
        type: z.enum(["daily", "weekly", "monthly", "yearly"]),
        interval: z.number().min(1, t("event.validation.recurrenceIntervalMin")),
        byWeekday: z.array(z.number().int().min(0).max(6)).optional(),
        until: z.string().datetime().optional(),
        count: z.number().int().min(1).optional(),
    })
    .refine(
        (data) => !(data.until && data.count),
        t("event.validation.recurrenceUntilAndCountExclusive")
    )
    .refine(
        (data) => {
            if (data.type === "weekly") {
                return data.byWeekday && data.byWeekday.length > 0
            }
            return true
        },
        {
            message: t("event.validation.recurrenceWeekdayRequired"),
            path: ["byWeekday"],
        }
    )

export const eventFormSchema = z
    .object({
        title: z.string(),
        content: z.any().default([]),

        start: z.date(),
        end: z.date(),

        allDay: z.boolean().optional(),

        timezone: z.string().min(1),
        collectionNames: z.array(z.string().trim().min(1)).default([]),
        participantIds: z.array(z.string()).default([]),

        recurrence: recurrenceSchema.optional(),

        exceptions: z.array(z.string().datetime()).optional(),
        status: z.enum(eventStatus).optional(),
    })
    .refine((data) => data.end >= data.start, {
        message: t("event.validation.endAfterStart"),
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
                message: t("event.form.endDateBeforeStart"),
                path: ["recurrence", "until"],
            })
        }
    })

export type EventFormValues = z.infer<typeof eventFormSchema>
