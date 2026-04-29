import type { SupabaseClient } from "@supabase/supabase-js"

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * 구독 설치 시 `calendar_subscription_installs.subscription_catalog_id`(UUID)가 필요합니다.
 * 카탈로그 행은 slug로 조회하고, 이미 UUID면 그대로 반환합니다.
 */
export async function resolveSubscriptionCatalogIdForInstall(
    supabase: SupabaseClient,
    catalogRef: string
): Promise<string | null> {
    const trimmed = catalogRef.trim()

    if (UUID_RE.test(trimmed)) {
        return trimmed
    }

    const { data, error } = await supabase
        .from("calendar_subscription_catalogs")
        .select("id")
        .eq("slug", trimmed)
        .maybeSingle()

    if (error || !data?.id) {
        return null
    }

    return data.id
}
