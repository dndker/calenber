import { createServerSupabase } from "@/lib/supabase/server"
import { fetchNotifications } from "@/lib/notification/queries"
import { NotificationsPageClient } from "./notifications-page-client"
import { redirect } from "next/navigation"
import { getServerUser } from "@/lib/auth/get-server-user"

export default async function NotificationsPage() {
    const user = await getServerUser()
    if (!user) redirect("/signin")

    const supabase = await createServerSupabase()
    const { digests, hasMore } = await fetchNotifications(supabase, { limit: 30 })

    return <NotificationsPageClient initialDigests={digests} initialHasMore={hasMore} />
}
