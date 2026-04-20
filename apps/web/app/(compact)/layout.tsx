import { getServerUser } from "@/lib/auth/get-server-user"
import { redirect } from "next/navigation"

export default async function Layout({
    children,
}: {
    children: React.ReactNode
}) {
    if (!(await getServerUser())) {
        redirect("/calendar")
    }

    return (
        <div className="flex min-h-svh flex-col items-center justify-start gap-6 overflow-auto bg-background p-6 md:p-10">
            <div className="w-full max-w-sm">
                <div className="flex flex-col gap-4.5 py-[30dvh]">
                    {children}
                </div>
            </div>
        </div>
    )
}
