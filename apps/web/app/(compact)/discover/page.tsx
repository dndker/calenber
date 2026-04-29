import { CalendarPlusIcon, CompassIcon } from "lucide-react"

import { EmptyBlock } from "@/components/empty-block"
import { getAllCalendars } from "@/lib/calendar/queries"
import { createServerSupabase } from "@/lib/supabase/server"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Card, CardHeader } from "@workspace/ui/components/card"
import { getTranslations } from "next-intl/server"
import Link from "next/link"

const DiscoverPage = async () => {
    const t = await getTranslations("discover")
    const supabase = await createServerSupabase()
    const discoverCalendars = (await getAllCalendars(supabase)) || []

    return (
        <>
            <div className="flex items-center justify-between">
                <div className="flex flex-1 flex-col gap-1.5">
                    <h2 className="text-2xl font-bold">{t("title")}</h2>
                    <p className="text-sm font-medium text-muted-foreground">
                        {t("description")}
                    </p>
                </div>
                <div>
                    <Button asChild>
                        <Link href="/create/calendar">
                            <CalendarPlusIcon /> {t("createCalendar")}
                        </Link>
                    </Button>
                </div>
            </div>
            <div className="flex flex-col gap-3">
                {discoverCalendars.length === 0 ? (
                    <EmptyBlock
                        icon={CalendarPlusIcon}
                        title={t("emptyTitle")}
                        description={t("emptyDescription")}
                        action={
                            <Button asChild>
                                <Link href="/create/calendar">
                                    <CalendarPlusIcon /> {t("emptyAction")}
                                </Link>
                            </Button>
                        }
                    />
                ) : (
                    discoverCalendars.map((calendar) => (
                        <Card key={calendar.id}>
                            <CardHeader className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <Avatar size="lg">
                                        <AvatarImage
                                            src={
                                                calendar.avatarUrl || undefined
                                            }
                                            alt={calendar.name}
                                        />
                                        <AvatarFallback className="text-xs">
                                            {calendar?.name?.[0]?.toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col gap-0.5">
                                        <p className="flex items-center gap-1 text-sm font-medium">
                                            {calendar.name}
                                        </p>
                                        <span className="text-sm text-muted-foreground">
                                            {calendar.creatorName}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" asChild>
                                        <Link href={`/calendar/${calendar.id}`}>
                                            <CompassIcon />
                                            {t("browse")}
                                        </Link>
                                    </Button>
                                </div>
                            </CardHeader>
                        </Card>
                    ))
                )}
            </div>
        </>
    )
}

export default DiscoverPage
