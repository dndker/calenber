import { Geist_Mono, Inter } from "next/font/google"

import { ThemeContextProvider } from "@/components/provider/theme-context"
import { ThemeProvider } from "@/components/provider/theme-provider"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import "@workspace/ui/globals.css"
import { cn } from "@workspace/ui/lib/utils"
import type { Metadata, Viewport } from "next"
import { cookies } from "next/headers"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
})

const APP_DEFAULT_TITLE = "캘린버"
const APP_TITLE_TEMPLATE = "%s - 캘린버"
const APP_DESCRIPTION = "일정, 그 이상을 기억하다."

export const metadata: Metadata = {
    applicationName: "캘린버",
    title: {
        default: APP_DEFAULT_TITLE,
        template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
    manifest: `/manifest.json`,
    openGraph: {
        type: "website",
        locale: "ko_KR",
        // url: "https://your-domain.com/",
        siteName: "캘린버",
        images: [
            {
                url: "/icons/meta.png",
                width: 1200,
                height: 630,
                alt: "일정, 그 이상을 기억하다. - 캘린버",
                type: "image/png",
            },
        ],
    },
    twitter: {
        card: "summary",
        title: {
            default: APP_DEFAULT_TITLE,
            template: APP_TITLE_TEMPLATE,
        },
        images: [
            {
                url: "/icons/meta.png",
                width: 1200,
                height: 630,
                alt: "일정, 그 이상을 기억하다. - 캘린버",
                type: "image/png",
            },
        ],
        description: APP_DESCRIPTION,
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: APP_DEFAULT_TITLE,
        startupImage: [
            // iPhone 16 Pro Max
            {
                url: "/splash_screens/iPhone_16_Pro_Max_landscape.png",
                media: "screen and (device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_16_Pro_Max_portrait.png",
                media: "screen and (device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/iPhone_16_Pro_Max_landscape.png",
                media: "screen and (device-width: 1320px) and (device-height: 2868px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_16_Pro_Max_portrait.png",
                media: "screen and (device-width: 1320px) and (device-height: 2868px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
            },

            // iPhone 16 Pro
            {
                url: "/splash_screens/iPhone_16_Pro_landscape.png",
                media: "screen and (device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_16_Pro_portrait.png",
                media: "screen and (device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/iPhone_16_Pro_landscape.png",
                media: "screen and (device-width: 1206px) and (device-height: 2622px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_16_Pro_portrait.png",
                media: "screen and (device-width: 1206px) and (device-height: 2622px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
            },

            // iPhone 16 Plus / 15 Pro Max / 15 Plus / 14 Pro Max
            {
                url: "/splash_screens/iPhone_16_Plus__iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max_landscape.png",
                media: "screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_16_Plus__iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max_portrait.png",
                media: "screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/iPhone_16_Plus__iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max_landscape.png",
                media: "screen and (device-width: 1290px) and (device-height: 2796px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_16_Plus__iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max_portrait.png",
                media: "screen and (device-width: 1290px) and (device-height: 2796px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
            },

            // iPhone 14 Pro / 15 Pro / 15
            {
                url: "/splash_screens/iPhone_16__iPhone_15_Pro__iPhone_15__iPhone_14_Pro_landscape.png",
                media: "screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_16__iPhone_15_Pro__iPhone_15__iPhone_14_Pro_portrait.png",
                media: "screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/iPhone_16__iPhone_15_Pro__iPhone_15__iPhone_14_Pro_landscape.png",
                media: "screen and (device-width: 1179px) and (device-height: 2556px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_16__iPhone_15_Pro__iPhone_15__iPhone_14_Pro_portrait.png",
                media: "screen and (device-width: 1179px) and (device-height: 2556px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
            },

            // iPhone 14 / 13 Pro / 13 / 12 Pro / 12
            {
                url: "/splash_screens/iPhone_16e__iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_landscape.png",
                media: "screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_16e__iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_portrait.png",
                media: "screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/iPhone_16e__iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_landscape.png",
                media: "screen and (device-width: 1170px) and (device-height: 2532px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_16e__iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_portrait.png",
                media: "screen and (device-width: 1170px) and (device-height: 2532px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
            },

            // iPhone 13 mini / 12 mini / 11 Pro / XS / X
            {
                url: "/splash_screens/iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_landscape.png",
                media: "screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_portrait.png",
                media: "screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_landscape.png",
                media: "screen and (device-width: 1125px) and (device-height: 2436px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_portrait.png",
                media: "screen and (device-width: 1125px) and (device-height: 2436px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
            },

            // iPhone 11 Pro Max / XS Max
            {
                url: "/splash_screens/iPhone_11_Pro_Max__iPhone_XS_Max_landscape.png",
                media: "screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_11_Pro_Max__iPhone_XS_Max_portrait.png",
                media: "screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/iPhone_11_Pro_Max__iPhone_XS_Max_landscape.png",
                media: "screen and (device-width: 1242px) and (device-height: 2688px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_11_Pro_Max__iPhone_XS_Max_portrait.png",
                media: "screen and (device-width: 1242px) and (device-height: 2688px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
            },

            // iPhone 11 / XR
            {
                url: "/splash_screens/iPhone_11__iPhone_XR_landscape.png",
                media: "screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_11__iPhone_XR_portrait.png",
                media: "screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/iPhone_11__iPhone_XR_landscape.png",
                media: "screen and (device-width: 828px) and (device-height: 1792px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_11__iPhone_XR_portrait.png",
                media: "screen and (device-width: 828px) and (device-height: 1792px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },

            // iPhone 8 Plus / 7 Plus / 6s Plus / 6 Plus
            {
                url: "/splash_screens/iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_landscape.png",
                media: "screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_portrait.png",
                media: "screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_landscape.png",
                media: "screen and (device-width: 1242px) and (device-height: 2208px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_portrait.png",
                media: "screen and (device-width: 1242px) and (device-height: 2208px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
            },

            // iPhone 8 / 7 / 6s / 6 / SE (4.7")
            {
                url: "/splash_screens/iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_landscape.png",
                media: "screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_portrait.png",
                media: "screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_landscape.png",
                media: "screen and (device-width: 750px) and (device-height: 1334px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_portrait.png",
                media: "screen and (device-width: 750px) and (device-height: 1334px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },

            // iPhone SE (1st gen) / iPod touch 5th+
            {
                url: "/splash_screens/4__iPhone_SE__iPod_touch_5th_generation_and_later_landscape.png",
                media: "screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/4__iPhone_SE__iPod_touch_5th_generation_and_later_portrait.png",
                media: "screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/4__iPhone_SE__iPod_touch_5th_generation_and_later_landscape.png",
                media: "screen and (device-width: 640px) and (device-height: 1136px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/4__iPhone_SE__iPod_touch_5th_generation_and_later_portrait.png",
                media: "screen and (device-width: 640px) and (device-height: 1136px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },

            // iPad Pro / Air / 일반 iPad landscape
            {
                url: "/splash_screens/13__iPad_Pro_M4_landscape.png",
                media: "screen and (device-width: 1032px) and (device-height: 1376px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/12.9__iPad_Pro_landscape.png",
                media: "screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/11__iPad_Pro_M4_landscape.png",
                media: "screen and (device-width: 834px) and (device-height: 1210px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/11__iPad_Pro__10.5__iPad_Pro_landscape.png",
                media: "screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/10.9__iPad_Air_landscape.png",
                media: "screen and (device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/10.5__iPad_Air_landscape.png",
                media: "screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/10.2__iPad_landscape.png",
                media: "screen and (device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad_landscape.png",
                media: "screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/8.3__iPad_Mini_landscape.png",
                media: "screen and (device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/13__iPad_Pro_M4_landscape.png",
                media: "screen and (device-width: 2064px) and (device-height: 2752px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/12.9__iPad_Pro_landscape.png",
                media: "screen and (device-width: 2048px) and (device-height: 2732px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/11__iPad_Pro_M4_landscape.png",
                media: "screen and (device-width: 1668px) and (device-height: 2420px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/11__iPad_Pro__10.5__iPad_Pro_landscape.png",
                media: "screen and (device-width: 1668px) and (device-height: 2388px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/10.9__iPad_Air_landscape.png",
                media: "screen and (device-width: 1640px) and (device-height: 2360px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/10.5__iPad_Air_landscape.png",
                media: "screen and (device-width: 1668px) and (device-height: 2224px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/10.2__iPad_landscape.png",
                media: "screen and (device-width: 1620px) and (device-height: 2160px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad_landscape.png",
                media: "screen and (device-width: 1536px) and (device-height: 2048px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },
            {
                url: "/splash_screens/8.3__iPad_Mini_landscape.png",
                media: "screen and (device-width: 1488px) and (device-height: 2266px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
            },

            // iPad Pro / Air / 일반 iPad portrait
            {
                url: "/splash_screens/13__iPad_Pro_M4_portrait.png",
                media: "screen and (device-width: 1032px) and (device-height: 1376px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/12.9__iPad_Pro_portrait.png",
                media: "screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/11__iPad_Pro_M4_portrait.png",
                media: "screen and (device-width: 834px) and (device-height: 1210px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/11__iPad_Pro__10.5__iPad_Pro_portrait.png",
                media: "screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/10.9__iPad_Air_portrait.png",
                media: "screen and (device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/10.5__iPad_Air_portrait.png",
                media: "screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/10.2__iPad_portrait.png",
                media: "screen and (device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad_portrait.png",
                media: "screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/8.3__iPad_Mini_portrait.png",
                media: "screen and (device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/13__iPad_Pro_M4_portrait.png",
                media: "screen and (device-width: 2064px) and (device-height: 2752px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/12.9__iPad_Pro_portrait.png",
                media: "screen and (device-width: 2048px) and (device-height: 2732px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/11__iPad_Pro_M4_portrait.png",
                media: "screen and (device-width: 1668px) and (device-height: 2420px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/11__iPad_Pro__10.5__iPad_Pro_portrait.png",
                media: "screen and (device-width: 1668px) and (device-height: 2388px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/10.9__iPad_Air_portrait.png",
                media: "screen and (device-width: 1640px) and (device-height: 2360px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/10.5__iPad_Air_portrait.png",
                media: "screen and (device-width: 1668px) and (device-height: 2224px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/10.2__iPad_portrait.png",
                media: "screen and (device-width: 1620px) and (device-height: 2160px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad_portrait.png",
                media: "screen and (device-width: 1536px) and (device-height: 2048px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
            {
                url: "/splash_screens/8.3__iPad_Mini_portrait.png",
                media: "screen and (device-width: 1488px) and (device-height: 2266px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
            },
        ],
    },
    formatDetection: {
        telephone: false,
    },
    icons: {
        icon: "/icons/rounded/android/android-launchericon-512-512.png",
        apple: "/icons/rounded/ios/512.png",
    },
    other: {
        "apple-mobile-web-app-capable": "yes",
    },
}

export const viewport: Viewport = {
    userScalable: false,
    themeColor: "var(--background)",
}

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    const cookieStore = await cookies()
    const theme = cookieStore.get("theme")?.value ?? "system"
    return (
        <html
            lang="ko"
            suppressHydrationWarning
            className={cn(
                "antialiased",
                fontMono.variable,
                "font-sans",
                inter.variable
            )}
        >
            <body>
                <ThemeContextProvider theme={theme}>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme={theme}
                        disableTransitionOnChange
                        enableSystem
                    >
                        <TooltipProvider>{children}</TooltipProvider>
                    </ThemeProvider>
                </ThemeContextProvider>
                <Analytics />
                <SpeedInsights />
            </body>
        </html>
    )
}
