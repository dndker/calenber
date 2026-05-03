"use client"

import { getSupabaseAuthErrorMessage } from "@/lib/auth/supabase-error"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { Button } from "@workspace/ui/components/button"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

type GoogleButtonProps = {
    label: string
    onComplete?: (
        result: "success" | "cancel" | "error",
        nextPath?: string
    ) => void | Promise<void>
}

type GoogleAuthMessage = {
    type: "google-auth-complete"
    ok: boolean
    next: string
    error: string | null
}

export function GoogleButton({ label, onComplete }: GoogleButtonProps) {
    const [loading, setLoading] = useState(false)
    const popupRef = useRef<Window | null>(null)
    const popupMonitorRef = useRef<number | null>(null)
    const completedRef = useRef(false)
    const t = useDebugTranslations("auth.toast")
    const tError = useDebugTranslations("auth.errors")

    useEffect(() => {
        return () => {
            if (popupMonitorRef.current) {
                window.clearInterval(popupMonitorRef.current)
            }

            popupRef.current?.close()
        }
    }, [])

    const signin = async () => {
        completedRef.current = false

        const width = 500
        const height = 600
        const screenLeft = window.screenLeft ?? window.screenX
        const screenTop = window.screenTop ?? window.screenY
        const viewportWidth =
            window.innerWidth || document.documentElement.clientWidth
        const viewportHeight =
            window.innerHeight || document.documentElement.clientHeight
        const left = screenLeft + (viewportWidth - width) / 2
        const top = screenTop + (viewportHeight - height) / 2

        if (popupMonitorRef.current) {
            window.clearInterval(popupMonitorRef.current)
            popupMonitorRef.current = null
        }

        const handleMessage = (event: MessageEvent<GoogleAuthMessage>) => {
            if (completedRef.current) {
                return
            }

            if (event.origin !== window.location.origin) {
                return
            }

            if (event.data?.type !== "google-auth-complete") {
                return
            }

            window.removeEventListener("message", handleMessage)

            if (popupMonitorRef.current) {
                window.clearInterval(popupMonitorRef.current)
                popupMonitorRef.current = null
            }

            completedRef.current = true
            popupRef.current = null

            if (!event.data.ok) {
                toast.error(event.data.error || t("googleFailed"))
                onComplete?.("error")
                return
            }

            toast.success(t("googleCompleted"))
            void onComplete?.("success", event.data.next)
        }

        window.addEventListener("message", handleMessage)
        popupRef.current?.close()

        setLoading(true)

        const supabase = createBrowserSupabase()

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${location.origin}/auth/callback`,
                skipBrowserRedirect: true,
                // scopes: "openid email profile https://www.googleapis.com/auth/calendar",
            },
        })

        if (error) {
            window.removeEventListener("message", handleMessage)
            console.error(error)
            toast.error(
                getSupabaseAuthErrorMessage(error, tError, "googleFailed")
            )
            onComplete?.("error")
            setLoading(false)
            return
        }

        if (!data?.url) {
            window.removeEventListener("message", handleMessage)
            toast.error(t("googleUrlMissing"))
            onComplete?.("error")
            setLoading(false)
            return
        }

        const popup = window.open(
            data.url,
            "google-oauth-popup",
            `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)}`
        )

        if (!popup) {
            window.removeEventListener("message", handleMessage)
            toast.error(t("googlePopupBlocked"))
            onComplete?.("error")
            setLoading(false)
            return
        }

        popupRef.current = popup

        popupMonitorRef.current = window.setInterval(() => {
            const authPopup = popupRef.current

            if (!authPopup) {
                return
            }

            if (authPopup.closed) {
                if (completedRef.current) {
                    return
                }

                if (popupMonitorRef.current) {
                    window.clearInterval(popupMonitorRef.current)
                    popupMonitorRef.current = null
                }

                completedRef.current = true
                popupRef.current = null
                window.removeEventListener("message", handleMessage)
                toast.warning(t("googleCancelled"))
                onComplete?.("cancel")
                return
            }
        }, 500)

        setLoading(false)
    }

    return (
        <Button
            onClick={signin}
            loading={loading}
            variant="outline"
            type="button"
            size="lg"
            className="leading-[normal] font-semibold"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                height="24"
                viewBox="0 0 24 24"
                width="24"
            >
                <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                />
                <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                />
                <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                />
                <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                />
                <path d="M1 1h22v22H1z" fill="none" />
            </svg>
            {label}
        </Button>
    )
}
