"use client"

import { useEmailAuth } from "@/hooks/use-email-auth"
import { Button } from "@workspace/ui/components/button"
import Link from "next/link"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"

export function ConfirmActions({ email }: { email: string }) {
    const { loading, resendConfirmationEmail } = useEmailAuth()
    const t = useDebugTranslations("auth.confirm")

    const handleResend = async () => {
        await resendConfirmationEmail(email)
    }

    return (
        <div className="flex flex-col gap-3">
            <Button
                type="button"
                size="lg"
                className="font-bold"
                loading={loading}
                onClick={handleResend}
            >
                {t("resend")}
            </Button>

            <Button asChild size="lg" variant="outline" className="font-bold">
                <Link href="/signin">{t("goToSignIn")}</Link>
            </Button>
        </div>
    )
}
