"use client"

import { useEmailAuth } from "@/hooks/use-email-auth"
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
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { AuthFormShell } from "./auth-form-shell"
import { GoogleButton } from "./google-sign-in-button"

const signInSchema = z.object({
    email: z.string().email("올바른 이메일 주소를 입력해 주세요."),
    password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
})

type SignInValues = z.infer<typeof signInSchema>

function getAuthErrorMessage(error: string | null) {
    switch (error) {
        case "invalid_confirmation_link":
            return "유효하지 않은 인증 링크입니다."
        case "email_verification_failed":
            return "이메일 인증에 실패했습니다. 다시 시도해 주세요."
        case "access_denied":
            return "이메일 인증 링크가 유효하지 않거나 만료되었습니다."
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
    const router = useRouter()
    const { loading, signInWithEmail } = useEmailAuth()
    const form = useForm<SignInValues>({
        resolver: zodResolver(signInSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    })
    const authAlertError = getAuthErrorMessage(initialError)

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
            router.replace("/calendar")
            router.refresh()
        }
    }

    return (
        <AuthFormShell
            title="캘린버에 오신 것을 환영합니다."
            description={
                <>
                    아직 계정이 없으신가요? <Link href="/signup">회원가입</Link>
                </>
            }
        >
            {authAlertError && (
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircleIcon />
                    <AlertTitle>인증 링크 오류</AlertTitle>
                    <AlertDescription>{authAlertError}</AlertDescription>
                </Alert>
            )}
            {initialVerified && !authAlertError && (
                <Alert className="max-w-md">
                    <CheckCircle2Icon />
                    <AlertTitle>이메일 인증 완료</AlertTitle>
                    <AlertDescription>
                        {initialNotice === "email_confirmed_login_required"
                            ? "이메일 인증은 완료되었습니다. 인증을 진행했던 브라우저가 달라 다시 로그인 해주세요."
                            : "이메일 인증이 완료되었습니다."}
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
                                placeholder="이메일"
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
                                placeholder="비밀번호"
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
                    이메일로 로그인
                </Button>
            </form>

            <FieldSeparator>또는</FieldSeparator>

            <GoogleButton
                onComplete={(result) => {
                    if (result === "success") {
                        router.replace("/calendar")
                        router.refresh()
                    }
                }}
            />
        </AuthFormShell>
    )
}
