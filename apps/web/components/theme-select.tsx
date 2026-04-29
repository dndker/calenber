import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select"
import { useTheme } from "next-themes"
import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { useServerTheme } from "./provider/theme-context"

export default function ThemeSelect() {
    const { theme: ssrTheme } = useServerTheme()
    const { theme, setTheme } = useTheme()
    const t = useDebugTranslations("common.theme")

    const currentTheme = theme ?? ssrTheme

    return (
        <Select value={currentTheme} onValueChange={setTheme}>
            <SelectTrigger className="w-full max-w-48">
                <SelectValue placeholder={t("placeholder")} />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>{t("label")}</SelectLabel>
                    <SelectItem value="system">{t("system")}</SelectItem>
                    <SelectItem value="light">{t("light")}</SelectItem>
                    <SelectItem value="dark">{t("dark")}</SelectItem>
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}
