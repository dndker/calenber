"use client"

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
import { useState } from "react"

export function NavUser({
    user,
}: {
    user: {
        name: string
        email: string
        avatar: string
        calendars: {
            name: string
            plan: string
        }[]
    }
}) {
    const { isMobile } = useSidebar()
    const [activeTeam, setActiveTeam] = useState(user.calendars[0])

    if (!activeTeam) {
        return null
    }

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <Avatar className="h-8 w-8 rounded-lg after:rounded-lg">
                                <AvatarImage
                                    src={user.avatar}
                                    alt={activeTeam.name}
                                />
                                <AvatarFallback className="rounded-lg">
                                    {activeTeam.name[0]}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">
                                    {activeTeam.name}
                                </span>
                                {/* <span className="truncate text-xs">
                                    {user.email}
                                </span> */}
                            </div>
                            <ChevronsUpDownIcon className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
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
                                            src={user.avatar}
                                            alt={activeTeam.name}
                                        />
                                        <AvatarFallback className="rounded-lg">
                                            {activeTeam.name[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-medium">
                                            {activeTeam.name}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button size="sm" variant="outline">
                                        <Settings />
                                        설정
                                    </Button>
                                    <Button size="sm" variant="outline">
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
                                            <DropdownMenuItem>
                                                <LogOut />
                                                로그아웃
                                            </DropdownMenuItem>
                                        </DropdownMenuGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </DropdownMenuLabel>
                            {user.calendars.map((team, index) => (
                                <DropdownMenuCheckboxItem
                                    checked={activeTeam.name === team.name}
                                    key={team.name}
                                    onClick={() => setActiveTeam(team)}
                                    className="gap-2 p-2"
                                >
                                    <Avatar className="size-6 rounded-md after:rounded-md">
                                        <AvatarImage
                                            src={user.avatar}
                                            alt={team.name[0]}
                                        />
                                        <AvatarFallback className="rounded-md text-xs">
                                            {team.name[0]}
                                        </AvatarFallback>
                                    </Avatar>

                                    {team.name}
                                    {activeTeam.name !== team.name && (
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
                        <DropdownMenuItem className="p-2">
                            <LogOutIcon />
                            로그아웃
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
