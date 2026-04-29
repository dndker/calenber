import { Button } from "@workspace/ui/components/button"
import { Moon, Sun } from "lucide-react"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { useTheme } from "next-themes"

export default function ThemeSwitch() {
    const { resolvedTheme, setTheme } = useTheme()
    const t = useDebugTranslations("common.theme")

    function toggleTheme() {
        const isDark =
            resolvedTheme === "dark" ||
            (resolvedTheme == null &&
                document.documentElement.classList.contains("dark"))

        setTheme(isDark ? "light" : "dark")
    }

    return (
        <Button
            onClick={toggleTheme}
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("toggle")}
        >
            <Sun className="hidden size-5 dark:block" />
            <Moon className="size-5 dark:hidden" />
        </Button>
    )
}
