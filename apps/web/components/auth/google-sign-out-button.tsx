"use client"

import { useSignOut } from "@/hooks/use-sign-out"
import { Button } from "@workspace/ui/components/button"

export function GoogleSignOutButton() {
    const { signOut, loading } = useSignOut()

    return (
        <Button
            onClick={signOut}
            loading={loading}
            variant="outline"
            type="button"
            size="lg"
            className="leading-normal font-semibold"
        >
            구글 계정 로그아웃
        </Button>
    )
}
