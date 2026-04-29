import { enUS, ko } from "react-day-picker/locale"

import { type Locale } from "./config"

export function getDayPickerLocale(locale: Locale) {
    return locale === "ko" ? ko : enUS
}
