"use client"

import { createCalendar } from "@/lib/calendar/mutations"
import {
    CALENDAR_ACCESS_MODES,
    type CalendarAccessMode,
} from "@/lib/calendar/permissions"
import { getCalendarPath } from "@/lib/calendar/routes"
import {
    MAX_CALENDAR_NAME_LENGTH,
    MIN_DISPLAY_NAME_LENGTH,
} from "@/lib/validation"
import { zodResolver } from "@hookform/resolvers/zod"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import { Button } from "@workspace/ui/components/button"
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSeparator,
    FieldSet,
    FieldTitle,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
    RadioGroup,
    RadioGroupItem,
} from "@workspace/ui/components/radio-group"

const accessModes = [
    {
        id: "public_open",
        title: "공개 · 바로 참여",
        description: "누구나 캘린더를 찾고 바로 참여할 수 있어요.",
    },
    {
        id: "public_approval",
        title: "공개 · 승인 후 참여",
        description: "누구나 발견할 수 있지만 참여는 승인 후 가능해요.",
    },
    {
        id: "private",
        title: "비공개 · 초대 전용",
        description: "링크로도 노출되지 않고 초대한 사람만 참여할 수 있어요.",
    },
] as const satisfies ReadonlyArray<{
    id: CalendarAccessMode
    title: string
    description: string
}>

const formSchema = z.object({
    name: z
        .string({
            required_error: "캘린더 이름을 입력해 주세요.",
        })
        .trim()
        .min(
            MIN_DISPLAY_NAME_LENGTH,
            `캘린더 이름은 ${MIN_DISPLAY_NAME_LENGTH}자 이상이어야 합니다.`
        )
        .max(
            MAX_CALENDAR_NAME_LENGTH,
            `캘린더 이름은 ${MAX_CALENDAR_NAME_LENGTH}자 이하여야 합니다.`
        ),
    accessMode: z
        .enum(CALENDAR_ACCESS_MODES, {
            required_error: "노출 여부를 선택해 주세요.",
        })
        .refine(
            (value) =>
                accessModes.some((accessMode) => accessMode.id === value),
            {
                message: "올바른 노출 여부를 선택해 주세요.",
            }
        ),
})

type CreateCalendarFormValues = z.infer<typeof formSchema>

export default function CreateCalendarPage() {
    const router = useRouter()
    const form = useForm<CreateCalendarFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            accessMode: "public_open",
        },
    })

    async function onSubmit(data: CreateCalendarFormValues) {
        const supabase = createBrowserSupabase()
        const createdCalendar = await createCalendar(supabase, {
            name: data.name.trim(),
            accessMode: data.accessMode,
        })

        if (!createdCalendar) {
            toast.error("캘린더를 만들지 못했습니다.")
            return
        }

        toast.success("캘린더를 만들었습니다.")
        router.push(getCalendarPath(createdCalendar.id))
    }

    return (
        <>
            <div className="flex items-center justify-between">
                <div className="flex flex-1 flex-col gap-1.5">
                    <h2 className="text-2xl font-bold">캘린더 만들기</h2>
                    <p className="text-sm font-medium text-muted-foreground">
                        나만의 새 캘린더를 시작해보세요.
                    </p>
                </div>
            </div>
            <div>
                <form
                    id="form-rhf-complex"
                    onSubmit={form.handleSubmit(onSubmit)}
                >
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="create-calendar-name">
                                        캘린더 이름
                                    </FieldLabel>
                                    <Input
                                        id="create-calendar-name"
                                        value={field.value}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        placeholder="예: 우리 동네 축구 일정"
                                        minLength={MIN_DISPLAY_NAME_LENGTH}
                                        maxLength={MAX_CALENDAR_NAME_LENGTH}
                                        aria-invalid={fieldState.invalid}
                                    />
                                    <FieldDescription>
                                        {MIN_DISPLAY_NAME_LENGTH}자 이상{" "}
                                        {MAX_CALENDAR_NAME_LENGTH}자 이하로
                                        입력해 주세요.
                                    </FieldDescription>
                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <FieldSeparator />
                        <Controller
                            name="accessMode"
                            control={form.control}
                            render={({ field, fieldState }) => {
                                const isInvalid = fieldState.invalid
                                return (
                                    <FieldSet data-invalid={isInvalid}>
                                        <FieldLegend variant="label">
                                            노출 여부
                                        </FieldLegend>
                                        <FieldDescription>
                                            이 캘린더를 누가 찾고 참여할 수
                                            있는지 설정해 주세요.
                                        </FieldDescription>
                                        <RadioGroup
                                            name={field.name}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            aria-invalid={isInvalid}
                                        >
                                            {accessModes.map((accessMode) => (
                                                <FieldLabel
                                                    key={accessMode.id}
                                                    htmlFor={`create-calendar-${accessMode.id}`}
                                                >
                                                    <Field orientation="horizontal">
                                                        <FieldContent>
                                                            <FieldTitle>
                                                                {
                                                                    accessMode.title
                                                                }
                                                            </FieldTitle>
                                                            <FieldDescription>
                                                                {
                                                                    accessMode.description
                                                                }
                                                            </FieldDescription>
                                                        </FieldContent>
                                                        <RadioGroupItem
                                                            value={
                                                                accessMode.id
                                                            }
                                                            id={`create-calendar-${accessMode.id}`}
                                                        />
                                                    </Field>
                                                </FieldLabel>
                                            ))}
                                        </RadioGroup>
                                        {isInvalid && (
                                            <FieldError
                                                errors={[fieldState.error]}
                                            />
                                        )}
                                    </FieldSet>
                                )
                            }}
                        />
                        <Button
                            className="w-full"
                            size="lg"
                            disabled={form.formState.isSubmitting}
                        >
                            {form.formState.isSubmitting
                                ? "캘린더 만드는 중..."
                                : "캘린더 만들기"}
                        </Button>
                    </FieldGroup>
                </form>
            </div>
        </>
    )
}
