import { Button } from "@workspace/ui/components/button"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export default function ThemeSwitch() {
    const { resolvedTheme, setTheme } = useTheme()

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
            aria-label="테마 전환"
        >
            <Sun className="hidden size-5 dark:block" />
            <Moon className="size-5 dark:hidden" />
        </Button>
    )
}
