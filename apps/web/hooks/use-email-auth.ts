"use client"

import { encodeConfirmValue } from "@/lib/auth/confirm-value"
import { getSupabaseAuthErrorMessage } from "@/lib/auth/supabase-error"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { useState } from "react"
import { toast } from "sonner"

type AuthResult = {
    ok: boolean
    error: string | null
    user?: User | null
    requiresEmailVerification?: boolean
    confirmValue?: string | null
}

export function useEmailAuth() {
    const [loading, setLoading] = useState(false)
    const t = useDebugTranslations("auth.toast")
    const tError = useDebugTranslations("auth.errors")

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
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                const message = getSupabaseAuthErrorMessage(
                    error,
                    tError,
                    "signInFailed"
                )

                toast.error(message)
                return { ok: false, error: message }
            }

            toast.success(t("signedIn"))
            return { ok: true, error: null, user: data.user }
        } catch (error) {
            // console.error(error)
            const message = t("signInUnexpected")
            toast.error(message)
            return { ok: false, error: message }
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
                    tError,
                    "signUpFailed"
                )

                toast.error(message)
                return { ok: false, error: message }
            }

            if (!data.session) {
                toast.success(t("signUpNeedsVerification"))
                return {
                    ok: true,
                    error: null,
                    user: data.user,
                    requiresEmailVerification: true,
                    confirmValue: encodeConfirmValue(email),
                }
            }

            toast.success(t("signedUp"))
            return {
                ok: true,
                error: null,
                user: data.user,
                confirmValue: null,
            }
        } catch (error) {
            console.error(error)
            const message = t("signUpUnexpected")
            toast.error(message)
            return { ok: false, error: message }
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
                    tError,
                    "resendFailed"
                )
                toast.error(message)
                return { ok: false, error: message }
            }

            toast.success(t("resent"))
            return { ok: true, error: null }
        } catch (error) {
            console.error(error)
            const message = t("resendUnexpected")
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
