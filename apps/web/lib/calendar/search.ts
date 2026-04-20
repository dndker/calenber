import type { CalendarMemberDirectoryItem } from "@/lib/calendar/queries"
import dayjs from "@/lib/dayjs"
import type {
    CalendarEvent,
    CalendarEventStatus,
} from "@/store/calendar-store.types"

export type CalendarSearchFilters = {
    authorIds?: string[]
    statuses?: CalendarEventStatus[]
    categories?: string[]
} & Record<string, string[] | undefined>

export type CalendarSearchAvailableFilters = {
    authors: {
        id: string
        name: string
        count: number
    }[]
    statuses: {
        value: CalendarEventStatus
        label: string
        count: number
    }[]
    categories: {
        value: string
        label: string
        count: number
    }[]
}

export type CalendarSearchResult = {
    id: string
    title: string
    excerpt: string
    matchedFields: Array<"title" | "content">
    score: number
    start: number
    end: number
    status: CalendarEventStatus
    author: {
        id: string | null
        name: string | null
    } | null
}

export type CalendarSearchMemberResult = {
    id: string
    userId: string
    name: string
    email: string | null
    avatarUrl: string | null
    role: CalendarMemberDirectoryItem["role"]
    status: CalendarMemberDirectoryItem["status"]
    score: number
}

export type CalendarSearchResponse = {
    query: string
    filters: CalendarSearchFilters
    events: CalendarSearchResult[]
    members: CalendarSearchMemberResult[]
    availableFilters: CalendarSearchAvailableFilters
}

export type CalendarEventSearchDocument = {
    event: CalendarEvent
    title: string
    content: string
    normalizedTitle: string
    normalizedContent: string
}

export type CalendarMemberSearchDocument = {
    member: CalendarMemberDirectoryItem
    name: string
    email: string
    normalizedName: string
    normalizedEmail: string
}

const EXCERPT_LENGTH = 140
const EXCERPT_CONTEXT_LEADING = 42
const EXCERPT_CONTEXT_TRAILING = 84

const eventStatusLabel: Record<CalendarEventStatus, string> = {
    scheduled: "시작 전",
    in_progress: "진행 중",
    completed: "완료",
    cancelled: "취소",
}

function normalizeWhitespace(value: string) {
    return value.replace(/\s+/g, " ").trim()
}

function extractPlainText(value: unknown): string {
    if (typeof value === "string") {
        return value
    }

    if (Array.isArray(value)) {
        return value.map(extractPlainText).filter(Boolean).join(" ")
    }

    if (value && typeof value === "object") {
        return Object.entries(value)
            .filter(([key]) => !["id", "type", "props", "styles"].includes(key))
            .map(([, nestedValue]) => extractPlainText(nestedValue))
            .filter(Boolean)
            .join(" ")
    }

    return ""
}

function normalizeSearchText(value: string) {
    return normalizeWhitespace(value).toLocaleLowerCase()
}

export function splitSearchTerms(query: string) {
    return normalizeSearchText(query)
        .split(" ")
        .map((term) => term.trim())
        .filter(Boolean)
}

function findBestMatchIndex(haystack: string, query: string, terms: string[]) {
    const loweredHaystack = haystack.toLocaleLowerCase()
    const loweredQuery = normalizeSearchText(query)

    if (loweredQuery) {
        const queryIndex = loweredHaystack.indexOf(loweredQuery)

        if (queryIndex >= 0) {
            return {
                index: queryIndex,
                length: loweredQuery.length,
            }
        }
    }

    for (const term of terms) {
        const termIndex = loweredHaystack.indexOf(term)

        if (termIndex >= 0) {
            return {
                index: termIndex,
                length: term.length,
            }
        }
    }

    return null
}

export function getCalendarEventSearchContent(event: CalendarEvent) {
    return normalizeWhitespace(extractPlainText(event.content))
}

