"use client"

import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { useLocaleSwitch } from "@/hooks/use-locale"
import { locales, type Locale } from "@/lib/i18n/config"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select"
import { GlobeIcon } from "lucide-react"

export function LanguageSelect() {
    const tLocale = useDebugTranslations("common.locale")
    const tLanguage = useDebugTranslations("settings.language")
    const { currentLocale, switchLocale, isPending } = useLocaleSwitch()

    return (
        <Select
            value={currentLocale}
            onValueChange={(value) => switchLocale(value as Locale)}
        >
            <SelectTrigger className="w-44 px-2" disabled={isPending}>
                <div className="flex items-center gap-2">
                    <GlobeIcon className="text-muted-foreground" />
                    <SelectValue placeholder={tLanguage("label")} />
                </div>
            </SelectTrigger>
            <SelectContent position="popper">
                <SelectGroup>
                    {/* <SelectLabel>{tLanguage("label")}</SelectLabel> */}
                    {locales.map((locale) => (
                        <SelectItem key={locale} value={locale}>
                            {tLocale(locale)}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}
