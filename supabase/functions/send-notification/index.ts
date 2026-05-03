// deno-lint-ignore-file no-explicit-any
// @ts-nocheck — Deno Edge Function: 타입 체크는 deno.json 기준으로만 수행됨
/**
 * Supabase Edge Function: send-notification
 *
 * DB Trigger 또는 /api/notifications/trigger 에서 호출.
 * 역할:
 *  1. Web Push (VAPID) 발송 — RFC 8291/8292 준수, Deno SubtleCrypto 사용
 *  2. 이메일 발송 (Resend)
 *
 * 환경변수 (Supabase Secrets):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   VAPID_PUBLIC_KEY   (Base64url, uncompressed P-256 공개키)
 *   VAPID_PRIVATE_KEY  (Base64url, P-256 개인키 — PKCS#8 DER)
 *   VAPID_SUBJECT      (mailto: 또는 https: URI)
 *   RESEND_API_KEY
 *   APP_URL
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────
type SendNotificationRequest = {
    jobId?: string
    notificationId?: string
    recipientId?: string
    channels?: ("push" | "email")[]
}

type PushSubscriptionRow = {
    endpoint: string
    p256dh: string
    auth_key: string
}

type NotificationPreferenceRow = {
    push_enabled: boolean
    email_enabled: boolean
    type_settings: Record<string, boolean> | null
    email_digest: "realtime" | "daily" | "weekly" | "off"
    quiet_hours: { start: string; end: string } | null
}

type ClaimedNotificationDeliveryJobRow = {
    id: string
    notification_id: string
    recipient_id: string
    channels: string[] | null
}

type PushDeliveryResult = {
    attempted: number
    delivered: number
    expiredEndpoints: string[]
}

type DeliveryJobStatus = "sent" | "failed" | "noop"

// ─────────────────────────────────────────
// 핸들러
// ─────────────────────────────────────────
Deno.serve(async (req: Request) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 })
    }

    const webhookSecret = Deno.env.get("NOTIFICATION_WEBHOOK_SECRET") ?? ""
    const requestSecret =
        req.headers.get("x-notification-webhook-secret") ?? ""

    if (!webhookSecret || requestSecret !== webhookSecret) {
        return new Response("Unauthorized", { status: 401 })
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    let body: SendNotificationRequest
    try {
        body = await req.json()
    } catch {
        return new Response("Invalid JSON", { status: 400 })
    }

    let notificationId = body.notificationId
    let recipientId = body.recipientId
    let channels = body.channels ?? []
    let deliveryJobId: string | null = body.jobId ?? null

    if (deliveryJobId) {
        const { data: claimedJob, error: claimError } = await supabase.rpc(
            "begin_notification_delivery_job",
            {
                p_job_id: deliveryJobId,
            }
        )

        if (claimError) {
            console.error("[send-notification] failed to claim job", claimError)
            return new Response("Failed to claim delivery job", { status: 500 })
        }

        const job = ((claimedJob ?? [])[0] ?? null) as
            | ClaimedNotificationDeliveryJobRow
            | null

        if (!job) {
            return new Response(
                JSON.stringify({ ok: true, skipped: true, reason: "job-not-claimable" }),
                {
                    headers: { "Content-Type": "application/json" },
                }
            )
        }

        notificationId = job.notification_id
        recipientId = job.recipient_id
        channels = (job.channels ?? []).filter(
            (channel): channel is "push" | "email" =>
                channel === "push" || channel === "email"
        )
        deliveryJobId = job.id
    }

    if (!notificationId || !recipientId) {
        return new Response("Missing notification target", { status: 400 })
    }

    // 알림 레코드 조회
    const { data: notif, error: notifErr } = await supabase
        .from("notifications")
        .select(
            "id, notification_type, entity_type, entity_id, calendar_id, metadata, digest_key, created_at"
        )
        .eq("id", notificationId)
        .single()

    if (notifErr || !notif) {
        return new Response("Notification not found", { status: 404 })
    }

    const { data: preferenceRow } = await supabase
        .from("user_notification_preferences")
        .select("push_enabled, email_enabled, type_settings, email_digest, quiet_hours")
        .eq("user_id", recipientId)
        .maybeSingle()

    const preferences = (preferenceRow ?? null) as NotificationPreferenceRow | null

    // 수신자 이메일 조회
    const { data: authUser } =
        await supabase.auth.admin.getUserById(recipientId)
    const recipientEmail = authUser?.user?.email

    const appUrl = Deno.env.get("APP_URL") ?? "https://calenber.com"
    const metadata = (notif.metadata ?? {}) as Record<string, string>
    const title = buildPushTitle(notif.notification_type, metadata)
    const bodyText = buildPushBody(notif.notification_type, metadata)
    const notifUrl = buildNotifUrl(
        appUrl,
        notif.entity_type,
        notif.entity_id,
        notif.calendar_id
    )

    const effectiveChannels = filterChannelsByPreferences(
        channels,
        notif.notification_type,
        preferences
    )

    if (effectiveChannels.length === 0) {
        await finalizeDeliveryJob(supabase, deliveryJobId, "noop", null)
        return new Response(
            JSON.stringify({
                ok: true,
                channels: [],
                status: "noop",
                reason: "preferences-disabled-or-no-deliverable-channel",
            }),
            {
                headers: { "Content-Type": "application/json" },
            }
        )
    }

    try {
        const pushRequested = effectiveChannels.includes("push")
        const emailRequested = effectiveChannels.includes("email")

        const results = await Promise.allSettled([
            pushRequested
                ? sendPushNotifications(supabase, recipientId, {
                      title,
                      message: bodyText,
                      url: notifUrl,
                      tag: notif.digest_key ?? notificationId,
                  })
                : Promise.resolve<PushDeliveryResult>({
                      attempted: 0,
                      delivered: 0,
                      expiredEndpoints: [],
                  }),

            emailRequested && recipientEmail
                ? sendEmail(recipientEmail, title, bodyText, notifUrl)
                : Promise.resolve(false),
        ])

        const pushResult =
            results[0]?.status === "fulfilled" ? results[0].value : null
        const emailResult =
            results[1]?.status === "fulfilled" ? results[1].value : false

        const updatePatch: Record<string, string> = {}
        if (pushRequested && (pushResult?.delivered ?? 0) > 0) {
            updatePatch.push_sent_at = new Date().toISOString()
        }
        if (emailRequested && emailResult === true) {
            updatePatch.email_sent_at = new Date().toISOString()
        }
        if (Object.keys(updatePatch).length > 0) {
            await supabase
                .from("notifications")
                .update(updatePatch)
                .eq("id", notificationId)
        }

        const failures = results
            .filter((result) => result.status === "rejected")
            .map((result) => (result as PromiseRejectedResult).reason)

        const jobStatus = resolveDeliveryJobStatus({
            pushRequested,
            emailRequested,
            pushResult,
            emailResult,
            recipientEmail,
            failures,
        })

        await finalizeDeliveryJob(
            supabase,
            deliveryJobId,
            jobStatus,
            failures.length > 0
                ? failures
                      .map((failure) =>
                          failure instanceof Error ? failure.message : String(failure)
                      )
                      .join(" | ")
                : null
        )

        return new Response(
            JSON.stringify({
                ok: jobStatus !== "failed",
                channels: effectiveChannels,
                status: jobStatus,
                failedCount: failures.length,
                push: pushResult,
                emailDelivered: emailResult === true,
            }),
            {
                headers: { "Content-Type": "application/json" },
                status: jobStatus === "failed" ? 500 : 200,
            }
        )
    } catch (error) {
        await finalizeDeliveryJob(
            supabase,
            deliveryJobId,
            "failed",
            error instanceof Error ? error.message : String(error)
        )

        console.error("[send-notification] unexpected failure", error)
        return new Response("Notification delivery failed", { status: 500 })
    }
})

// ─────────────────────────────────────────
// Web Push 발송
// ─────────────────────────────────────────
async function sendPushNotifications(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    payload: { title: string; message: string; url: string; tag?: string }
): Promise<{ attempted: number; delivered: number; expiredEndpoints: string[] }> {
    const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth_key")
        .eq("user_id", userId)

    if (!subs?.length) {
        return { attempted: 0, delivered: 0, expiredEndpoints: [] }
    }

    const results = await Promise.allSettled(
        subs.map((sub: PushSubscriptionRow) => sendWebPush(sub, payload))
    )

    const expiredEndpoints = results
        .filter(
            (result): result is PromiseFulfilledResult<{ expired: boolean; endpoint: string }> =>
                result.status === "fulfilled" && result.value.expired
        )
        .map((result) => result.value.endpoint)

    if (expiredEndpoints.length > 0) {
        await supabase
            .from("push_subscriptions")
            .delete()
            .in("endpoint", expiredEndpoints)
    }

    const delivered = results.filter(
        (result) => result.status === "fulfilled" && !result.value.expired
    ).length

    return {
        attempted: subs.length,
        delivered,
        expiredEndpoints,
    }
}

function resolveDeliveryJobStatus({
    pushRequested,
    emailRequested,
    pushResult,
    emailResult,
    recipientEmail,
    failures,
}: {
    pushRequested: boolean
    emailRequested: boolean
    pushResult: PushDeliveryResult | null
    emailResult: boolean
    recipientEmail: string | undefined
    failures: unknown[]
}): DeliveryJobStatus {
    if (failures.length > 0) {
        return "failed"
    }

    const pushDelivered = (pushResult?.delivered ?? 0) > 0
    const emailDelivered = emailResult === true

    if (pushDelivered || emailDelivered) {
        return "sent"
    }

    const pushUnavailable =
        !pushRequested ||
        !pushResult ||
        pushResult.attempted === 0 ||
        pushResult.expiredEndpoints.length === pushResult.attempted

    const emailUnavailable = !emailRequested || !recipientEmail

    if (pushUnavailable && emailUnavailable) {
        return "noop"
    }

    return "failed"
}

async function finalizeDeliveryJob(
    supabase: ReturnType<typeof createClient>,
    deliveryJobId: string | null,
    status: DeliveryJobStatus,
    errorMessage: string | null
) {
    if (!deliveryJobId) {
        return
    }

    const { error } = await supabase.rpc("finalize_notification_delivery_job", {
        p_job_id: deliveryJobId,
        p_status: status,
        p_error: errorMessage,
    })

    if (error) {
        console.error("[send-notification] failed to finalize job", error)
    }
}

/**
 * VAPID JWT 직접 생성 후 Web Push Protocol(RFC 8291/8292)에 따라 암호화 발송.
 * Deno SubtleCrypto만 사용 (외부 패키지 없음).
 */
