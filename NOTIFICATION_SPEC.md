# Calenber Notification System Spec

> Last updated: 2026-05-02
> Purpose: This document is the AI-facing source of truth for the current notification architecture, recent fixes, remaining risks, and deployment expectations.
> Human-readable companion doc: `docs/NOTIFICATION_GUIDE.md`

## 1. Current Architecture

```text
[Notification Producers]
  A. Explicit app/API actions
  B. DB-triggered event history notifications
            |
            v
public.create_notification(...) / public.create_notification_if_absent(...)
  1) insert into notifications
  2) upsert notification_digests
  3) enqueue notification_delivery_queue
            |
            +--> Realtime on notification_digests
            |      |
            |      v
            |   useNotificationRealtime()
            |      |
            |      v
            |   Zustand notification store
            |      |
            |      v
            |   badge / dropdown / notifications page
            |
            +--> DB trigger on notification_delivery_queue
                   |
                   v
                 pg_net net.http_post(...)
                   |
                   v
      Supabase Edge Function: send-notification
        1) verify webhook secret
        2) claim job via begin_notification_delivery_job(jobId)
        3) read notification + preferences + subscriptions
        4) deliver push/email
        5) finalize job as sent / failed / noop
                   |
                   v
             pg_cron fallback
               - re-dispatch pending/failed jobs every minute
```

## 2. Design Goals

- Separate inbox creation from external delivery.
- Keep client reads cheap via `notification_digests`.
- Allow DB-triggered notifications to use the same delivery pipeline as API-triggered notifications.
- Make delivery asynchronous and retryable.
- Avoid browser-session dependence for push/email dispatch.
- Keep unread badge and notification list realtime-synced.

## 3. Main Data Model

### `public.notifications`

Raw notification log.

- One row per recipient.
- Source of truth for individual notification events.
- Tracks `push_sent_at` and `email_sent_at` when a channel actually delivers.

### `public.notification_digests`

Client read model.

- One row per `(recipient_id, digest_key)`.
- Used for bell badge, dropdown, and notifications page.
- Stores denormalized snapshot data so the client can render from one row.

Important columns:

- `latest_notification_id`
- `count`
- `unread_count`
- `actor_ids`
- `last_occurred_at`
- `notification_type`
- `entity_type`
- `entity_id`
- `calendar_id`
- `metadata`
- `is_read`

Expected event-oriented metadata keys:

- `title`
- `calendarName`
- `actorName`
- `actorAvatarUrl`
- `changedFields`

### `public.user_notification_preferences`

Recipient delivery preferences.

- `push_enabled`
- `email_enabled`
- `type_settings`
- `email_digest`
- `quiet_hours`

Important note:

- Missing preference row is treated as defaults in the app.

### `public.push_subscriptions`

Web Push subscriptions per user/device.

- `endpoint`
- `p256dh`
- `auth_key`
- `device_label`
- `expires_at`

### `public.notification_delivery_queue`

Outbox / delivery queue.

Important columns:

- `notification_id uuid unique`
- `recipient_id uuid`
- `channels text[]`
- `status text`
  - `pending`
  - `processing`
  - `sent`
  - `failed`
  - `noop`
- `attempt_count int`
- `last_attempted_at`
- `processed_at`
- `locked_at`
- `last_error text`

Semantics:

- `pending`: ready to dispatch
- `processing`: claimed by a worker
- `sent`: at least one requested channel actually delivered
- `failed`: transport failure happened
- `noop`: notification was processed but nothing was deliverable

## 4. Core DB Functions

### Read-side

- `get_notifications(p_limit, p_cursor, p_unread_only)`
- `get_unread_notification_count()`
- `mark_notifications_read(p_digest_keys)`

Current behavior:

- `get_notifications()` reads `notification_digests`, not `notifications`.
- `mark_notifications_read()` updates both `notifications` and `notification_digests`.

### Write-side

#### `create_notification(...)`

Responsibilities:

1. Insert raw notification row into `notifications`
2. Upsert aggregated read model row into `notification_digests`
3. Enqueue external delivery into `notification_delivery_queue`

This function is service-role only.

#### `create_notification_if_absent(...)`

Added in `20260506250000_harden_notification_delivery_and_idempotency.sql`.

Purpose:

