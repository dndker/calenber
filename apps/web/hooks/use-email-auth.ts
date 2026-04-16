"use client"

import { encodeConfirmValue } from "@/lib/auth/confirm-value"
import { getSupabaseAuthErrorMessage } from "@/lib/auth/supabase-error"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { useState } from "react"
import { toast } from "sonner"

type AuthResult = {
    ok: boolean
    error: string | null
    requiresEmailVerification?: boolean
    confirmValue?: string | null
}

export function useEmailAuth() {
    const [loading, setLoading] = useState(false)

    const getEmailRedirectTo = () =>
        `${window.location.origin}/auth/confirm?next=/signin`

    const signInWithEmail = async ({
        email,
        password,
    }: {
        email: string
        password: string
    }): Promise<AuthResult> => {
        setLoading(true)

        try {
            const supabase = createBrowserSupabase()
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                const message = getSupabaseAuthErrorMessage(
                    error,
                    "이메일 로그인에 실패했습니다."
                )

                toast.error(message)
                return { ok: false, error: message }
            }

            toast.success("로그인되었습니다.")
            return { ok: true, error: null }
        } catch (error) {
            // console.error(error)
            toast.error("이메일 로그인 중 오류가 발생했습니다.")
            return { ok: false, error: "이메일 로그인 중 오류가 발생했습니다." }
        } finally {
            setLoading(false)
        }
    }

    const signUpWithEmail = async ({
        email,
        password,
        name,
    }: {
        email: string
        password: string
        name: string
    }): Promise<AuthResult> => {
        setLoading(true)

        try {
            const supabase = createBrowserSupabase()
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: getEmailRedirectTo(),
                    data: {
                        name,
                    },
                },
            })

            if (error) {
                const message = getSupabaseAuthErrorMessage(
                    error,
                    "회원가입에 실패했습니다."
                )

                toast.error(message)
                return { ok: false, error: message }
            }

            if (!data.session) {
                toast.success("인증 메일을 확인해 주세요.")
                return {
                    ok: true,
                    error: null,
                    requiresEmailVerification: true,
                    confirmValue: encodeConfirmValue(email),
                }
            }

            toast.success("회원가입이 완료되었습니다.")
            return { ok: true, error: null, confirmValue: null }
        } catch (error) {
            console.error(error)
            toast.error("회원가입 중 오류가 발생했습니다.")
            return { ok: false, error: "회원가입 중 오류가 발생했습니다." }
        } finally {
            setLoading(false)
        }
    }

    const resendConfirmationEmail = async (
        email: string
    ): Promise<AuthResult> => {
        setLoading(true)

        try {
            const supabase = createBrowserSupabase()
            const { error } = await supabase.auth.resend({
                type: "signup",
                email,
                options: {
                    emailRedirectTo: getEmailRedirectTo(),
                },
            })

            if (error) {
                const message = getSupabaseAuthErrorMessage(
                    error,
                    "인증 메일을 다시 보내지 못했습니다."
                )
                toast.error(message)
                return { ok: false, error: message }
            }

            toast.success("인증 메일을 다시 보냈습니다.")
            return { ok: true, error: null }
        } catch (error) {
            console.error(error)
            const message = "인증 메일 재전송 중 오류가 발생했습니다."
            toast.error(message)
            return { ok: false, error: message }
        } finally {
            setLoading(false)
        }
    }

    return {
        loading,
        signInWithEmail,
        signUpWithEmail,
        resendConfirmationEmail,
    }
}
