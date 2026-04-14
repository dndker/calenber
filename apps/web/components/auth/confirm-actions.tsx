"use client"

import { useEmailAuth } from "@/hooks/use-email-auth"
import { Button } from "@workspace/ui/components/button"
import Link from "next/link"

export function ConfirmActions({ email }: { email: string }) {
    const { loading, resendConfirmationEmail } = useEmailAuth()

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
                인증 메일 다시 보내기
            </Button>

            <Button asChild size="lg" variant="outline" className="font-bold">
                <Link href="/signin">로그인 페이지로 이동</Link>
            </Button>
        </div>
    )
}
