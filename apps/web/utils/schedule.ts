import { RRule } from "rrule"

// 매주 월요일 반복 일정 생성
export const createWeeklyRule = () => {
    return new RRule({
        freq: RRule.WEEKLY,
        byweekday: [RRule.MO],
    })
}

// 특정 날짜들 가져오기
export const getOccurrences = () => {
    const rule = createWeeklyRule()
    return rule.all().slice(0, 10) // 예시로 10개만
}
