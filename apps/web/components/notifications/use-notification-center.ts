"use client"

import { useNotificationRealtime } from "@/hooks/use-notification-realtime"
import { useAuthStore } from "@/store/useAuthStore"
import type { NotificationDigest } from "@/store/notification-store.types"
import { useNotificationStore } from "@/store/useNotificationStore"
import { useEffect } from "react"

interface UseNotificationCenterOptions {
    open?: boolean
    initialDigests?: NotificationDigest[]
    initialHasMore?: boolean
}

export function useNotificationCenter({
    open,
    initialDigests,
    initialHasMore,
}: UseNotificationCenterOptions = {}) {
    const user = useAuthStore((s) => s.user)
    const digests = useNotificationStore((s) => s.digests)
    const unreadCount = useNotificationStore((s) => s.unreadCount)
    const isLoading = useNotificationStore((s) => s.isLoading)
    const isInitialized = useNotificationStore((s) => s.isInitialized)
    const hasMore = useNotificationStore((s) => s.hasMore)
    const loadNotifications = useNotificationStore((s) => s.loadNotifications)
    const loadMoreNotifications = useNotificationStore(
        (s) => s.loadMoreNotifications
    )
    const markAllRead = useNotificationStore((s) => s.markAllRead)

    useNotificationRealtime()

    useEffect(() => {
        if (!initialDigests || isInitialized) {
            return
        }

        useNotificationStore.setState({
            digests: initialDigests,
            hasMore: initialHasMore ?? false,
            nextCursor:
                initialDigests.length > 0
                    ? new Date(
                          initialDigests[initialDigests.length - 1]!
                              .lastOccurredAt
                      ).toISOString()
                    : null,
            isInitialized: true,
            unreadCount: initialDigests.reduce((sum, digest) => {
                return sum + digest.unreadCount
            }, 0),
        })
    }, [initialDigests, initialHasMore, isInitialized])

    useEffect(() => {
        if (!open || isInitialized || !user || initialDigests) {
            return
        }

        void loadNotifications()
    }, [open, isInitialized, user, initialDigests, loadNotifications])

    return {
        digests: isInitialized ? digests : initialDigests ?? digests,
        unreadCount,
        isLoading,
        isInitialized,
        hasMore,
        loadMoreNotifications,
        markAllRead,
    }
}