async function sendWebPush(
    sub: PushSubscriptionRow,
    payload: { title: string; message: string; url: string; tag?: string }
): Promise<{ expired: boolean; endpoint: string }> {
    const vapidPublicRaw = Deno.env.get("VAPID_PUBLIC_KEY") ?? ""
    const vapidPrivateRaw = Deno.env.get("VAPID_PRIVATE_KEY") ?? ""
    const vapidSubject =
        Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@calenber.com"

    if (!vapidPublicRaw || !vapidPrivateRaw) {
        console.warn("[push] VAPID keys not configured")
        throw new Error("[push] VAPID keys not configured")
    }

    const jwt = await buildVapidJwt(sub.endpoint, vapidPrivateRaw, vapidSubject)

    const encrypted = await encryptPayload(
        JSON.stringify({
            title: payload.title,
            message: payload.message,
            icon: "/icons/android-chrome-192x192.png",
            badge: "/icons/badge-72x72.png",
            url: payload.url,
            tag: payload.tag,
        }),
        sub.p256dh,
        sub.auth_key
    )

    const res = await fetch(sub.endpoint, {
        method: "POST",
        headers: {
            Authorization: `vapid t=${jwt},k=${vapidPublicRaw}`,
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            TTL: "86400",
        },
        body: encrypted.buffer as ArrayBuffer,
    })

    if (!res.ok && res.status !== 201) {
        const errText = await res.text().catch(() => String(res.status))
        if (res.status === 410 || res.status === 404) {
            return { expired: true, endpoint: sub.endpoint }
        }
        throw new Error(`[push] send failed ${res.status}: ${errText}`)
    }

    return { expired: false, endpoint: sub.endpoint }
}

