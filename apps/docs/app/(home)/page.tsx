import Link from "next/link";

export const metadata = {
    title: {
        default: "Calenber Docs",
        template: "%s | Calenber",
    },
};

export default function HomePage() {
    return (
        <div className="relative min-h-screen bg-white dark:bg-black text-slate-900 dark:text-white transition-colors duration-300 overflow-hidden">
            {/* 1. Header (Navbar) */}

            {/* 2. Hero Section */}
            <main className="relative py-32 px-6 grainy-bg">
                {/* Background Glows (테마별 색상 변경) */}
                <div className="absolute top-[-10%] right-[-10%] w-125 h-125 bg-blue-400/20 dark:bg-blue-500/30 blur-[120px] rounded-full -z-10" />
                <div className="absolute bottom-[-10%] left-[-10%] w-100 h-100 bg-orange-400/10 dark:bg-orange-600/20 blur-[100px] rounded-full -z-10" />

                <div className="max-w-7xl mx-auto text-center lg:text-left flex flex-col items-center lg:items-start">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-medium mb-8">
                        <span className="text-blue-600 dark:text-blue-400">
                            the React.js docs framework you love.
                        </span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-23 mb-6">
                        기록이 흐르는 순간,
                        <br />
                        <span className="text-blue-500 dark:text-blue-200">
                            우리도 함께 연결됩니다.
                        </span>
                    </h1>

                    <p className="max-w-2xl text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10 leading-relaxed break-keep">
                        서로의 일정이 채워지는 순간을 함께 지켜보고, 지금 이
                        순간의 고민과 설렘을 공유하세요. 따로 있어도 같은 화면
                        위에서 소통하며, 우리의 오늘을 가장 생생하게 기록합니다.
                    </p>

                    <div className="flex flex-wrap gap-4">
                        <Link
                            href="/docs"
                            className="bg-blue-400 hover:bg-blue-300 text-black px-8 py-3 rounded-full font-bold text-md transition-all shadow-lg shadow-blue-400/20"
                        >
                            Getting Started
                        </Link>
                        <button className="bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 px-8 py-3 rounded-full font-bold text-md transition-all">
                            Demo
                        </button>
                    </div>

                    {/* 3. Dashboard Preview Card */}
                    <div className="mt-24 w-full max-w-5xl mx-auto relative group">
                        <div className="absolute -inset-1 bg-linear-to-r from-blue-500 to-orange-500 rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                        <div className="relative border border-slate-200 dark:border-white/10 rounded-2xl bg-white/50 dark:bg-zinc-900/80 backdrop-blur-xl shadow-2xl overflow-hidden aspect-video flex">
                            {/* Sidebar Mockup */}
                            <div className="w-1/4 border-r border-slate-200 dark:border-white/10 p-4 hidden sm:block bg-slate-50/50 dark:bg-white/2">
                                <div className="h-4 w-2/3 bg-slate-200 dark:bg-white/10 rounded mb-4" />
                                <div className="space-y-2">
                                    <div className="h-8 w-full bg-blue-400/10 border border-blue-400/20 rounded-md" />
                                    <div className="h-8 w-full bg-slate-200/50 dark:bg-white/5 rounded-md" />
                                    <div className="h-8 w-full bg-slate-200/50 dark:bg-white/5 rounded-md" />
                                </div>
                            </div>
                            {/* Content Mockup */}
                            <div className="flex-1 p-8">
                                <div className="h-6 w-1/4 bg-slate-200 dark:bg-white/10 rounded mb-6" />
                                <div className="h-10 w-1/2 bg-slate-300 dark:bg-white/20 rounded mb-8" />
                                <div className="space-y-4">
                                    <div className="h-4 w-full bg-slate-200 dark:bg-white/10 rounded" />
                                    <div className="h-4 w-5/6 bg-slate-200 dark:bg-white/10 rounded" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
