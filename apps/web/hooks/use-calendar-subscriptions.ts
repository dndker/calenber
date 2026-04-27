"use client"

import { resolveSubscriptionCatalogIdForInstall } from "@/lib/calendar/resolve-subscription-catalog-id"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useMemo } from "react"

export function useCalendarSubscriptions() {
    const activeCalendarId = useCalendarStore((s) => s.activeCalendar?.id ?? "demo")
    const subscriptionCatalogs = useCalendarStore((s) => s.subscriptionCatalogs)
    const subscriptionState = useCalendarStore((s) => s.subscriptionState)
    const setSubscriptionState = useCalendarStore((s) => s.setSubscriptionState)
    const installSubscriptionSnapshot = useCalendarStore(
        (s) => s.installSubscription
    )
    const uninstallSubscriptionSnapshot = useCalendarStore(
        (s) => s.uninstallSubscription
    )
    const toggleSubscriptionVisibilitySnapshot = useCalendarStore(
        (s) => s.toggleSubscriptionVisibility
    )

    const subscriptions = useMemo(() => subscriptionCatalogs, [subscriptionCatalogs])
    const subscriptionMap = useMemo(
        () =>
            new Map(
                subscriptions.map((subscription) => [subscription.id, subscription])
            ),
        [subscriptions]
    )
    const installedIdSet = useMemo(
        () => new Set(subscriptionState.installedSubscriptionIds),
        [subscriptionState.installedSubscriptionIds]
    )
    const hiddenIdSet = useMemo(
        () => new Set(subscriptionState.hiddenSubscriptionIds),
        [subscriptionState.hiddenSubscriptionIds]
    )
    const installedSubscriptions = useMemo(
        () =>
            subscriptionState.installedSubscriptionIds
                .map((subscriptionId) => subscriptionMap.get(subscriptionId))
                .filter(
                    (
                        subscription
                    ): subscription is (typeof subscriptions)[number] =>
                        Boolean(subscription)
                ),
        [subscriptionMap, subscriptionState.installedSubscriptionIds]
    )
    const visibleSubscriptions = useMemo(
        () =>
            installedSubscriptions.filter(
                (subscription) => !hiddenIdSet.has(subscription.id)
            ),
        [hiddenIdSet, installedSubscriptions]
    )

    const installSubscription = async (subscriptionId: string) => {
        if (!activeCalendarId || activeCalendarId === "demo") {
            installSubscriptionSnapshot(subscriptionId)
            return true
        }

        const supabase = createBrowserSupabase()
        const catalogUuid = await resolveSubscriptionCatalogIdForInstall(
            supabase,
            subscriptionId
        )

        if (!catalogUuid) {
            return false
        }

        installSubscriptionSnapshot(catalogUuid)
        try {
            const { error } = await supabase
                .from("calendar_subscription_installs")
                .upsert(
                    {
                        calendar_id: activeCalendarId,
                        subscription_catalog_id: catalogUuid,
                        is_visible: true,
                    },
                    { onConflict: "calendar_id,subscription_catalog_id" }
                )
            if (error) {
                throw error
            }
            return true
        } catch {
            setSubscriptionState({
                installedSubscriptionIds:
                    subscriptionState.installedSubscriptionIds.filter(
                        (id) => id !== catalogUuid
                    ),
                hiddenSubscriptionIds: subscriptionState.hiddenSubscriptionIds.filter(
                    (id) => id !== catalogUuid
                ),
            })
            return false
        }
    }

    const uninstallSubscription = async (subscriptionId: string) => {
        const prevState = subscriptionState

        if (!activeCalendarId || activeCalendarId === "demo") {
            uninstallSubscriptionSnapshot(subscriptionId)
            return true
        }

        const supabase = createBrowserSupabase()
        const catalogUuid = await resolveSubscriptionCatalogIdForInstall(
            supabase,
            subscriptionId
        )

        if (!catalogUuid) {
            return false
        }

        uninstallSubscriptionSnapshot(catalogUuid)

        try {
            const { error } = await supabase
                .from("calendar_subscription_installs")
                .delete()
                .eq("calendar_id", activeCalendarId)
                .eq("subscription_catalog_id", catalogUuid)
            if (error) {
                throw error
            }
            return true
        } catch {
            setSubscriptionState(prevState)
            return false
        }
    }

    const toggleSubscriptionVisibility = async (subscriptionId: string) => {
        const prevState = subscriptionState

        if (!activeCalendarId || activeCalendarId === "demo") {
            toggleSubscriptionVisibilitySnapshot(subscriptionId)
            return true
        }

        const supabase = createBrowserSupabase()
        const catalogUuid = await resolveSubscriptionCatalogIdForInstall(
            supabase,
            subscriptionId
        )

        if (!catalogUuid) {
            return false
        }

        const nextHidden = hiddenIdSet.has(catalogUuid) ? false : true

        toggleSubscriptionVisibilitySnapshot(catalogUuid)

        try {
            const { error } = await supabase
                .from("calendar_subscription_installs")
                .update({ is_visible: !nextHidden })
                .eq("calendar_id", activeCalendarId)
                .eq("subscription_catalog_id", catalogUuid)
            if (error) {
                throw error
            }
            return true
        } catch {
            setSubscriptionState(prevState)
            return false
        }
    }

    return {
        subscriptions,
        installedSubscriptions,
        visibleSubscriptions,
        installedIdSet,
        hiddenIdSet,
        subscriptionState,
        installSubscription,
        uninstallSubscription,
        toggleSubscriptionVisibility,
    }
}
