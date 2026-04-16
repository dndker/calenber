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
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { AuthFormShell } from "./auth-form-shell"
import { GoogleButton } from "./google-sign-in-button"

const signUpSchema = z
    .object({
        name: z
            .string()
            .min(2, "이름은 2자 이상이어야 합니다.")
            .max(40, "이름은 40자 이하여야 합니다."),
        email: z.string().email("올바른 이메일 주소를 입력해 주세요."),
        password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
        confirmPassword: z.string().min(8, "비밀번호 확인을 입력해 주세요."),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "비밀번호가 일치하지 않습니다.",
        path: ["confirmPassword"],
    })

type SignUpValues = z.infer<typeof signUpSchema>

export function SignUpForm() {
    const router = useRouter()
    const routeToPostAuthCalendar = useRouteToPostAuthCalendar()
    const { loading, signUpWithEmail } = useEmailAuth()
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
            await routeToPostAuthCalendar()
        }
    }

    return (
        <AuthFormShell
            title="캘린버 계정을 만들어 보세요."
            description={
                <>
                    이미 계정이 있으신가요? <Link href="/signin">로그인</Link>
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
                            <FieldLabel htmlFor="signup-name">이름</FieldLabel>
                            <Input
                                {...field}
                                id="signup-name"
                                placeholder="홍길동"
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
                                이메일
                            </FieldLabel>
                            <Input
                                {...field}
                                id="signup-email"
                                type="email"
                                placeholder="m@example.com"
                                autoComplete="email"
                                aria-invalid={fieldState.invalid}
                            />
                            <FieldDescription>
                                인증 메일을 받을 수 있는 주소를 사용해 주세요.
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
                                비밀번호
                            </FieldLabel>
                            <Input
                                {...field}
                                id="signup-password"
                                type="password"
                                placeholder="8자 이상 입력해 주세요"
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
                                비밀번호 확인
                            </FieldLabel>
                            <Input
                                {...field}
                                id="signup-confirm-password"
                                type="password"
                                placeholder="비밀번호를 다시 입력해 주세요"
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
                    이메일로 회원가입
                </Button>
            </form>

            <FieldSeparator>또는</FieldSeparator>

            <GoogleButton
                onComplete={(result) => {
                    if (result !== "success") return

                    void routeToPostAuthCalendar()
                }}
            />
        </AuthFormShell>
    )
}
