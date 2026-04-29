"use client"

import { useSignOut } from "@/hooks/use-sign-out"
import { Button } from "@workspace/ui/components/button"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"

export function GoogleSignOutButton() {
    const { signOut, loading } = useSignOut()
    const t = useDebugTranslations("auth.account")

    return (
        <Button
            onClick={signOut}
            loading={loading}
            variant="outline"
            type="button"
            size="lg"
            className="leading-[normal] font-semibold"
        >
            {t("googleSignOut")}
        </Button>
    )
}