export function createSearchExcerpt(content: string, query: string) {
    const normalizedContent = normalizeWhitespace(content)

    if (!normalizedContent) {
        return ""
    }

    if (normalizedContent.length <= EXCERPT_LENGTH) {
        return normalizedContent
    }

    const terms = splitSearchTerms(query)
    const match = findBestMatchIndex(normalizedContent, query, terms)

    if (!match) {
        return `${normalizedContent.slice(0, EXCERPT_LENGTH).trimEnd()}…`
    }

    const start = Math.max(0, match.index - EXCERPT_CONTEXT_LEADING)
    const end = Math.min(
        normalizedContent.length,
        Math.max(
            match.index + match.length + EXCERPT_CONTEXT_TRAILING,
            start + EXCERPT_LENGTH
        )
    )
    const prefix = start > 0 ? "…" : ""
    const suffix = end < normalizedContent.length ? "…" : ""

    return `${prefix}${normalizedContent.slice(start, end).trim()}${suffix}`
}

function matchesFilters(event: CalendarEvent, filters: CalendarSearchFilters) {
    if (filters.authorIds?.length) {
        const authorId = event.authorId ?? ""

        if (!filters.authorIds.includes(authorId)) {
            return false
        }
    }

    if (filters.statuses?.length && !filters.statuses.includes(event.status)) {
        return false
    }

    return true
}

export function buildCalendarEventSearchDocuments(events: CalendarEvent[]) {
    return events.map((event) => {
        const title = event.title.trim() || "새 일정"
        const content = getCalendarEventSearchContent(event)

        return {
            event,
            title,
            content,
            normalizedTitle: normalizeSearchText(title),
            normalizedContent: normalizeSearchText(content),
        }
    })
}

function calculateEventSearchScore(
    doc: CalendarEventSearchDocument,
    query: string,
    terms: string[]
) {
    const normalizedQuery = normalizeSearchText(query)
    let score = 0

    if (doc.normalizedTitle === normalizedQuery) {
        score += 160
    } else if (
        doc.normalizedTitle.startsWith(normalizedQuery) &&
        normalizedQuery
    ) {
        score += 120
    } else if (
        doc.normalizedTitle.includes(normalizedQuery) &&
        normalizedQuery
    ) {
        score += 80
    }

    if (doc.normalizedContent.includes(normalizedQuery) && normalizedQuery) {
        score += 24
    }

    for (const term of terms) {
        if (doc.normalizedTitle.includes(term)) {
            score += 18
        }

        if (doc.normalizedContent.includes(term)) {
            score += 6
        }
    }

    return score
}

function searchCalendarEventDocuments({
    documents,
    query,
    filters = {},
    limit = 20,
}: {
    documents: CalendarEventSearchDocument[]
    query: string
    filters?: CalendarSearchFilters
    limit?: number
}) {
    const normalizedQuery = normalizeSearchText(query)
    const terms = splitSearchTerms(normalizedQuery)

    if (!normalizedQuery || terms.length === 0) {
        return []
    }

    return documents
        .filter(({ event }) => matchesFilters(event, filters))
        .map((doc) => {
            const matchesAcrossDocument = terms.every(
                (term) =>
                    doc.normalizedTitle.includes(term) ||
                    doc.normalizedContent.includes(term)
            )

            if (!matchesAcrossDocument) {
                return null
            }

            const matchedFields: Array<"title" | "content"> = []

            if (
                terms.every((term) => doc.normalizedTitle.includes(term)) ||
                doc.normalizedTitle.includes(normalizedQuery)
            ) {
                matchedFields.push("title")
            }

            if (
                terms.every((term) => doc.normalizedContent.includes(term)) ||
                doc.normalizedContent.includes(normalizedQuery) ||
                (!matchedFields.length && doc.content)
            ) {
                matchedFields.push("content")
            }

            return {
                id: doc.event.id,
                title: doc.title,
                excerpt: createSearchExcerpt(
                    doc.content || doc.title,
                    normalizedQuery
                ),
                matchedFields,
                score: calculateEventSearchScore(doc, normalizedQuery, terms),
                start: doc.event.start,
                end: doc.event.end,
                status: doc.event.status,
                author: doc.event.author
                    ? {
                          id: doc.event.author.id,
                          name: doc.event.author.name,
                      }
                    : null,
                createdAt: doc.event.createdAt,
                updatedAt: doc.event.updatedAt,
            }
        })
        .filter(
            (
                item
            ): item is CalendarSearchResult & {
                createdAt: number
                updatedAt: number
            } => Boolean(item)
        )
        .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score
            }

            if (b.createdAt !== a.createdAt) {
                return b.createdAt - a.createdAt
            }

            return b.updatedAt - a.updatedAt
        })
        .slice(0, limit)
        .map(
            ({ createdAt: _createdAt, updatedAt: _updatedAt, ...result }) =>
                result
        )
}

