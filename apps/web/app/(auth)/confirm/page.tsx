import { AuthFormShell } from "@/components/auth/auth-form-shell"
import { ConfirmActions } from "@/components/auth/confirm-actions"
import { decodeConfirmValue } from "@/lib/auth/confirm-value"
import { Badge } from "@workspace/ui/components/badge"
import { MailIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

export default async function ConfirmPage({
    searchParams,
}: {
    searchParams: Promise<{ v?: string }>
}) {
    const t = await getTranslations("auth.confirm")
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
            title={t("title")}
            description={
                <span className="mt-1 flex flex-col items-center gap-3 text-center">
                    <Badge variant="secondary">
                        <MailIcon /> {email}
                    </Badge>
                    {t("description")}
                    <br />
                    {t("descriptionSecondary")}
                </span>
            }
        >
            <ConfirmActions email={email} />
        </AuthFormShell>
    )
}
