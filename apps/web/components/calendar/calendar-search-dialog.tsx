"use client"

import type { CalendarMemberDirectoryItem } from "@/lib/calendar/queries"
import { getCalendarEventModalPath } from "@/lib/calendar/routes"
import {
    buildCalendarEventSearchDocuments,
    buildCalendarMemberSearchDocuments,
    formatSearchDateRange,
    getCalendarSearchAvailableFilters,
    listCalendarMemberIndex,
    listRecentCalendarEventIndex,
    searchCalendarEventIndex,
    searchCalendarMemberIndex,
    splitSearchTerms,
    type CalendarSearchFilters,
    type CalendarSearchMemberResult,
    type CalendarSearchResponse,
    type CalendarSearchResult,
} from "@/lib/calendar/search"
import { useAuthStore } from "@/store/useAuthStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@workspace/ui/components/command"
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd"
import { SearchIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import {
    Fragment,
    startTransition,
    useDeferredValue,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"

const INITIAL_EVENT_LIMIT = 10
const SEARCH_EVENT_LIMIT = 20
const MEMBER_LIMIT = 20
const SEARCH_DIALOG_RESET_DELAY_MS = 150

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function HighlightText({
    text,
    query,
    className,
}: {
    text: string
    query: string
    className?: string
}) {
    const segments = useMemo(() => {
        const terms = splitSearchTerms(query)

        if (!text || terms.length === 0) {
            return null
        }

        const pattern = new RegExp(
            `(${terms.map((term) => escapeRegExp(term)).join("|")})`,
            "gi"
        )

        return {
            terms,
            segments: text.split(pattern),
        }
    }, [query, text])

    if (!segments) {
        return <span className={className}>{text}</span>
    }

    return (
        <span className={className}>
            {segments.segments.map((segment, index) => {
                const isMatch = segments.terms.some(
                    (term) => segment.toLocaleLowerCase() === term
                )

                return isMatch ? (
                    <mark
                        key={`${segment}-${index}`}
                        className="-mx-0.5 rounded-sm bg-input/90 px-0.5 text-foreground"
                    >
                        {segment}
                    </mark>
                ) : (
                    <Fragment key={`${segment}-${index}`}>{segment}</Fragment>
                )
            })}
        </span>
    )
}

function ResultMeta({ result }: { result: CalendarSearchResult }) {
    const parts = [formatSearchDateRange(result.start, result.end)]

    if (result.author?.name) {
        parts.push(result.author.name)
    }

    if (result.matchedFields.includes("content")) {
        parts.push("본문 일치")
    }

    return (
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{parts.join(" · ")}</span>
        </div>
    )
}

function buildMemberCandidates({
    authoredMembers,
    presenceMembers,
    currentUser,
}: {
    authoredMembers: CalendarMemberDirectoryItem[]
    presenceMembers: ReturnType<
        typeof useCalendarStore.getState
    >["workspacePresence"]
    currentUser: ReturnType<typeof useAuthStore.getState>["user"]
}) {
    const memberMap = new Map<string, CalendarMemberDirectoryItem>()

    for (const member of authoredMembers) {
        memberMap.set(member.userId, member)
    }

    for (const member of presenceMembers) {
        if (!member.userId) {
            continue
        }

        memberMap.set(member.userId, {
            id: member.id,
            userId: member.userId,
            role: "viewer",
            status: "active",
            createdAt: "",
            email: null,
            name: member.displayName,
            avatarUrl: member.avatarUrl,
        })
    }

    if (currentUser) {
        memberMap.set(currentUser.id, {
            id: currentUser.id,
            userId: currentUser.id,
            role: "viewer",
            status: "active",
            createdAt: "",
            email: currentUser.email,
            name: currentUser.name,
            avatarUrl: currentUser.avatarUrl,
        })
    }

    return Array.from(memberMap.values())
}

export function CalendarSearchDialog() {
    const router = useRouter()
    const user = useAuthStore((state) => state.user)
    const activeCalendar = useCalendarStore((state) => state.activeCalendar)
    const activeCalendarMembership = useCalendarStore(
        (state) => state.activeCalendarMembership
    )
    const events = useCalendarStore((state) => state.events)
    const workspacePresence = useCalendarStore(
        (state) => state.workspacePresence
    )
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const deferredQuery = useDeferredValue(query)
    const [memberDirectory, setMemberDirectory] = useState<
        CalendarMemberDirectoryItem[]
    >([])
    const [filters, setFilters] = useState<CalendarSearchFilters>({})
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isHydratingMembers, setIsHydratingMembers] = useState(false)
    const hasLoadedMemberDirectoryRef = useRef(false)
    const memberDirectoryCalendarIdRef = useRef<string | null>(null)
    const resetTimeoutRef = useRef<number | null>(null)

    const trimmedQuery = deferredQuery.trim()
    const isDemoCalendar = activeCalendar?.id === "demo"
    const canSearch =
        isDemoCalendar || activeCalendarMembership.isMember === true
    const availableFilters = useMemo(
        () => getCalendarSearchAvailableFilters(events),
        [events]
    )
    const authoredMembers = useMemo<CalendarMemberDirectoryItem[]>(() => {
        const authorMap = new Map<string, CalendarMemberDirectoryItem>()

        for (const event of events) {
            if (!event.authorId) {
                continue
            }

            authorMap.set(event.authorId, {
                id: event.authorId,
                userId: event.authorId,
                role: "viewer",
                status: "active",
                createdAt: new Date(event.createdAt).toISOString(),
                email: event.author?.email ?? null,
                name: event.author?.name ?? null,
                avatarUrl: event.author?.avatarUrl ?? null,
            })
        }

        return Array.from(authorMap.values())
    }, [events])
    const fallbackMembers = useMemo(
        () =>
            buildMemberCandidates({
                authoredMembers,
                presenceMembers: workspacePresence,
                currentUser: user,
            }),
        [authoredMembers, user, workspacePresence]
    )
    const memberSource = memberDirectory.length
        ? memberDirectory
        : fallbackMembers
    const eventDocuments = useMemo(
        () => buildCalendarEventSearchDocuments(events),
        [events]
    )
    const memberDocuments = useMemo(
        () => buildCalendarMemberSearchDocuments(memberSource),
        [memberSource]
    )
    const eventResults = useMemo<CalendarSearchResult[]>(() => {
        if (!open || !canSearch) {
            return []
        }

        return trimmedQuery
            ? searchCalendarEventIndex({
                  documents: eventDocuments,
                  query: trimmedQuery,
                  filters,
                  limit: SEARCH_EVENT_LIMIT,
              })
            : listRecentCalendarEventIndex({
                  documents: eventDocuments,
                  filters,
                  limit: INITIAL_EVENT_LIMIT,
              })
    }, [canSearch, eventDocuments, filters, open, trimmedQuery])
    const memberResults = useMemo<CalendarSearchMemberResult[]>(() => {
        if (!open || !canSearch) {
            return []
        }

        return trimmedQuery
            ? searchCalendarMemberIndex({
                  documents: memberDocuments,
                  query: trimmedQuery,
                  limit: MEMBER_LIMIT,
              })
            : listCalendarMemberIndex({
                  documents: memberDocuments,
                  limit: MEMBER_LIMIT,
              })
    }, [canSearch, memberDocuments, open, trimmedQuery])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const isOpenShortcut =
                (event.ctrlKey || event.metaKey) && event.code === "KeyK"

            if (!isOpenShortcut) {
                return
            }

            event.preventDefault()

            if (!canSearch) {
                return
            }

            setOpen(true)
        }

        window.addEventListener("keydown", handleKeyDown)

        return () => {
            window.removeEventListener("keydown", handleKeyDown)
        }
    }, [canSearch])

    useEffect(() => {
        return () => {
            if (resetTimeoutRef.current) {
                window.clearTimeout(resetTimeoutRef.current)
            }
        }
    }, [])

    useEffect(() => {
        const activeCalendarId = activeCalendar?.id ?? null

        if (memberDirectoryCalendarIdRef.current === activeCalendarId) {
            return
        }

        memberDirectoryCalendarIdRef.current = activeCalendarId
        hasLoadedMemberDirectoryRef.current = false
        setMemberDirectory([])
        setIsHydratingMembers(false)
        setErrorMessage(null)
    }, [activeCalendar?.id])

    useEffect(() => {
        if (open) {
            if (resetTimeoutRef.current) {
                window.clearTimeout(resetTimeoutRef.current)
                resetTimeoutRef.current = null
            }
            return
        }

        resetTimeoutRef.current = window.setTimeout(() => {
            setQuery("")
            setErrorMessage(null)
            setFilters({})
            resetTimeoutRef.current = null
        }, SEARCH_DIALOG_RESET_DELAY_MS)
    }, [open])

    useEffect(() => {
        if (
            !open ||
            !canSearch ||
            isDemoCalendar ||
            !activeCalendar?.id ||
            hasLoadedMemberDirectoryRef.current ||
            isHydratingMembers
        ) {
            return
        }

        let isCancelled = false
        const abortController = new AbortController()

        const hydrateMembers = async () => {
            setIsHydratingMembers(true)
            setErrorMessage(null)

            try {
                const response = await fetch(
                    `/api/calendars/${encodeURIComponent(activeCalendar.id)}/search`,
                    {
                        method: "POST",
                        signal: abortController.signal,
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            q: "",
                            eventLimit: INITIAL_EVENT_LIMIT,
                            memberLimit: 200,
                        }),
                    }
                )

                if (!response.ok) {
                    throw new Error("멤버 디렉터리를 불러오지 못했습니다.")
                }

                const payload =
                    (await response.json()) as CalendarSearchResponse

                if (isCancelled) {
                    return
                }

                hasLoadedMemberDirectoryRef.current = true
                setMemberDirectory(
                    payload.members.map((member) => ({
                        id: member.id,
                        userId: member.userId,
                        role: member.role as CalendarMemberDirectoryItem["role"],
                        status: member.status as CalendarMemberDirectoryItem["status"],
                        createdAt: "",
                        email: member.email,
                        name: member.name,
                        avatarUrl: member.avatarUrl,
                    }))
                )
            } catch (error) {
                if (
                    !isCancelled &&
                    !(error instanceof DOMException && error.name === "AbortError")
                ) {
                    setErrorMessage("멤버 목록 동기화에 실패했습니다.")
                }
            } finally {
                if (!isCancelled) {
                    setIsHydratingMembers(false)
                }
            }
        }

        void hydrateMembers()

        return () => {
            isCancelled = true
            abortController.abort()
        }
    }, [
        activeCalendar?.id,
        canSearch,
        isDemoCalendar,
        isHydratingMembers,
        open,
    ])

    const handleEventSelect = (eventId: string) => {
        if (!activeCalendar?.id) {
            return
        }

        setOpen(false)

        startTransition(() => {
            router.push(getCalendarEventModalPath(activeCalendar.id, eventId))
        })
    }

    const handleMemberSelect = (member: CalendarSearchMemberResult) => {
        setFilters((current) => ({
            ...current,
            authorIds: [member.userId],
        }))
        setQuery("")
        setErrorMessage(null)
    }

    const eventGroupHeading = trimmedQuery
        ? `일정 (${eventResults.length}개)`
        : `최근 작성 일정 (${eventResults.length}개)`
    const memberGroupHeading = `멤버 (${memberResults.length}명)`
    const hasEventResults = eventResults.length > 0
    const hasMemberResults = memberResults.length > 0
    const showEmpty = !hasEventResults && !hasMemberResults
    const emptyMessage = errorMessage ?? "검색 결과가 없습니다."

    return (
        <>
            <Button
                variant="outline"
                size="default"
                disabled={!canSearch}
                className="relative inline-flex h-8 w-full shrink-0 items-center justify-between gap-2 rounded-lg border px-2 py-2 text-sm font-normal whitespace-nowrap text-muted-foreground shadow-none transition-all outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 md:w-48 lg:w-40 xl:w-64"
                onClick={() => setOpen(true)}
            >
                <div className="flex items-center gap-2">
                    <SearchIcon className="size-4" />
                    <span>검색</span>
                </div>

                <KbdGroup>
                    <Kbd>⌘</Kbd>
                    <Kbd>K</Kbd>
                </KbdGroup>
            </Button>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <Command shouldFilter={false}>
                    <CommandInput
                        value={query}
                        onValueChange={setQuery}
                        placeholder="일정 제목과 본문, 멤버를 검색하세요"
                    />
                    <CommandList className="max-h-90">
                        {showEmpty ? (
                            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                {emptyMessage}
                            </CommandEmpty>
                        ) : null}

                        {hasEventResults ? (
                            <CommandGroup heading={eventGroupHeading}>
                                {eventResults.map((result) => (
                                    <CommandItem
                                        key={result.id}
                                        value={`${result.id}-${result.title}`}
                                        onSelect={() =>
                                            handleEventSelect(result.id)
                                        }
                                        className="items-start px-3 py-2"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <HighlightText
                                                text={result.title}
                                                query={trimmedQuery}
                                                className="block truncate text-sm font-medium text-foreground"
                                            />
                                            <HighlightText
                                                text={result.excerpt || "내용 없음"}
                                                query={trimmedQuery}
                                                className="mt-1 line-clamp-2 block text-sm text-muted-foreground"
                                            />
                                            <ResultMeta result={result} />
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ) : null}

                        {hasMemberResults ? (
                            <CommandGroup heading={memberGroupHeading}>
                                {memberResults.map((member) => (
                                    <CommandItem
                                        key={member.id}
                                        value={`member-${member.userId}-${member.name}`}
                                        onSelect={() =>
                                            handleMemberSelect(member)
                                        }
                                        className="px-3 py-2"
                                    >
                                        <Avatar className="size-8">
                                            <AvatarImage
                                                src={
                                                    member.avatarUrl ??
                                                    undefined
                                                }
                                                alt={member.name}
                                            />
                                            <AvatarFallback>
                                                {member.name[0] ?? "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <HighlightText
                                                text={member.name}
                                                query={trimmedQuery}
                                                className="block truncate text-sm font-medium text-foreground"
                                            />
                                            <HighlightText
                                                text={
                                                    member.email ??
                                                    "선택 시 작성자 필터 적용"
                                                }
                                                query={trimmedQuery}
                                                className="block truncate text-xs text-muted-foreground"
                                            />
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ) : null}

                        {!showEmpty &&
                        !trimmedQuery &&
                        availableFilters.authors.length ? (
                            <CommandGroup heading="확장 예정 필터">
                                {availableFilters.authors
                                    .slice(0, 3)
                                    .map((author) => (
                                        <CommandItem
                                            key={author.id}
                                            disabled
                                            value={`author-${author.id}`}
                                            className="px-3 py-2 opacity-70"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-medium">
                                                    {author.name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    작성자 필터로 확장 가능
                                                </div>
                                            </div>
                                        </CommandItem>
                                    ))}
                            </CommandGroup>
                        ) : null}
                    </CommandList>
                </Command>
            </CommandDialog>
        </>
    )
}
