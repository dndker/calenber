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

    if (user) {
        redirect("/calendar")
    }

    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
            <div className="w-full max-w-sm">{children}</div>
        </div>
    )
}
