"use client"

import { createSSRStore } from "./createSSRStore"
import type { NotificationStoreState, UserNotificationPreferences } from "./notification-store.types"
import { fetchNotifications, fetchNotificationPreferences, fetchUnreadNotificationCount } from "@/lib/notification/queries"
import { markNotificationsRead, saveNotificationPreferences } from "@/lib/notification/mutations"
import { createBrowserSupabase as createClient } from "@/lib/supabase/client"
import type { NotificationDigest } from "./notification-store.types"

export const useNotificationStore = createSSRStore<NotificationStoreState>(
    (set, get) => ({
        digests: [],
        unreadCount: 0,
        nextCursor: null,
        hasMore: false,
        isLoading: false,
        isInitialized: false,
        preferences: null,

        loadNotifications: async () => {
            if (get().isLoading) return
            set({ isLoading: true })
            try {
                const supabase = createClient()
                const { digests, hasMore } = await fetchNotifications(supabase, { limit: 30 })
                const nextCursor =
                    digests.length > 0
                        ? new Date(digests[digests.length - 1]!.lastOccurredAt).toISOString()
                        : null
                set({ digests, hasMore, nextCursor, isInitialized: true })
            } catch (error) {
                console.error("[notification] loadNotifications failed", error)
                set({ isInitialized: true })
            } finally {
                set({ isLoading: false })
            }
        },

        loadMoreNotifications: async () => {
            const { isLoading, hasMore, nextCursor, digests } = get()
            if (isLoading || !hasMore) return
            set({ isLoading: true })
            try {
                const supabase = createClient()
                const result = await fetchNotifications(supabase, {
                    limit: 30,
                    cursor: nextCursor,
                })
                const newCursor =
                    result.digests.length > 0
                        ? new Date(
                              result.digests[result.digests.length - 1]!.lastOccurredAt
                          ).toISOString()
                        : nextCursor
                set({
                    digests: [...digests, ...result.digests],
                    hasMore: result.hasMore,
                    nextCursor: newCursor,
                })
            } catch (error) {
                console.error("[notification] loadMoreNotifications failed", error)
            } finally {
                set({ isLoading: false })
            }
        },

        upsertDigest: (incoming: NotificationDigest) => {
            const current = get().digests
            const idx = current.findIndex((d) => d.digestKey === incoming.digestKey)
            let next: NotificationDigest[]
            if (idx === -1) {
                // 신규 — 맨 앞에 삽입
                next = [incoming, ...current]
            } else {
                // 기존 업데이트
                next = current.map((d, i) => (i === idx ? incoming : d))
                // 최신 순으로 재정렬
                next.sort((a, b) => b.lastOccurredAt - a.lastOccurredAt)
            }
            const unreadCount = next.reduce((sum, d) => sum + d.unreadCount, 0)
            set({ digests: next, unreadCount })
        },

        markRead: async (digestKeys: string[]) => {
            // 낙관적 업데이트
            const current = get().digests
            const updated = current.map((d) =>
                digestKeys.includes(d.digestKey) ? { ...d, isRead: true, unreadCount: 0 } : d
            )
            const unreadCount = updated.reduce((sum, d) => sum + d.unreadCount, 0)
            set({ digests: updated, unreadCount })

            try {
                const supabase = createClient()
                await markNotificationsRead(supabase, digestKeys)
            } catch {
                // 실패 시 원복
                set({ digests: current, unreadCount: get().unreadCount })
            }
        },

        markAllRead: async () => {
            const current = get().digests
            const updated = current.map((d) => ({ ...d, isRead: true, unreadCount: 0 }))
            set({ digests: updated, unreadCount: 0 })

            try {
                const supabase = createClient()
                await markNotificationsRead(supabase, null)
            } catch {
                set({ digests: current, unreadCount: get().unreadCount })
            }
        },

        loadPreferences: async () => {
            const supabase = createClient()
            const prefs = await fetchNotificationPreferences(supabase)
            set({ preferences: prefs })
        },

        savePreferences: async (patch: Partial<UserNotificationPreferences>) => {
            const supabase = createClient()
            const current = get().preferences
            if (!current) return

            // 낙관적 업데이트
            set({ preferences: { ...current, ...patch } })

            try {
                await saveNotificationPreferences(supabase, current.userId, patch)
            } catch {
                set({ preferences: current })
                throw new Error("알림 설정 저장 실패")
            }
        },

        syncUnreadCount: async () => {
            try {
                const supabase = createClient()
                const count = await fetchUnreadNotificationCount(supabase)
                set({ unreadCount: count })
            } catch (error) {
                console.error("[notification] syncUnreadCount failed", error)
            }
        },
    }),
    { devtoolsName: "NotificationStore" }
)

export const NotificationStoreProvider = useNotificationStore.StoreProvider
