import { SignInForm } from "@/components/auth/sign-in-form"

export default async function SignInPage({
    searchParams,
}: {
    searchParams: Promise<{ error?: string; verified?: string; notice?: string }>
}) {
    const { error, verified, notice } = await searchParams

    return (
        <SignInForm
            initialError={error ?? null}
            initialVerified={verified === "1"}
            initialNotice={notice ?? null}
        />
    )
}
