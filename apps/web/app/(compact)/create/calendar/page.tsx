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
import { useAuthStore } from "@/store/useAuthStore"
import { zodResolver } from "@hookform/resolvers/zod"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
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
import { Spinner } from "@workspace/ui/components/spinner"
import { EarthIcon, EarthLockIcon, LockIcon, LucideIcon } from "lucide-react"

const accessModes = [
    {
        id: "public_open",
        titleKey: "publicOpenTitle",
        descriptionKey: "publicOpenDescription",
        icon: EarthIcon,
    },
    {
        id: "public_approval",
        titleKey: "publicApprovalTitle",
        descriptionKey: "publicApprovalDescription",
        icon: EarthLockIcon,
    },
    {
        id: "private",
        titleKey: "privateTitle",
        descriptionKey: "privateDescription",
        icon: LockIcon,
    },
] as const satisfies ReadonlyArray<{
    id: CalendarAccessMode
    titleKey: string
    descriptionKey: string
    icon: LucideIcon
}>

export default function CreateCalendarPage() {
    const t = useDebugTranslations("calendar.create")
    const tAccessMode = useDebugTranslations("calendar.accessMode")
    const tCommon = useDebugTranslations("common.form")
    const router = useRouter()
    const authUser = useAuthStore((state) => state.user)
    const isAuthLoading = useAuthStore((state) => state.isLoading)
    const formSchema = z.object({
        name: z
            .string({
                required_error: t("validationNameRequired"),
            })
            .trim()
            .min(
                MIN_DISPLAY_NAME_LENGTH,
                t("validationNameMin", {
                    min: MIN_DISPLAY_NAME_LENGTH,
                })
            )
            .max(
                MAX_CALENDAR_NAME_LENGTH,
                t("validationNameMax", {
                    max: MAX_CALENDAR_NAME_LENGTH,
                })
            ),
        accessMode: z
            .enum(CALENDAR_ACCESS_MODES, {
                required_error: t("validationAccessModeRequired"),
            })
            .refine(
                (value) =>
                    accessModes.some((accessMode) => accessMode.id === value),
                {
                    message: t("validationAccessModeInvalid"),
                }
            ),
    })
    type CreateCalendarFormValues = z.infer<typeof formSchema>
    const form = useForm<CreateCalendarFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            accessMode: "public_open",
        },
    })

    async function onSubmit(data: CreateCalendarFormValues) {
        if (isAuthLoading) {
            return
        }

        if (!authUser) {
            toast.error(t("signInRequired"))
            router.push("/signin")
            return
        }

        const supabase = createBrowserSupabase()
        const createdCalendar = await createCalendar(supabase, {
            name: data.name.trim(),
            accessMode: data.accessMode,
        })

        if (!createdCalendar) {
            toast.error(t("createFailed"))
            return
        }

        toast.success(t("created"))
        router.push(getCalendarPath(createdCalendar.id))
    }

    return (
        <>
            <div className="flex items-center justify-between">
                <div className="flex flex-1 flex-col gap-1.5">
                    <h2 className="text-2xl font-bold">{t("title")}</h2>
                    <p className="text-sm font-medium text-muted-foreground">
                        {t("description")}
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
                                        {t("nameLabel")}
                                    </FieldLabel>
                                    <Input
                                        id="create-calendar-name"
                                        value={field.value}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        placeholder={t("namePlaceholder")}
                                        minLength={MIN_DISPLAY_NAME_LENGTH}
                                        maxLength={MAX_CALENDAR_NAME_LENGTH}
                                        aria-invalid={fieldState.invalid}
                                    />
                                    <FieldDescription>
                                        {tCommon("requiredLengthRange", {
                                            min: MIN_DISPLAY_NAME_LENGTH,
                                            max: MAX_CALENDAR_NAME_LENGTH,
                                        })}
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
                                            {t("accessModeLabel")}
                                        </FieldLegend>
                                        <FieldDescription>
                                            {t("accessModeDescription")}
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
                                                                    <accessMode.icon className="size-5" />
                                                                    {tAccessMode(
                                                                        accessMode.titleKey
                                                                    )}
                                                                </FieldTitle>
                                                                <FieldDescription>
                                                                    {tAccessMode(
                                                                        accessMode.descriptionKey
                                                                    )}
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
                            disabled={
                                form.formState.isSubmitting || isAuthLoading
                            }
                        >
                            {form.formState.isSubmitting && <Spinner />}
                            {t("submit")}
                        </Button>
                    </FieldGroup>
                </form>
            </div>
        </>
    )
}