function listRecentCalendarEventDocuments({
    documents,
    filters = {},
    limit = 10,
}: {
    documents: CalendarEventSearchDocument[]
    filters?: CalendarSearchFilters
    limit?: number
}) {
    return documents
        .filter(({ event }) => matchesFilters(event, filters))
        .slice()
        .sort((a, b) => {
            if (b.event.createdAt !== a.event.createdAt) {
                return b.event.createdAt - a.event.createdAt
            }

            return b.event.updatedAt - a.event.updatedAt
        })
        .slice(0, limit)
        .map((doc) => ({
            id: doc.event.id,
            title: doc.title,
            excerpt: createSearchExcerpt(doc.content || doc.title, ""),
            matchedFields: [] as Array<"title" | "content">,
            score: 0,
            start: doc.event.start,
            end: doc.event.end,
            status: doc.event.status,
            author: doc.event.author
                ? {
                      id: doc.event.author.id,
                      name: doc.event.author.name,
                  }
                : null,
        }))
}

export function searchCalendarEvents({
    events,
    query,
    filters = {},
    limit = 20,
}: {
    events: CalendarEvent[]
    query: string
    filters?: CalendarSearchFilters
    limit?: number
}) {
    return searchCalendarEventDocuments({
        documents: buildCalendarEventSearchDocuments(events),
        query,
        filters,
        limit,
    })
}

export function searchCalendarEventIndex({
    documents,
    query,
    filters = {},
    limit = 20,
}: {
    documents: CalendarEventSearchDocument[]
    query: string
    filters?: CalendarSearchFilters
    limit?: number
}) {
    return searchCalendarEventDocuments({
        documents,
        query,
        filters,
        limit,
    })
}

export function listRecentCalendarEvents(
    events: CalendarEvent[],
    filters: CalendarSearchFilters = {},
    limit = 10
) {
    return listRecentCalendarEventDocuments({
        documents: buildCalendarEventSearchDocuments(events),
        filters,
        limit,
    })
}

export function listRecentCalendarEventIndex({
    documents,
    filters = {},
    limit = 10,
}: {
    documents: CalendarEventSearchDocument[]
    filters?: CalendarSearchFilters
    limit?: number
}) {
    return listRecentCalendarEventDocuments({
        documents,
        filters,
        limit,
    })
}

export function buildCalendarMemberSearchDocuments(
    members: CalendarMemberDirectoryItem[]
) {
    return members.map((member) => {
        const name = member.name?.trim() || "이름 없음"
        const email = member.email ?? ""

        return {
            member,
            name,
            email,
            normalizedName: normalizeSearchText(name),
            normalizedEmail: normalizeSearchText(email),
        }
    })
}

function calculateMemberSearchScore(
    doc: CalendarMemberSearchDocument,
    query: string,
    terms: string[]
) {
    const normalizedQuery = normalizeSearchText(query)
    let score = 0

    if (doc.normalizedName === normalizedQuery) {
        score += 140
    } else if (
        doc.normalizedName.startsWith(normalizedQuery) &&
        normalizedQuery
    ) {
        score += 100
    } else if (
        doc.normalizedName.includes(normalizedQuery) &&
        normalizedQuery
    ) {
        score += 72
    }

    if (doc.normalizedEmail.includes(normalizedQuery) && normalizedQuery) {
        score += 24
    }

    for (const term of terms) {
        if (doc.normalizedName.includes(term)) {
            score += 18
        }

        if (doc.normalizedEmail.includes(term)) {
            score += 8
        }
    }

    return score
}

