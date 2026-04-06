import { Button } from "@workspace/ui/components/button"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useServerTheme } from "./provider/theme-context"

export default function ThemeSwitch() {
    const { theme: ssrTheme } = useServerTheme()
    const { resolvedTheme, setTheme } = useTheme()

    const currentTheme = resolvedTheme ?? ssrTheme

    return (
        <Button
            onClick={() =>
                setTheme(resolvedTheme === "light" ? "dark" : "light")
            }
            variant="ghost"
            size="icon"
            className="size-8"
        >
            {currentTheme === "dark" ? (
                <Sun className="size-5" />
            ) : (
                <Moon className="size-5" />
            )}
        </Button>
    )
}
