"use client"

import { useEmailAuth } from "@/hooks/use-email-auth"
import { useRouteToPostAuthCalendar } from "@/hooks/use-route-to-post-auth-calendar"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@workspace/ui/components/button"
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
    FieldSeparator,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import Link from "next/link"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { AuthFormShell } from "./auth-form-shell"
import { GoogleButton } from "./google-sign-in-button"

export function SignUpForm() {
    const t = useDebugTranslations("auth.signUp")
    const tValidation = useDebugTranslations("auth.validation")
    const router = useRouter()
    const routeToPostAuthCalendar = useRouteToPostAuthCalendar()
    const { loading, signUpWithEmail } = useEmailAuth()
    const signUpSchema = z
        .object({
            name: z
                .string()
                .min(2, tValidation("nameMin"))
                .max(40, tValidation("nameMax")),
            email: z.string().email(tValidation("invalidEmail")),
            password: z.string().min(8, tValidation("passwordMin")),
            confirmPassword: z
                .string()
                .min(8, tValidation("confirmPasswordMin")),
        })
        .refine((data) => data.password === data.confirmPassword, {
            message: tValidation("passwordMismatch"),
            path: ["confirmPassword"],
        })
    type SignUpValues = z.infer<typeof signUpSchema>
    const form = useForm<SignUpValues>({
        resolver: zodResolver(signUpSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            confirmPassword: "",
        },
    })

    const onSubmit = async ({ name, email, password }: SignUpValues) => {
        const result = await signUpWithEmail({
            name,
            email,
            password,
        })

        if (
            result.ok &&
            result.requiresEmailVerification &&
            result.confirmValue
        ) {
            router.replace(
                `/confirm?v=${encodeURIComponent(result.confirmValue)}`
            )
            return
        }

        if (result.ok && !result.requiresEmailVerification) {
            await routeToPostAuthCalendar(result.user)
        }
    }

    return (
        <AuthFormShell
            title={t("title")}
            description={
                <>
                    {t("description")}{" "}
                    <Link href="/signin">{t("signInLink")}</Link>
                </>
            }
        >
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                noValidate
                className="flex flex-col gap-5"
            >
                <Controller
                    name="name"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="signup-name">
                                {t("nameLabel")}
                            </FieldLabel>
                            <Input
                                {...field}
                                id="signup-name"
                                placeholder={t("namePlaceholder")}
                                autoComplete="name"
                                aria-invalid={fieldState.invalid}
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="signup-email">
                                {t("emailLabel")}
                            </FieldLabel>
                            <Input
                                {...field}
                                id="signup-email"
                                type="email"
                                placeholder={t("emailPlaceholder")}
                                autoComplete="email"
                                aria-invalid={fieldState.invalid}
                            />
                            <FieldDescription>
                                {t("emailDescription")}
                            </FieldDescription>
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Controller
                    name="password"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="signup-password">
                                {t("passwordLabel")}
                            </FieldLabel>
                            <Input
                                {...field}
                                id="signup-password"
                                type="password"
                                placeholder={t("passwordPlaceholder")}
                                autoComplete="new-password"
                                aria-invalid={fieldState.invalid}
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Controller
                    name="confirmPassword"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="signup-confirm-password">
                                {t("confirmPasswordLabel")}
                            </FieldLabel>
                            <Input
                                {...field}
                                id="signup-confirm-password"
                                type="password"
                                placeholder={t("confirmPasswordPlaceholder")}
                                autoComplete="new-password"
                                aria-invalid={fieldState.invalid}
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Button
                    type="submit"
                    size="lg"
                    className="font-bold"
                    loading={loading}
                >
                    {t("submit")}
                </Button>
            </form>

            <FieldSeparator>{t("divider")}</FieldSeparator>

            <GoogleButton
                onComplete={(result, nextPath) => {
                    if (result !== "success") return

                    if (nextPath) {
                        router.replace(nextPath)
                        return
                    }

                    void routeToPostAuthCalendar()
                }}
            />
        </AuthFormShell>
    )
}
