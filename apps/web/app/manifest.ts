// app/manifest.ts
import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
    const env = process.env.VERCEL_ENV ?? "development"
    const isDev = env === "preview"
    const isProd = env === "production"

    const name = isProd
        ? "Calenber"
        : isDev
          ? "Calenber(dev)"
          : "Calenber(local)"

    const shortName = isProd ? "캘린버" : isDev ? "캘린버 Dev" : "캘린버 Local"

    return {
        id: isProd ? "/calendar" : isDev ? "/calendar-dev" : "/calendar-local",

        name,
        short_name: shortName,
        description: "일정, 그 이상을 기억하다.",

        start_url: "/",
        scope: "/",

        lang: "ko",
        dir: "ltr",

        display: "standalone",
        display_override: [
            "window-controls-overlay",
            "minimal-ui",
            "standalone",
        ],
        orientation: "portrait",

        prefer_related_applications: false,

        categories: ["productivity", "utilities"],

        theme_color: "#ffffff",
        background_color: "#ffffff",

        icons: [
            // 👉 그대로 유지
            {
                src: "/icons/rounded/windows11/SmallTile.scale-100.png",
                sizes: "71x71",
                type: "image/png",
            },
            {
                src: "/icons/rounded/windows11/SmallTile.scale-125.png",
                sizes: "89x89",
                type: "image/png",
            },
            {
                src: "/icons/rounded/windows11/SmallTile.scale-150.png",
                sizes: "107x107",
                type: "image/png",
            },
            {
                src: "/icons/rounded/windows11/SmallTile.scale-200.png",
                sizes: "142x142",
                type: "image/png",
            },
            {
                src: "/icons/rounded/windows11/SmallTile.scale-400.png",
                sizes: "284x284",
                type: "image/png",
            },

            // android
            {
                src: "/icons/rounded/android/android-launchericon-512-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
            {
                src: "/icons/rounded/android/android-launchericon-192-192.png",
                sizes: "192x192",
                type: "image/png",
            },

            // ios
            {
                src: "/icons/rounded/ios/180.png",
                sizes: "180x180",
                type: "image/png",
            },
            {
                src: "/icons/rounded/ios/512.png",
                sizes: "512x512",
                type: "image/png",
            },
        ],

        shortcuts: [
            {
                name: "새 일정 만들기",
                short_name: "새 일정",
                description: "빠르게 새 일정을 생성",
                url: "/",
                icons: [
                    {
                        src: "/icons/rounded/android/android-launchericon-96-96.png",
                        sizes: "96x96",
                        type: "image/png",
                    },
                ],
            },
            {
                name: "내 일정 보기",
                short_name: "내 일정",
                description: "내 일정 확인하기",
                url: "/",
                icons: [
                    {
                        src: "/icons/rounded/android/android-launchericon-96-96.png",
                        sizes: "96x96",
                        type: "image/png",
                    },
                ],
            },
        ],

        screenshots: [
            {
                src: "/screenshots/mobile1-414x896.png",
                sizes: "828x1792",
                type: "image/png",
            },
            {
                src: "/screenshots/mobile2-414x896.png",
                sizes: "828x1792",
                type: "image/png",
            },
            {
                src: "/screenshots/desktop1-1920x1080.png",
                sizes: "3840x2160",
                type: "image/png",
                form_factor: "wide",
            },
            {
                src: "/screenshots/desktop2-1920x1080.png",
                sizes: "3840x2160",
                type: "image/png",
                form_factor: "wide",
            },
        ],

        launch_handler: {
            client_mode: ["navigate-existing", "auto"],
        },
    }
}