function listCalendarMemberDocuments(
    documents: CalendarMemberSearchDocument[],
    limit = 8
) {
    return documents
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, limit)
        .map((doc) => ({
            id: doc.member.id,
            userId: doc.member.userId,
            name: doc.name,
            email: doc.member.email,
            avatarUrl: doc.member.avatarUrl,
            role: doc.member.role,
            status: doc.member.status,
            score: 0,
        }))
}

function searchCalendarMemberDocuments({
    documents,
    query,
    limit = 8,
}: {
    documents: CalendarMemberSearchDocument[]
    query: string
    limit?: number
}) {
    const normalizedQuery = normalizeSearchText(query)
    const terms = splitSearchTerms(normalizedQuery)

    if (!normalizedQuery || terms.length === 0) {
        return listCalendarMemberDocuments(documents, limit)
    }

    return documents
        .map((doc) => {
            const matches = terms.every(
                (term) =>
                    doc.normalizedName.includes(term) ||
                    doc.normalizedEmail.includes(term)
            )

            if (!matches) {
                return null
            }

            return {
                id: doc.member.id,
                userId: doc.member.userId,
                name: doc.name,
                email: doc.member.email,
                avatarUrl: doc.member.avatarUrl,
                role: doc.member.role,
                status: doc.member.status,
                score: calculateMemberSearchScore(doc, normalizedQuery, terms),
            }
        })
        .filter((item): item is CalendarSearchMemberResult => Boolean(item))
        .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score
            }

            return a.name.localeCompare(b.name)
        })
        .slice(0, limit)
}

export function listCalendarMembers(
    members: CalendarMemberDirectoryItem[],
    limit = 8
) {
    return listCalendarMemberDocuments(
        buildCalendarMemberSearchDocuments(members),
        limit
    )
}

export function listCalendarMemberIndex({
    documents,
    limit = 8,
}: {
    documents: CalendarMemberSearchDocument[]
    limit?: number
}) {
    return listCalendarMemberDocuments(documents, limit)
}

export function searchCalendarMembers({
    members,
    query,
    limit = 8,
}: {
    members: CalendarMemberDirectoryItem[]
    query: string
    limit?: number
}) {
    return searchCalendarMemberDocuments({
        documents: buildCalendarMemberSearchDocuments(members),
        query,
        limit,
    })
}

export function searchCalendarMemberIndex({
    documents,
    query,
    limit = 8,
}: {
    documents: CalendarMemberSearchDocument[]
    query: string
    limit?: number
}) {
    return searchCalendarMemberDocuments({
        documents,
        query,
        limit,
    })
}

export function getCalendarSearchAvailableFilters(
    events: CalendarEvent[]
): CalendarSearchAvailableFilters {
    const authorMap = new Map<
        string,
        {
            id: string
            name: string
            count: number
        }
    >()
    const statusMap = new Map<
        CalendarEventStatus,
        {
            value: CalendarEventStatus
            label: string
            count: number
        }
    >()

    for (const event of events) {
        if (event.authorId) {
            const current = authorMap.get(event.authorId)

            authorMap.set(event.authorId, {
                id: event.authorId,
                name: event.author?.name?.trim() || "이름 없는 사용자",
                count: (current?.count ?? 0) + 1,
            })
        }

        const currentStatus = statusMap.get(event.status)

        statusMap.set(event.status, {
            value: event.status,
            label: eventStatusLabel[event.status],
            count: (currentStatus?.count ?? 0) + 1,
        })
    }

    return {
        authors: Array.from(authorMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
        ),
        statuses: Array.from(statusMap.values()).sort((a, b) =>
            a.label.localeCompare(b.label)
        ),
        categories: [],
    }
}

export function formatSearchDateRange(start: number, end: number) {
    const startDate = dayjs(start)
    const endDate = dayjs(end)

    if (startDate.isSame(endDate, "day")) {
        return startDate.format("M월 D일")
    }

    return `${startDate.format("M월 D일")} - ${endDate.format("M월 D일")}`
}