- Atomic debounce/idempotency wrapper for explicit route-triggered notifications.
- Prevent duplicate creation under concurrent requests.

How it works:

1. Builds the digest key
2. Acquires transaction advisory lock on `(recipient_id, actor_id, digest_key)`
3. Checks for a recent matching notification inside the dedupe window
4. Returns existing id if found
5. Otherwise calls `create_notification(...)`

This replaces the older route-level pre-read dedupe logic.

### Delivery-side

#### `resolve_notification_delivery_channels(...)`

Computes target channels from:

- notification type settings
- push enabled flag
- email enabled flag
- email digest mode
- presence of push subscriptions

#### `enqueue_notification_delivery(...)`

Creates or refreshes one queue job for a notification.

- `channels = []` becomes `status = 'noop'`
- non-empty channels become `status = 'pending'`

#### `begin_notification_delivery_job(job_id)`

Atomically claims one job by:

- moving `pending` or `failed` -> `processing`
- incrementing attempt count
- setting `locked_at` and `last_attempted_at`

#### `finalize_notification_delivery_job(job_id, status, error)`

Added in `20260506250000_harden_notification_delivery_and_idempotency.sql`.

Purpose:

- Finalize queue jobs with exact status rather than only boolean success/failure.

Behavior:

- `sent`: delivered through at least one requested channel
- `failed`: transport error or unexpected processing failure
- `noop`: preferences/subscriptions/email target left nothing deliverable

#### `dispatch_notification_delivery_job(job_id)`

Calls the Edge Function webhook through `pg_net`.

Requires Vault secrets:

- `notification_delivery_function_url`
- `notification_delivery_webhook_secret`

#### `dispatch_pending_notification_delivery_jobs(limit)`

Fallback dispatcher used by cron to re-kick stuck or failed jobs.

## 5. Delivery Execution Flow

### API-triggered path

1. App calls `/api/notifications/trigger`
2. Route authenticates requester
3. Route filters out self-notifications
4. Route calls `create_notification_if_absent(...)` for each recipient
5. DB creates notification, digest, queue
6. Queue trigger dispatches Edge Function via `pg_net`
7. Edge Function claims and delivers
8. Job is finalized as `sent`, `failed`, or `noop`

### DB-triggered path

1. `event_history` insert fires notification trigger
2. Trigger decides recipient list
3. Trigger calls `create_notification(...)`
4. From that point the flow is identical to the API-triggered path

## 6. Client Sync Flow

### Global sync

Mounted in:

- `apps/web/app/layout.tsx`
- `apps/web/components/provider/notification-sync.tsx`

Responsibilities:

- seed initial notification state from SSR when possible
- mount realtime subscription once at app level
- reset notification state on logout
- avoid redundant client fetches immediately after SSR hydration
- run unread count sync on login only when store is not already hydrated
- run throttled unread count resync on `focus` and `visibilitychange`

SSR behavior:

- `RootLayout` preloads a small notification digest slice and unread count on the server.
- The preloaded state is injected into `NotificationStoreProvider`.
- This allows the bell badge to render immediately on first paint instead of waiting for client-side fetch.
- If unread count RPC fails during SSR, the store falls back to the sum of preloaded digest unread counts.

### Realtime

`apps/web/hooks/use-notification-realtime.ts`

- subscribes to `notification_digests` for the current user
- maps changed row into client digest format
- upserts directly into the Zustand store

### Zustand store

`apps/web/store/useNotificationStore.ts`

Responsibilities:

- load notification digests
- prime a lightweight initial digest slice for badge/dropdown fallback
- compute initial unread count from loaded digests
- append paginated data
- upsert realtime updates
- optimistic mark-read / mark-all-read
- load/save notification preferences
- resync unread count from RPC
- fall back to digest-summed unread count if unread RPC times out

## 7. Edge Function Behavior

File:

- `supabase/functions/send-notification/index.ts`

Current behavior:

1. Accepts webhook POST
2. Verifies `x-notification-webhook-secret`
3. Claims queue job via `begin_notification_delivery_job(jobId)`
4. Loads notification record
5. Loads recipient preferences
6. Loads recipient email
7. Builds title/body/url
8. Filters requested channels by current preferences
9. Sends push and/or email
10. Cleans expired push endpoints
11. Updates `push_sent_at` / `email_sent_at` only on actual channel delivery
12. Finalizes queue job:
   - `sent` when at least one requested channel delivered
   - `noop` when no requested channel is still deliverable
   - `failed` on transport or processing failure