// ─────────────────────────────────────────
// VAPID JWT (RFC 8292)
// ─────────────────────────────────────────
async function buildVapidJwt(
    endpoint: string,
    privateKeyB64u: string,
    subject: string
): Promise<string> {
    const audience = new URL(endpoint).origin

    const header = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }))
    const now = Math.floor(Date.now() / 1000)
    const claims = b64u(
        JSON.stringify({ aud: audience, exp: now + 86400, sub: subject })
    )
    const sigInput = `${header}.${claims}`

    const pkcs8 = b64uDecode(privateKeyB64u)
    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        pkcs8.buffer as ArrayBuffer,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
    )

    const sigBuf = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        cryptoKey,
        new TextEncoder().encode(sigInput).buffer as ArrayBuffer
    )

    return `${sigInput}.${b64uFromBuffer(sigBuf)}`
}

// ─────────────────────────────────────────
// RFC 8291 aes128gcm 암호화
// ─────────────────────────────────────────
async function encryptPayload(
    plaintext: string,
    p256dhB64u: string,
    authB64u: string
): Promise<Uint8Array> {
    const authSecret = b64uDecode(authB64u)
    const receiverPublicRaw = b64uDecode(p256dhB64u)

    // 송신자 임시 키 쌍
    const senderKeyPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"]
    )
    const senderPublicRaw = new Uint8Array(
        await crypto.subtle.exportKey("raw", senderKeyPair.publicKey)
    )

    // 수신자 공개키
    const receiverPublicKey = await crypto.subtle.importKey(
        "raw",
        receiverPublicRaw.buffer as ArrayBuffer,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        []
    )

    // ECDH 공유 비밀
    const sharedBits = await crypto.subtle.deriveBits(
        { name: "ECDH", public: receiverPublicKey },
        senderKeyPair.privateKey,
        256
    )
    const sharedSecret = new Uint8Array(sharedBits)

    const salt = crypto.getRandomValues(new Uint8Array(16))

    // HKDF-SHA256 키 유도 (RFC 8291 §3.3)
    const prk = await hkdf(
        authSecret,
        sharedSecret,
        concat(
            label("Content-Encoding: auth\x00"),
            receiverPublicRaw,
            senderPublicRaw
        ),
        32
    )

    const cek = await hkdf(
        salt,
        prk,
        concat(label("Content-Encoding: aes128gcm\x00"), new Uint8Array(1)),
        16
    )
    const nonce = await hkdf(
        salt,
        prk,
        concat(label("Content-Encoding: nonce\x00"), new Uint8Array(1)),
        12
    )

    // AES-128-GCM 암호화
    const cipherKey = await crypto.subtle.importKey(
        "raw",
        cek.buffer as ArrayBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
    )
    const plainBuf = concat(
        new TextEncoder().encode(plaintext),
        new Uint8Array([2])
    ) // padding delimiter
    const cipherBuf = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: nonce.buffer as ArrayBuffer },
        cipherKey,
        plainBuf.buffer as ArrayBuffer
    )
    const ciphertext = new Uint8Array(cipherBuf)

    // RFC 8291 콘텐츠 헤더: salt(16) + rs(4, BE) + idlen(1) + sender-public(65) + ciphertext
    const header = new Uint8Array(16 + 4 + 1 + 65)
    header.set(salt, 0)
    new DataView(header.buffer).setUint32(16, 4096, false)
    header[20] = 65
    header.set(senderPublicRaw, 21)

    return concat(header, ciphertext)
}

