"use client"

import { useEffect, useRef } from "react"
import { useNotificationRealtime } from "@/hooks/use-notification-realtime"
import { useAuthStore } from "@/store/useAuthStore"
import { useNotificationStore } from "@/store/useNotificationStore"

export function NotificationSync() {
    const user = useAuthStore((s) => s.user)
    const digests = useNotificationStore((s) => s.digests)
    const unreadCount = useNotificationStore((s) => s.unreadCount)
    const isInitialized = useNotificationStore((s) => s.isInitialized)
    const primeNotifications = useNotificationStore((s) => s.primeNotifications)
    const syncUnreadCount = useNotificationStore((s) => s.syncUnreadCount)
    const syncInFlightRef = useRef(false)
    const lastSyncAtRef = useRef(0)
    const hasHydratedRef = useRef(false)

    useNotificationRealtime()

    useEffect(() => {
        if (!user) {
            hasHydratedRef.current = false
            syncInFlightRef.current = false
            lastSyncAtRef.current = 0
            useNotificationStore.setState({
                digests: [],
                unreadCount: 0,
                nextCursor: null,
                hasMore: false,
                isLoading: false,
                isInitialized: false,
                preferences: null,
            })
            return
        }

        const requestSync = async () => {
            if (syncInFlightRef.current) {
                return
            }

            const now = Date.now()
            if (now - lastSyncAtRef.current < 15_000) {
                return
            }

            syncInFlightRef.current = true
            try {
                await syncUnreadCount()
                lastSyncAtRef.current = Date.now()
            } finally {
                syncInFlightRef.current = false
            }
        }

        if (!isInitialized) {
            void primeNotifications().then(() => {
                void requestSync()
            })
        } else if (!hasHydratedRef.current) {
            hasHydratedRef.current = true
            lastSyncAtRef.current = Date.now()
        } else if (digests.length === 0 && unreadCount === 0) {
            void requestSync()
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                if (!useNotificationStore.getState().isInitialized) {
                    void primeNotifications()
                    return
                }

                void requestSync()
            }
        }

        window.addEventListener("focus", handleVisibilityChange)
        document.addEventListener("visibilitychange", handleVisibilityChange)

        return () => {
            window.removeEventListener("focus", handleVisibilityChange)
            document.removeEventListener("visibilitychange", handleVisibilityChange)
        }
    }, [
        user?.id,
        digests.length,
        unreadCount,
        isInitialized,
        primeNotifications,
        syncUnreadCount,
    ])

    return null
}
