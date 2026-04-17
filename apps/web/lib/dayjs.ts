import dayjs from "dayjs"
import "dayjs/locale/ko"
import isoWeek from "dayjs/plugin/isoWeek"
import isSameOrAfter from "dayjs/plugin/isSameOrAfter"
import isSameOrBefore from "dayjs/plugin/isSameOrBefore"
import relativeTime from "dayjs/plugin/relativeTime"
import timezone from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"

dayjs.locale("ko")

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)
dayjs.extend(isoWeek)
dayjs.extend(relativeTime)

// dayjs.tz.setDefault("Asia/Seoul")

export default dayjs

export function formatRelativeTime(
    value: string | Date | null | undefined | number
) {
    if (!value) return ""
    return dayjs(value).fromNow()
}
