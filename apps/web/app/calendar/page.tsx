import { getServerUser } from "@/lib/auth/get-server-user"
import { createCalendar } from "@/lib/calendar/mutations"
import { resolveServerCalendarPath } from "@/lib/calendar/resolve-server-calendar-path"
import { getCalendarPath } from "@/lib/calendar/routes"
import { createServerSupabase } from "@/lib/supabase/server"
import { getTranslations } from "next-intl/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function Page() {
    const [t, cookieStore, user, supabase] = await Promise.all([
        getTranslations("navigation.defaults"),
        cookies(),
        getServerUser(),
        createServerSupabase(),
    ])

    if (!user) {
        redirect("/calendar/demo")
    }

    const existingCalendarPath = await resolveServerCalendarPath({
        supabase,
        userId: user.id,
        cookieStore,
        fallbackPath: "/calendar",
    })

    if (existingCalendarPath !== "/calendar") {
        redirect(existingCalendarPath)
    }

    const createdCalendar = await createCalendar(supabase, {
        name: t("myCalendar"),
        accessMode: "private",
    })

    redirect(
        createdCalendar ? getCalendarPath(createdCalendar.id) : "/calendar/demo"
    )
}
