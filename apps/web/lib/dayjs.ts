import dayjs from "dayjs"
import isSameOrAfter from "dayjs/plugin/isSameOrAfter"
import isSameOrBefore from "dayjs/plugin/isSameOrBefore"
import timezone from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"

import "dayjs/locale/ko"

dayjs.locale("ko")

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)
dayjs.tz.setDefault("Asia/Seoul")

export default dayjs
