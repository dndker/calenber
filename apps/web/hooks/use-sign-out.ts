"use client"

import { getSupabaseAuthErrorMessage } from "@/lib/auth/supabase-error"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { useState } from "react"
import { toast } from "sonner"

type SignOutResult = {
    ok: boolean
    error: string | null
}

export function useSignOut() {
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<SignOutResult | null>(null)
    const t = useDebugTranslations("auth.toast")
    const tError = useDebugTranslations("auth.errors")

    const signOut = async () => {
        setLoading(true)
        setResult(null)

        try {
            const supabase = createBrowserSupabase()
            const { error } = await supabase.auth.signOut()

            if (error) {
                console.error(error)
                const nextResult = {
                    ok: false,
                    error: getSupabaseAuthErrorMessage(error, tError, "signOutFailed"),
                }

                setResult(nextResult)
                toast.error(nextResult.error)
                return nextResult
            }

            toast.success(t("signedOut"))
            const nextResult = { ok: true, error: null }
            setResult(nextResult)
            return nextResult
        } catch (error) {
            console.error(error)
            const nextResult = {
                ok: false,
                error: t("signOutUnexpected"),
            }

            setResult(nextResult)
            toast.error(nextResult.error)
            return nextResult
        } finally {
            setLoading(false)
        }
    }

    return {
        signOut,
        loading,
        result,
    }
}
