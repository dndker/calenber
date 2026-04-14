"use client"

import type { AppUser } from "@workspace/lib/supabase/map-user"
import { createSSRStore } from "./createSSRStore"

type AuthState = {
    user: AppUser | null

    isLoading: boolean

    setUser: (user: AuthState["user"]) => void
    setLoading: (loading: boolean) => void
}

export const useAuthStore = createSSRStore<AuthState>((set) => ({
    user: null,
    isLoading: true,

    setUser: (user) => set({ user }),
    setLoading: (loading) => set({ isLoading: loading }),
}))

export const AuthStoreProvider = useAuthStore.StoreProvider
