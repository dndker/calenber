"use client"

import { useEmailAuth } from "@/hooks/use-email-auth"
import { useRouteToPostAuthCalendar } from "@/hooks/use-route-to-post-auth-calendar"
import { zodResolver } from "@hookform/resolvers/zod"
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
    Field,
    FieldError,
    FieldSeparator,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react"
import Link from "next/link"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { AuthFormShell } from "./auth-form-shell"
import { GoogleButton } from "./google-sign-in-button"

function getAuthErrorCode(error: string | null) {
    switch (error) {
        case "invalid_confirmation_link":
            return "invalid_confirmation_link"
        case "email_verification_failed":
            return "email_verification_failed"
        case "access_denied":
            return "access_denied"
        default:
            return null
    }
}

export function SignInForm({
    initialError = null,
    initialVerified = false,
    initialNotice = null,
}: {
    initialError?: string | null
    initialVerified?: boolean
    initialNotice?: string | null
}) {
    const t = useDebugTranslations("auth.signIn")
    const tNotice = useDebugTranslations("auth.notice")
    const tValidation = useDebugTranslations("auth.validation")
    const router = useRouter()
    const routeToPostAuthCalendar = useRouteToPostAuthCalendar()
    const { loading, signInWithEmail } = useEmailAuth()
    const signInSchema = z.object({
        email: z.string().email(tValidation("invalidEmail")),
        password: z.string().min(8, tValidation("passwordMin")),
    })
    type SignInValues = z.infer<typeof signInSchema>
    const form = useForm<SignInValues>({
        resolver: zodResolver(signInSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    })
    const authAlertError = getAuthErrorCode(initialError)
    const translatedAuthAlertError =
        authAlertError === "invalid_confirmation_link"
            ? tNotice("invalidConfirmationLink")
            : authAlertError === "email_verification_failed"
              ? tNotice("emailVerificationFailed")
              : authAlertError === "access_denied"
                ? tNotice("accessDenied")
                : null

    const onSubmit = async (values: SignInValues) => {
        const result = await signInWithEmail(values)

        if (!result.ok && result.error) {
            form.setError("email", {
                type: "server",
                message: "",
            })
            form.setError("password", {
                type: "server",
                message: result.error,
            })
            return
        }

        if (result.ok) {
            await routeToPostAuthCalendar(result.user)
        }
    }

    return (
        <AuthFormShell
            title={t("title")}
            description={
                <>
                    {t("description")}{" "}
                    <Link href="/signup">{t("signUpLink")}</Link>
                </>
            }
        >
            {translatedAuthAlertError && (
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircleIcon />
                    <AlertTitle>{tNotice("linkErrorTitle")}</AlertTitle>
                    <AlertDescription>
                        {translatedAuthAlertError}
                    </AlertDescription>
                </Alert>
            )}
            {initialVerified && !translatedAuthAlertError && (
                <Alert className="max-w-md">
                    <CheckCircle2Icon />
                    <AlertTitle>{tNotice("verifiedTitle")}</AlertTitle>
                    <AlertDescription>
                        {initialNotice === "email_confirmed_login_required"
                            ? tNotice("emailConfirmedLoginRequired")
                            : tNotice("emailConfirmed")}
                    </AlertDescription>
                </Alert>
            )}
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                noValidate
                className="flex flex-col gap-4"
            >
                <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            {/* <FieldLabel htmlFor="signin-email">
                                이메일
                            </FieldLabel> */}
                            <Input
                                {...field}
                                id="signin-email"
                                type="email"
                                placeholder={t("emailPlaceholder")}
                                autoComplete="email"
                                aria-invalid={fieldState.invalid}
                            />
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
                            {/* <FieldLabel htmlFor="signin-password">
                                비밀번호
                            </FieldLabel> */}
                            <Input
                                {...field}
                                id="signin-password"
                                type="password"
                                placeholder={t("passwordPlaceholder")}
                                autoComplete="current-password"
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
