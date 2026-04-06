import Link from "next/link"

export const metadata = {
    title: {
        default: "Calenber Docs",
        template: "%s | Calenber",
    },
}

export default function HomePage() {
    return (
        <div className="relative min-h-screen overflow-hidden bg-white text-slate-900 transition-colors duration-300 dark:bg-black dark:text-white">
            {/* 1. Header (Navbar) */}

            {/* 2. Hero Section */}
            <main className="grainy-bg relative px-6 py-32">
                {/* Background Glows (테마별 색상 변경) */}
                <div className="absolute top-[-10%] right-[-10%] -z-10 h-125 w-125 rounded-full bg-blue-400/20 blur-[120px] dark:bg-blue-500/30" />
                <div className="absolute bottom-[-10%] left-[-10%] -z-10 h-100 w-100 rounded-full bg-orange-400/10 blur-[100px] dark:bg-orange-600/20" />

                <div className="mx-auto flex max-w-7xl flex-col items-center text-center lg:items-start lg:text-left">
                    {/* Badge */}
                    <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium dark:border-white/10 dark:bg-white/5">
                        <span className="text-blue-600 dark:text-blue-400">
                            the React.js docs framework you love.
                        </span>
                    </div>

                    <h1 className="mb-6 text-5xl leading-23 font-bold tracking-tight md:text-7xl">
                        기록이 흐르는 순간,
                        <br />
                        <span className="text-blue-500 dark:text-blue-200">
                            우리도 함께 연결됩니다.
                        </span>
                    </h1>

                    <p className="mb-10 max-w-2xl text-lg leading-relaxed break-keep text-slate-600 md:text-xl dark:text-slate-400">
                        서로의 일정이 채워지는 순간을 함께 지켜보고, 지금 이
                        순간의 고민과 설렘을 공유하세요. 따로 있어도 같은 화면
                        위에서 소통하며, 우리의 오늘을 가장 생생하게 기록합니다.
                    </p>

                    <div className="flex flex-wrap gap-4">
                        <Link
                            href="/docs"
                            className="text-md rounded-full bg-blue-400 px-8 py-3 font-bold text-black shadow-lg shadow-blue-400/20 transition-all hover:bg-blue-300"
                        >
                            Getting Started
                        </Link>
                        <a
                            href="/"
                            className="text-md rounded-full bg-slate-100 px-8 py-3 font-bold transition-all hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20"
                        >
                            Demo
                        </a>
                    </div>

                    {/* 3. Dashboard Preview Card */}
                    <div className="group relative mx-auto mt-24 w-full max-w-5xl">
                        <div className="absolute -inset-1 rounded-3xl bg-linear-to-r from-blue-500 to-orange-500 opacity-20 blur transition duration-1000 group-hover:opacity-30"></div>
                        <div className="relative flex aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-white/50 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/80">
                            {/* Sidebar Mockup */}
                            <div className="hidden w-1/4 border-r border-slate-200 bg-slate-50/50 p-4 sm:block dark:border-white/10 dark:bg-white/2">
                                <div className="mb-4 h-4 w-2/3 rounded bg-slate-200 dark:bg-white/10" />
                                <div className="space-y-2">
                                    <div className="h-8 w-full rounded-md border border-blue-400/20 bg-blue-400/10" />
                                    <div className="h-8 w-full rounded-md bg-slate-200/50 dark:bg-white/5" />
                                    <div className="h-8 w-full rounded-md bg-slate-200/50 dark:bg-white/5" />
                                </div>
                            </div>
                            {/* Content Mockup */}
                            <div className="flex-1 p-8">
                                <div className="mb-6 h-6 w-1/4 rounded bg-slate-200 dark:bg-white/10" />
                                <div className="mb-8 h-10 w-1/2 rounded bg-slate-300 dark:bg-white/20" />
                                <div className="space-y-4">
                                    <div className="h-4 w-full rounded bg-slate-200 dark:bg-white/10" />
                                    <div className="h-4 w-5/6 rounded bg-slate-200 dark:bg-white/10" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
