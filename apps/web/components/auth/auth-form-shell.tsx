import {
    FieldDescription,
    FieldGroup,
} from "@workspace/ui/components/field"
import { cn } from "@workspace/ui/lib/utils"
import Image from "next/image"
import Link from "next/link"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"

type AuthFormShellProps = React.ComponentProps<"div"> & {
    title: string
    description: React.ReactNode
    children: React.ReactNode
}

export function AuthFormShell({
    className,
    title,
    description,
    children,
    ...props
}: AuthFormShellProps) {
    const t = useDebugTranslations("auth.legal")
    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <div className="flex flex-col items-center gap-2 text-center">
                <Link
                    href="/"
                    className="flex flex-col items-center gap-2 font-medium"
                >
                    <div className="flex size-8 items-center justify-center rounded-md">
                        <Image
                            src="/logo.png"
                            alt="Calenber"
                            width={28}
                            height={28}
                        />
                    </div>
                    <span className="sr-only">Calenber</span>
                </Link>
                <h1 className="text-xl font-bold">{title}</h1>
                <FieldDescription>{description}</FieldDescription>
            </div>

            <FieldGroup>{children}</FieldGroup>

            <FieldDescription className="px-6 text-center">
                {t("continuePrefix")} <br />
                <a href="#">{t("terms")}</a> {t("and")}{" "}
                <a href="#">{t("privacy")}</a>
                {t("agreeSuffix")}
            </FieldDescription>
        </div>
    )
}