// ─────────────────────────────────────────
// 이메일 발송 (Resend)
// ─────────────────────────────────────────
async function sendEmail(
    to: string,
    subject: string,
    text: string,
    url: string
): Promise<boolean> {
    const apiKey = Deno.env.get("RESEND_API_KEY")
    if (!apiKey) {
        console.warn("[email] RESEND_API_KEY not set")
        return false
    }

    const html = `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
  <h2 style="color:#1a1a1a">${subject}</h2>
  <p style="color:#4a4a4a">${text}</p>
  <a href="${url}"
     style="display:inline-block;margin-top:16px;padding:10px 20px;
            background:#000;color:#fff;border-radius:6px;text-decoration:none">
    Calenber에서 확인하기
  </a>
  <p style="margin-top:24px;font-size:12px;color:#999">
    이 알림이 필요 없으면 Calenber 설정에서 이메일 알림을 끄세요.
  </p>
</div>`

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: "Calenber <notifications@calenber.com>",
            to: [to],
            subject,
            html,
        }),
    })

    if (!res.ok) {
        const err = await res.text()
        throw new Error(`[email] Resend error: ${err}`)
    }

    return true
}

// ─────────────────────────────────────────
// 텍스트 생성 헬퍼
// ─────────────────────────────────────────
function buildPushTitle(
    type: string,
    metadata: Record<string, string>
): string {
    switch (type) {
        case "calendar_joined":
            return `${metadata.calendarName ?? "캘린더"}에 새 멤버`
        case "calendar_settings_changed":
            return "캘린더 설정 변경"
        case "event_created":
            return "새 일정 추가됨"
        case "event_updated":
            return "일정이 수정됐습니다"
        case "event_deleted":
            return "일정이 삭제됐습니다"
        case "event_tagged":
            return "일정에서 언급됐습니다"
        case "event_participant_added":
            return "일정 참가자로 추가됐습니다"
        default:
            return "Calenber 알림"
    }
}

