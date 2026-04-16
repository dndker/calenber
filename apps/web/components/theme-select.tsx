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
import { useServerTheme } from "./provider/theme-context"

export default function ThemeSelect() {
    const { theme: ssrTheme } = useServerTheme()
    const { theme, setTheme } = useTheme()

    const currentTheme = theme ?? ssrTheme

    return (
        <Select value={currentTheme} onValueChange={setTheme}>
            <SelectTrigger className="w-full max-w-48">
                <SelectValue placeholder="테마 설정" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>테마</SelectLabel>
                    <SelectItem value="system">시스템 테마 사용</SelectItem>
                    <SelectItem value="light">라이트 모드</SelectItem>
                    <SelectItem value="dark">다크 모드</SelectItem>
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}
