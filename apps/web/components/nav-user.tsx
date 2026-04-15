"use client"

import {
    SettingsModal,
    type SettingsTabId,
} from "@/components/settings/settings-modal"
import { useSignOut } from "@/hooks/use-sign-out"
import type { MyCalendarItem } from "@/lib/calendar/queries"
import { getCalendarPath } from "@/lib/calendar/routes"
import { useAuthStore } from "@/store/useAuthStore"
import { AppUser } from "@workspace/lib/supabase/map-user"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@workspace/ui/components/sidebar"
import {
    BadgeCheckIcon,
    BellIcon,
    ChevronsUpDownIcon,
    CreditCardIcon,
    LogOut,
    LogOutIcon,
    MoreHorizontal,
    PlusSquare,
    Settings,
    SparklesIcon,
    UserPlus,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { memo, useMemo, useState } from "react"

const DEMO_CALENDAR: MyCalendarItem = {
    id: "demo",
    name: "데모 캘린더",
    role: null,
    avatarUrl: null,
    updatedAt: "",
    createdAt: "",
}

export const NavUser = memo(function NavUser({
    user,
    calendars,
}: {
    user: AppUser
    calendars: MyCalendarItem[]
}) {
    const { isMobile } = useSidebar()
    const pathname = usePathname()
    const isLoggedIn = useAuthStore((s) => s.user != null)
    const { signOut } = useSignOut()
    const router = useRouter()
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [settingsInitialTab, setSettingsInitialTab] =
        useState<SettingsTabId>("profile")

    const activeCalendar = useMemo(() => {
        if (pathname === "/calendar") {
            return DEMO_CALENDAR
        }

        const pathnameCalendarId = pathname.startsWith("/calendar/")
            ? (pathname.split("/")[2] ?? null)
            : null

        if (!pathnameCalendarId) {
            return calendars[0] ?? DEMO_CALENDAR
        }

        return (
            calendars.find((calendar) => calendar.id === pathnameCalendarId) ??
            calendars[0] ??
            DEMO_CALENDAR
        )
    }, [calendars, pathname])

    if (!activeCalendar) {
        return null
    }

    const handleSignOut = async () => {
        const result = await signOut()
        if (result.ok) {
            router.push("/signin")
        }
    }

    const openSettings = (initialTab: SettingsTabId) => {
        setIsMenuOpen(false)
        setSettingsInitialTab(initialTab)
        setIsSettingsOpen(true)
    }

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SettingsModal
                    open={isSettingsOpen}
                    onOpenChange={setIsSettingsOpen}
                    initialTab={settingsInitialTab}
                />
                <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <Avatar className="h-8 w-8 rounded-lg after:rounded-lg">
                                <AvatarImage
                                    src={activeCalendar.avatarUrl || ""}
                                    alt={activeCalendar.name}
                                />
                                <AvatarFallback className="rounded-lg">
                                    {activeCalendar.name[0]}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">
                                    {activeCalendar.name}
                                </span>
                                {/* <span className="truncate text-xs">
                                    {user.email}
                                </span> */}
                            </div>
                            {isLoggedIn && (
                                <ChevronsUpDownIcon className="ml-auto size-4" />
                            )}
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    {isLoggedIn && (
                        <DropdownMenuContent
                            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                            side={isMobile ? "bottom" : "right"}
                            align="start"
                            sideOffset={4}
                        >
                            <DropdownMenuLabel className="p-0 font-normal">
                                <div className="flex flex-col gap-2 p-1">
                                    <div className="flex items-center gap-2 text-left text-sm">
                                        <Avatar className="h-8 w-8 rounded-lg after:rounded-lg">
                                            <AvatarImage
                                                src={user.avatarUrl || ""}
                                                alt={activeCalendar.name}
                                            />
                                            <AvatarFallback className="rounded-lg">
                                                {activeCalendar.name[0]}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="grid flex-1 text-left text-sm leading-tight">
                                            <span className="truncate font-medium text-primary">
                                                {activeCalendar.name}
                                            </span>
                                            <span className="truncate text-xs">
                                                {user.name}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => openSettings("profile")}
                                        >
                                            <Settings />
                                            설정
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            <UserPlus />
                                            맴버 초대
                                        </Button>
                                    </div>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuLabel className="flex items-center justify-between pr-0.5! text-xs text-muted-foreground">
                                    <div>{user.email}</div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="size-6"
                                            >
                                                <MoreHorizontal />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-auto">
                                            <DropdownMenuGroup>
                                                <DropdownMenuItem>
                                                    <PlusSquare />
                                                    캘린더 생성 또는 참여
                                                </DropdownMenuItem>
                                            </DropdownMenuGroup>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuGroup>
                                                <DropdownMenuItem
                                                    onClick={handleSignOut}
                                                >
                                                    <LogOut />
                                                    로그아웃
                                                </DropdownMenuItem>
                                            </DropdownMenuGroup>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </DropdownMenuLabel>
                                {calendars.map((calendar, index) => (
                                    <DropdownMenuCheckboxItem
                                        checked={
                                            activeCalendar.id === calendar.id
                                        }
                                        key={calendar.id}
                                        onSelect={() => {
                                            setIsMenuOpen(false)
                                            router.push(
                                                getCalendarPath(calendar.id)
                                            )
                                        }}
                                        className="gap-2 p-2"
                                    >
                                        <Avatar className="size-6 rounded-md after:rounded-md">
                                            <AvatarImage
                                                src={calendar.avatarUrl || ""}
                                                alt={calendar.name[0]}
                                            />
                                            <AvatarFallback className="rounded-md text-xs">
                                                {calendar.name[0]}
                                            </AvatarFallback>
                                        </Avatar>

                                        {calendar.name}
                                        {activeCalendar.id !== calendar.id && (
                                            <DropdownMenuShortcut>
                                                ⌘{index + 1}
                                            </DropdownMenuShortcut>
                                        )}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuItem className="p-2">
                                    <SparklesIcon />
                                    Upgrade to Pro
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuItem className="p-2">
                                    <BadgeCheckIcon />
                                    Account
                                </DropdownMenuItem>
                                <DropdownMenuItem className="p-2">
                                    <CreditCardIcon />
                                    Billing
                                </DropdownMenuItem>
                                <DropdownMenuItem className="p-2">
                                    <BellIcon />
                                    Notifications
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="p-2"
                                onClick={handleSignOut}
                            >
                                <LogOutIcon />
                                로그아웃
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    )}
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
})