function buildPushBody(type: string, metadata: Record<string, string>): string {
    const actor = metadata.actorName ?? "누군가"
    const title = metadata.title?.trim() || "제목 없는 일정"
    const calendarName = metadata.calendarName?.trim() || "캘린더"
    switch (type) {
        case "calendar_joined":
            return `${actor}님이 ${calendarName}에 가입했습니다`
        case "calendar_settings_changed":
            return `${actor}님이 ${calendarName} 설정을 변경했습니다`
        case "event_created":
            return `${actor}님이 ${calendarName}에 ${title} 일정을 추가했습니다`
        case "event_updated":
            return `${actor}님이 ${calendarName}의 ${title} 일정을 수정했습니다`
        case "event_deleted":
            return `${actor}님이 ${calendarName}의 ${title} 일정을 삭제했습니다`
        case "event_tagged":
            return `${actor}님이 ${calendarName}의 ${title} 일정에서 회원님을 언급했습니다`
        case "event_participant_added":
            return `${actor}님이 ${calendarName}의 ${title} 일정에 회원님을 초대했습니다`
        default:
            return "새 알림이 있습니다"
    }
}

function buildNotifUrl(
    appUrl: string,
    entityType: string,
    entityId: string,
    calendarId: string | null
): string {
    if (entityType === "calendar" && calendarId)
        return `${appUrl}/calendar/${calendarId}`
    if (entityType === "event" && calendarId)
        return `${appUrl}/calendar/${calendarId}/${entityId}`
    return `${appUrl}/notifications`
}

// ─────────────────────────────────────────
// 암호화 유틸
// ─────────────────────────────────────────

function b64u(str: string): string {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

function b64uFromBuffer(buf: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "")
}

function b64uDecode(input: string): Uint8Array {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/")
    const pad = padded.length % 4
    const normalized = pad ? padded + "====".slice(pad) : padded
    return new Uint8Array(
        atob(normalized)
            .split("")
            .map((c) => c.charCodeAt(0))
    )
}

function concat(...arrays: Uint8Array[]): Uint8Array {
    const total = arrays.reduce((n, a) => n + a.length, 0)
    const out = new Uint8Array(total)
    let offset = 0
    for (const a of arrays) {
        out.set(a, offset)
        offset += a.length
    }
    return out
}

function label(s: string): Uint8Array {
    return new Uint8Array(s.split("").map((c) => c.charCodeAt(0)))
}

async function hkdf(
    salt: Uint8Array,
    ikm: Uint8Array,
    info: Uint8Array,
    length: number
): Promise<Uint8Array> {
    const hkdfKey = await crypto.subtle.importKey(
        "raw",
        ikm.buffer as ArrayBuffer,
        { name: "HKDF" },
        false,
        ["deriveBits"]
    )
    const bits = await crypto.subtle.deriveBits(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: salt.buffer as ArrayBuffer,
            info: info.buffer as ArrayBuffer,
        },
        hkdfKey,
        length * 8
    )
    return new Uint8Array(bits)
}

function filterChannelsByPreferences(
    requestedChannels: ("push" | "email")[],
    notificationType: string,
    preferences: NotificationPreferenceRow | null
): ("push" | "email")[] {
    const typeEnabled =
        preferences?.type_settings?.[notificationType] !== false

    if (!typeEnabled) {
        return []
    }

    return requestedChannels.filter((channel) => {
        if (channel === "push") {
            if (!(preferences?.push_enabled ?? true)) {
                return false
            }
        }

        if (channel === "email") {
            if (!(preferences?.email_enabled ?? false)) {
                return false
            }
            if ((preferences?.email_digest ?? "realtime") !== "realtime") {
                return false
            }
        }

        return true
    })
}
