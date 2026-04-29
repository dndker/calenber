"use client"

import { useFormatter } from "next-intl"
import { getFormatter } from "next-intl/server"

/**
 * 클라이언트 컴포넌트용 locale-aware 날짜 포맷 헬퍼.
 * dayjs는 날짜 계산(diff/add/startOf)에만 쓰고, 표시는 이 훅으로 통일.
 *
 * @example
 * const fmt = useCalendarDateFormat()
 * fmt.date(new Date())       // "2024년 4월 29일" | "April 29, 2024"
 * fmt.monthYear(new Date())  // "2024년 4월" | "April 2024"
 */
export function useCalendarDateFormat() {
    const format = useFormatter()

    return {
        /** "2024년 4월 29일" / "April 29, 2024" */
        date: (d: Date) =>
            format.dateTime(d, {
                year: "numeric",
                month: "long",
                day: "numeric",
            }),

        /** "4/29" / "4/29" */
        dateShort: (d: Date) =>
            format.dateTime(d, { month: "numeric", day: "numeric" }),

        /** "2024. 4. 29." / "Apr 29, 2024" */
        dateMedium: (d: Date) =>
            format.dateTime(d, {
                year: "numeric",
                month: "short",
                day: "numeric",
            }),

        /** "오후 3:30" / "3:30 PM" */
        time: (d: Date) =>
            format.dateTime(d, { hour: "numeric", minute: "2-digit" }),

        /** "오후 3:30" / "15:30" (24시간제) */
        time24: (d: Date) =>
            format.dateTime(d, {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            }),

        /** "2024년 4월" / "April 2024" */
        monthYear: (d: Date) =>
            format.dateTime(d, { month: "long", year: "numeric" }),

        /** "4월" / "April" */
        monthLong: (d: Date) => format.dateTime(d, { month: "long" }),

        /** "월" / "Mon" */
        weekdayShort: (d: Date) => format.dateTime(d, { weekday: "short" }),

        /** "월요일" / "Monday" */
        weekdayLong: (d: Date) => format.dateTime(d, { weekday: "long" }),

        /**
         * 상대 시간: "3분 전" / "3 minutes ago"
         * @param d 기준 날짜 (과거면 "전", 미래면 "후")
         */
        relative: (d: Date) => format.relativeTime(d),
    }
}

/**
 * 서버 컴포넌트용 locale-aware 날짜 포맷 헬퍼.
 *
 * @example
 * const fmt = await getCalendarDateFormat()
 * fmt.date(new Date())
 */
export async function getCalendarDateFormat() {
    const format = await getFormatter()

    return {
        date: (d: Date) =>
            format.dateTime(d, {
                year: "numeric",
                month: "long",
                day: "numeric",
            }),
        dateMedium: (d: Date) =>
            format.dateTime(d, {
                year: "numeric",
                month: "short",
                day: "numeric",
            }),
        monthYear: (d: Date) =>
            format.dateTime(d, { month: "long", year: "numeric" }),
        time: (d: Date) =>
            format.dateTime(d, { hour: "numeric", minute: "2-digit" }),
    }
}
