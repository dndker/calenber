import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export function middleware(request: NextRequest) {
    const theme = request.cookies.get("theme")

    // 쿠키 없으면 기본값 세팅
    if (!theme) {
        const response = NextResponse.next()

        response.cookies.set("theme", "light", {
            path: "/",
            maxAge: 60 * 60 * 24 * 365, // 1년
        })

        return response
    }

    return NextResponse.next()
}
