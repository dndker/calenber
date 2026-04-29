"use client"

import {
    AvatarGroupDropdown,
    AvatarGroupDropdownPreview,
    getAvatarGroupBadge,
    getAvatarGroupFallbackLabel,
} from "@/components/calendar/avatar-group-dropdown"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import dayjs from "@/lib/dayjs"
import { type Locale } from "@/lib/i18n/config"
import { formatIntlDate } from "@/lib/i18n/intl-date"
import type { CalendarWorkspacePresenceMember } from "@/store/calendar-store.types"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import { Spinner } from "@workspace/ui/components/spinner"
import { useLocale } from "next-intl"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo } from "react"

const MAX_VISIBLE_MEMBERS = 4
function getPresenceCursorLabel(
    cursor:
        | {
              date: string
              type: "cell" | "event"
              eventId?: string
          }
        | null
        | undefined,
    getEventTitle?: (eventId?: string) => string | null,
    selectedDate?: number,
    calendarTimezone?: string,
    locale: Locale = "ko",
    t?: (key: string, values?: Record<string, string | number>) => string,
    dateFormats?: { sameYear: string; diffYear: string }
) {
    if (!cursor) {
        return t?.("viewingCalendar") ?? "viewingCalendar"
    }

    const cursorDate = calendarTimezone
        ? dayjs.tz(cursor.date, calendarTimezone)
        : dayjs(cursor.date)
    const myDate = selectedDate
        ? calendarTimezone
            ? dayjs.tz(selectedDate, calendarTimezone)
            : dayjs(selectedDate)
        : calendarTimezone
          ? dayjs().tz(calendarTimezone)
          : dayjs()
    const fallbackDateLabel = formatIntlDate(cursorDate.toDate(), {
        locale,
        year: myDate.year() === cursorDate.year() ? undefined : "2-digit",
        month: "numeric",
        day: "numeric",
    })

    if (cursor.type === "event") {
        const eventTitle = getEventTitle?.(cursor.eventId)

        if (eventTitle) {
            return t?.("viewingEvent", { title: eventTitle }) ?? eventTitle
        }

        return (
            t?.("viewingEventDate", {
                date:
                    dateFormats
                        ? cursorDate.format(
                              myDate.year() === cursorDate.year()
                                  ? dateFormats.sameYear
                                  : dateFormats.diffYear
                          )
                        : fallbackDateLabel,
            }) ?? fallbackDateLabel
        )
    }

    return (
        t?.("viewingDate", {
            date:
                dateFormats
                    ? cursorDate.format(
                          myDate.year() === cursorDate.year()
                              ? dateFormats.sameYear
                              : dateFormats.diffYear
                      )
                    : fallbackDateLabel,
        }) ?? fallbackDateLabel
    )
}

export function CalendarWorkspacePresenceGroup() {
    const t = useDebugTranslations("calendar.presence")
    const tCommon = useDebugTranslations("common.labels")
    const tCalendar = useDebugTranslations("calendar")
    const locale = useLocale() as Locale
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const my = useAuthStore((s) => s.user)
    const myUserId = my?.id ?? null
    const selectedDate = useCalendarStore((s) => s.selectedDate)
    const setSelectedDate = useCalendarStore((s) => s.setSelectedDate)
    const calendarTimezone = useCalendarStore((s) => s.calendarTimezone)
    const members = useCalendarStore(
        (state): CalendarWorkspacePresenceMember[] => state.workspacePresence
    )
    const events = useCalendarStore((state) => state.events)
    const isLoading = useCalendarStore(
        (state) => state.isWorkspacePresenceLoading
    )

    const myId =
        myUserId ??
        (typeof window !== "undefined"
            ? sessionStorage.getItem("calendar-workspace-anonymous-id")
            : null)

    const sortedMembers = useMemo(
        () =>
            [...members].sort((a, b) => {
                const aIsMe = myUserId ? a.userId === myUserId : a.id === myId
                const bIsMe = myUserId ? b.userId === myUserId : b.id === myId

                if (aIsMe !== bIsMe) {
                    return aIsMe ? -1 : 1
                }

                if (a.cursor?.type !== b.cursor?.type) {
                    return a.cursor?.type === "event" ? -1 : 1
                }

                return a.displayName.localeCompare(b.displayName, locale)
            }),
        [locale, members, myUserId, myId]
    )
    const eventTitleMap = useMemo(
        () =>
            new Map(
                events.map((event) => [
                    event.id,
                    event.title.trim() || tCommon("newEvent"),
                ])
            ),
        [events, tCommon]
    )
    const getEventTitle = useMemo(
        () => (eventId?: string) =>
            eventId ? (eventTitleMap.get(eventId) ?? null) : null,
        [eventTitleMap]
    )

    const items = sortedMembers.map((user) => {
        const isMe = myUserId ? user.userId === myUserId : myId === user.id

        return {
            id: user.id,
            name: user.displayName,
            avatarUrl: user.avatarUrl,
            avatarFallback: getAvatarGroupFallbackLabel(
                user.displayName,
                user.isAnonymous
            ),
            badge: isMe ? getAvatarGroupBadge(tCommon("me")) : undefined,
            time: getPresenceCursorLabel(
                user.cursor,
                getEventTitle,
                selectedDate,
                calendarTimezone,
                locale,
                t,
                {
                    sameYear: tCalendar("dateFormatMonthDay"),
                    diffYear: tCalendar("dateFormatYearMonthDay"),
                }
            ),
            onSelect: isMe
                ? undefined
                : () => {
                      setSelectedDate(
                          dayjs.tz(user.cursor?.date, calendarTimezone).toDate()
                      )

                      if (user.cursor?.eventId) {
                          const params = new URLSearchParams(
                              searchParams.toString()
                          )
                          params.set("e", user.cursor.eventId)

                          router.push(`${pathname}?${params.toString()}`)
                      }
                  },
        }
    })

    if (!isLoading && members.length === 0) {
        return null
    }

    return (
        <AvatarGroupDropdown
            items={items}
            align="end"
            contentClassName="min-w-47"
            label={sortedMembers.length > 0 ? t("onlineMembers") : undefined}
            trigger={
                <div className="flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5">
                    {isLoading && members.length === 0 ? (
                        <div className="flex size-8 items-center justify-center text-muted-foreground">
                            <Spinner
                                className="size-5"
                                aria-label={t("loadingOnlineMembers")}
                            />
                        </div>
                    ) : (
                        <div className="relative">
                            <AvatarGroupDropdownPreview
                                items={items}
                                maxVisibleAvatars={MAX_VISIBLE_MEMBERS}
                                title={items
                                    .map((member) => member.name)
                                    .join(", ")}
                            />
                            {isLoading && members.length > 0 ? (
                                <div className="absolute top-0 left-0 flex h-full w-full items-center justify-center bg-background/45 text-muted-foreground">
                                    <Spinner className="size-5" />
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            }
        />
    )
}
