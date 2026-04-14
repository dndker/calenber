"use client"

import { getSupabaseAuthErrorMessage } from "@/lib/auth/supabase-error"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { useState } from "react"
import { toast } from "sonner"

type SignOutResult = {
    ok: boolean
    error: string | null
}

export function useSignOut() {
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<SignOutResult | null>(null)

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
                    error: getSupabaseAuthErrorMessage(
                        error,
                        "로그아웃 중 오류가 발생했습니다."
                    ),
                }

                setResult(nextResult)
                toast.error(nextResult.error)
                return nextResult
            }

            toast.success("로그아웃되었습니다.")
            const nextResult = { ok: true, error: null }
            setResult(nextResult)
            return nextResult
        } catch (error) {
            console.error(error)
            const nextResult = {
                ok: false,
                error: "로그아웃 중 오류가 발생했습니다.",
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
