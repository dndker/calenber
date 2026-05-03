/**
 * Web Push 구독 관리
 *
 * VAPID 키는 .env 에서 읽는다:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
 *
 * 서버에서는 VAPID_PRIVATE_KEY, VAPID_SUBJECT 도 필요.
 */

import { savePushSubscription, deletePushSubscription } from "./mutations"
import { createBrowserSupabase as createClient } from "@/lib/supabase/client"

/**
 * Base64url → Uint8Array (VAPID 공개키 디코드용)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
    const rawData = atob(base64)
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

/**
 * 브라우저 푸시 알림 권한 요청 및 구독
 * - 이미 구독 중이면 기존 구독을 반환
 * - 권한 거부 시 null 반환
 */
export async function subscribePushNotifications(
    userId: string
): Promise<PushSubscription | null> {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        console.warn("[push] Push API not supported")
        return null
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
        console.warn("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set")
        return null
    }

    // 권한 요청
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
        return null
    }

    const registration = await navigator.serviceWorker.ready

    // 기존 구독 재사용
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
        })
    }

    // DB 저장
    const supabase = createClient()
    const deviceLabel =
        typeof navigator !== "undefined"
            ? navigator.userAgent.slice(0, 120)
            : undefined
    await savePushSubscription(supabase, userId, subscription, deviceLabel)

    return subscription
}

/**
 * 푸시 구독 해제 및 DB 삭제
 */
export async function unsubscribePushNotifications(): Promise<void> {
    if (!("serviceWorker" in navigator)) return

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return

    await subscription.unsubscribe()

    const supabase = createClient()
    await deletePushSubscription(supabase, subscription.endpoint)
}

/**
 * 현재 구독 상태 반환 (권한 포함)
 */
export async function getPushSubscriptionStatus(): Promise<{
    permission: NotificationPermission
    isSubscribed: boolean
}> {
    if (!("Notification" in window)) {
        return { permission: "denied", isSubscribed: false }
    }
    const permission = Notification.permission
    if (!("serviceWorker" in navigator)) {
        return { permission, isSubscribed: false }
    }

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return { permission, isSubscribed: subscription !== null }
}
