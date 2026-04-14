import type { User } from "@supabase/supabase-js"

export type AppUser = {
    id: string
    email: string | null
    name: string | null
    avatarUrl: string | null
}

export function mapUser(user: User | null): AppUser | null {
    if (!user) return null

    return {
        id: user.id,
        email: user.email ?? null,
        name: user.user_metadata?.name ?? null,
        avatarUrl: user.user_metadata?.avatar_url ?? null,
    }
}