Important note:

- `quiet_hours` is currently persisted but not enforced in delivery decisions because the preference model does not yet store a per-user timezone. Incorrectly suppressing notifications is considered worse than temporarily not enforcing quiet hours.

## 8. Recent Fixes Applied

### UI / read model

- Added global notification sync provider
- Moved realtime subscription to app-level mount
- Fixed unread badge not appearing until a later event
- Fixed initial unread count calculation during digest load
- Fixed `is_read` projection drift in notification reads
- Added default preference fallback for users without preference rows
- Added SSR preload of unread count and a small digest slice in `RootLayout`
- Updated notification store hydration so the bell badge can render immediately on first paint
- Reduced redundant post-hydration client calls to `get_notifications` / `get_unread_notification_count`
- Added timeout fallback for unread sync so badge state can recover from slow RPC responses

### Delivery / backend

- Added `notification_delivery_queue` outbox table
- Moved external channel orchestration behind queue
- Added `pg_net` webhook dispatch trigger
- Added `pg_cron` re-dispatch fallback
- Updated Edge Function to clean expired push subscriptions
- Added exact queue finalization with `sent/failed/noop`
- Replaced route-level non-atomic dedupe with DB-level `create_notification_if_absent(...)`
- Scoped noisy event update notifications to interested recipients

## 9. Remaining Known Risks

- Delivery depends on Supabase extensions and secrets being configured correctly:
  - `pg_net`
  - `pg_cron`
  - Vault secrets
  - Edge secret `NOTIFICATION_WEBHOOK_SECRET`
- `quiet_hours` is not actively enforced yet. To support it safely, the preference model needs a reliable timezone source per user.
- Email digest modes `daily` and `weekly` are stored, but digest batching infrastructure is not implemented yet.
- Some notification types exist in settings/UI but may not yet have all producer paths wired.
- `process-pending` route exists as a manual/debug fallback, but primary operation should rely on DB trigger + cron.

## 10. Files to Inspect First

### DB / backend

- `supabase/migrations/20260506100000_add_notification_system.sql`
- `supabase/migrations/20260506200000_add_event_history_notification_trigger.sql`
- `supabase/migrations/20260506215000_scope_event_update_notification_recipients.sql`
- `supabase/migrations/20260506220000_denormalize_notification_digest_snapshot.sql`
- `supabase/migrations/20260506230000_add_notification_delivery_queue.sql`
- `supabase/migrations/20260506240000_add_pg_net_notification_delivery_webhook.sql`
- `supabase/migrations/20260506250000_harden_notification_delivery_and_idempotency.sql`
- `supabase/migrations/20260506260000_add_calendar_name_to_event_notification_metadata.sql`
- `supabase/functions/send-notification/index.ts`

### Web app

- `apps/web/app/layout.tsx`
- `apps/web/app/api/notifications/trigger/route.ts`
- `apps/web/app/api/notifications/process-pending/route.ts`
- `apps/web/components/provider/notification-sync.tsx`
- `apps/web/hooks/use-notification-realtime.ts`
- `apps/web/store/useNotificationStore.ts`
- `apps/web/lib/notification/queries.ts`
- `apps/web/lib/notification/mutations.ts`
- `apps/web/lib/notification/push.ts`

## 11. Deployment Checklist

1. Run new migrations, including `20260506250000_harden_notification_delivery_and_idempotency.sql`
2. Configure Vault secret `notification_delivery_function_url`
3. Configure Vault secret `notification_delivery_webhook_secret`
4. Configure Edge secret `NOTIFICATION_WEBHOOK_SECRET`
5. Ensure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` are set for the Edge Function
6. Ensure `RESEND_API_KEY` is set if email delivery is required
7. Deploy `supabase/functions/send-notification`
8. Verify `pg_net` and `pg_cron` are enabled in the target Supabase project

## 12. Operational Interpretation

Use queue status like this:

- `sent`: successfully delivered through at least one actual external channel
- `failed`: processing/transport failed and cron may retry
- `noop`: notification was valid but no current deliverable channel existed

Do not interpret `noop` as a system error.
