import { cn } from "@/lib/utils"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@workspace/ui/components/sonner"
import "@workspace/ui/globals.css"
import { RootProvider } from "fumadocs-ui/provider/next"
import { Geist, Inter } from "next/font/google"
import "./docs.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const inter = Inter({
    subsets: ["latin"],
})

export default function Layout({ children }: LayoutProps<"/">) {
    return (
        <html
            lang="ko"
            className={cn(inter.className, "font-sans", geist.variable)}
            suppressHydrationWarning
        >
            <body className="flex min-h-screen flex-col">
                <RootProvider>{children}</RootProvider>
                <Toaster position="bottom-center" />
                <Analytics />
            </body>
        </html>
    )
}
