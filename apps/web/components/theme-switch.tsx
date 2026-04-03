import { Button } from "@workspace/ui/components/button"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export default function ThemeSwitch() {
    const { resolvedTheme: theme, setTheme } = useTheme()
    return (
        <Button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            variant="ghost"
            size="icon"
            className="size-8"
        >
            {theme === "dark" ? (
                <Sun className="size-5" />
            ) : (
                <Moon className="size-5" />
            )}
        </Button>
    )
}
