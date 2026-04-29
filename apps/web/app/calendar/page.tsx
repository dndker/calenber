import { getServerUser } from "@/lib/auth/get-server-user"
import { createCalendar } from "@/lib/calendar/mutations"
import { getLatestCalendarIdForUser } from "@/lib/calendar/queries"
import { getCalendarPath } from "@/lib/calendar/routes"
import { createServerSupabase } from "@/lib/supabase/server"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

export default async function Page() {
    const t = await getTranslations("navigation.defaults")
    const user = await getServerUser()

    if (!user) {
        redirect("/calendar/demo")
    }

    const supabase = await createServerSupabase()
    const calendarId = await getLatestCalendarIdForUser(supabase, user.id)

    if (calendarId) {
        redirect(getCalendarPath(calendarId))
    }

    const createdCalendar = await createCalendar(supabase, {
        name: t("myCalendar"),
        accessMode: "private",
    })

    redirect(
        createdCalendar ? getCalendarPath(createdCalendar.id) : "/calendar/demo"
    )
}
