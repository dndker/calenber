import { createServerSupabase } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function Layout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createServerSupabase()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
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
