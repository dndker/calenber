"use client"

import { useSettingsModal } from "@/components/settings/settings-modal-provider"
import { useSignOut } from "@/hooks/use-sign-out"
import { getCalendarPath } from "@/lib/calendar/routes"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
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
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { memo, useMemo, useState } from "react"

export const NavUser = memo(function NavUser({ user }: { user: AppUser }) {
    const { isMobile } = useSidebar()
    const pathname = usePathname()
    const isLoggedIn = useAuthStore((s) => s.user != null)
    const { signOut } = useSignOut()
    const { openSettings } = useSettingsModal()
    const myCalendars = useCalendarStore((s) => s.myCalendars)
    const activeCalendar = useCalendarStore((s) => s.activeCalendar)
    const activeCalendarMembership = useCalendarStore(
        (s) => s.activeCalendarMembership
    )
    const router = useRouter()
    const [isMenuOpen, setIsMenuOpen] = useState(false)

    const displayCalendar = useMemo(
        () =>
            activeCalendar ?? {
                id: "calendar-home",
                name: pathname === "/calendar" ? "캘린더" : "알 수 없는 캘린더",
                role: null,
                avatarUrl: null,
                accessMode: "public_open" as const,
                eventLayout: "compact" as const,
                updatedAt: "",
                createdAt: "",
            },
        [activeCalendar, pathname]
    )

    const handleSignOut = async () => {
        const result = await signOut()
        if (result.ok) {
            router.push("/signin")
        }
    }

    const handleOpenSettings = () => {
        setIsMenuOpen(false)
        openSettings("profile")
    }

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            disabled={!isLoggedIn}
                            size="lg"
                            className="opacity-100! data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <Avatar className="h-8 w-8 rounded-lg after:rounded-lg">
                                <AvatarImage
                                    className="rounded-lg"
                                    src={displayCalendar.avatarUrl ?? undefined}
                                    alt={displayCalendar.name}
                                />
                                <AvatarFallback className="rounded-lg">
                                    {displayCalendar.name[0]}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">
                                    {displayCalendar.name}
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
                                                className="rounded-lg"
                                                src={
                                                    displayCalendar.avatarUrl ??
                                                    undefined
                                                }
                                                alt={displayCalendar.name}
                                            />
                                            <AvatarFallback className="rounded-lg">
                                                {displayCalendar.name[0]}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="grid flex-1 text-left text-sm leading-tight">
                                            <span className="truncate font-medium text-primary">
                                                {displayCalendar.name}
                                            </span>
                                            <span className="truncate text-xs">
                                                {activeCalendarMembership.role ??
                                                    user.name}
                                            </span>
                                        </div>
                                    </div>
                                    {activeCalendarMembership.isMember && (
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleOpenSettings}
                                            >
                                                <Settings />
                                                설정
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setIsMenuOpen(false)
                                                }
                                            >
                                                <UserPlus />
                                                멤버 초대
                                            </Button>
                                        </div>
                                    )}
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
                                                <DropdownMenuItem asChild>
                                                    <Link href="/discover">
                                                        <PlusSquare />
                                                        캘린더 생성 또는 참여
                                                    </Link>
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
                                {myCalendars.map((calendar, index) => (
                                    <DropdownMenuCheckboxItem
                                        checked={
                                            activeCalendar?.id === calendar.id
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
                                                className="rounded-lg"
                                                src={
                                                    calendar.avatarUrl ??
                                                    undefined
                                                }
                                                alt={calendar.name[0]}
                                            />
                                            <AvatarFallback className="rounded-md text-xs">
                                                {calendar.name[0]}
                                            </AvatarFallback>
                                        </Avatar>

                                        {calendar.name}
                                        {activeCalendar?.id !== calendar.id && (
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
