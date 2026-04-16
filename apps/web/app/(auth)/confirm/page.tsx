import { AuthFormShell } from "@/components/auth/auth-form-shell"
import { ConfirmActions } from "@/components/auth/confirm-actions"
import { decodeConfirmValue } from "@/lib/auth/confirm-value"
import { Badge } from "@workspace/ui/components/badge"
import { MailIcon } from "lucide-react"
import { redirect } from "next/navigation"

export default async function ConfirmPage({
    searchParams,
}: {
    searchParams: Promise<{ v?: string }>
}) {
    const { v } = await searchParams

    if (!v) {
        redirect("/")
    }

    const email = decodeConfirmValue(v)

    if (!email) {
        redirect("/")
    }

    return (
        <AuthFormShell
            title="이메일을 확인해 주세요."
            description={
                <span className="mt-1 flex flex-col items-center gap-3 text-center">
                    <Badge variant="secondary">
                        <MailIcon /> {email}
                    </Badge>
                    메일에 있는 인증 링크를 클릭하여 회원가입을 완료해 주세요.
                    <br />
                    메일이 보이지 않으면 스팸함이나 프로모션함도 함께 확인해
                    보세요.
                </span>
            }
        >
            <ConfirmActions email={email} />
        </AuthFormShell>
    )
}
