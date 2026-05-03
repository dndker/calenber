export const CALENDAR_EVENT_ITEM_HEIGHT_PX = 23
export const MOBILE_CALENDAR_EVENT_ITEM_HEIGHT_PX = 18

export const CALENDAR_EVENT_ITEM_LANE_GAP_PX = 3
export const MOBILE_CALENDAR_EVENT_ITEM_LANE_GAP_PX = 2

export const CALENDAR_EVENT_ITEM_STRIDE_PX =
    CALENDAR_EVENT_ITEM_HEIGHT_PX + CALENDAR_EVENT_ITEM_LANE_GAP_PX
export const MOBILE_CALENDAR_EVENT_ITEM_STRIDE_PX =
    MOBILE_CALENDAR_EVENT_ITEM_HEIGHT_PX +
    MOBILE_CALENDAR_EVENT_ITEM_LANE_GAP_PX

export const CALENDAR_EVENT_ROW_TOP_OFFSET_PX = 56
export const MOBILE_CALENDAR_EVENT_ROW_TOP_OFFSET_PX = 28
export const CALENDAR_EVENT_ROW_BOTTOM_OFFSET_PX = 4
export const CALENDAR_EVENT_ITEM_SIDE_GAP_PX = 4
export const MOBILE_CALENDAR_EVENT_ITEM_SIDE_GAP_PX = 2
export const CALENDAR_EVENT_ITEM_COLUMN_GAP_PX = 1
export const MOBILE_CALENDAR_EVENT_ITEM_COLUMN_GAP_PX = 1

export type CalendarEventItemMetrics = {
    height: number
    laneGap: number
    stride: number
    rowTopOffset: number
    rowBottomOffset: number
    sideGap: number
    columnGap: number
}

export function getCalendarEventItemMetrics(
    isMobile: boolean
): CalendarEventItemMetrics {
    if (isMobile) {
        return {
            height: MOBILE_CALENDAR_EVENT_ITEM_HEIGHT_PX,
            laneGap: MOBILE_CALENDAR_EVENT_ITEM_LANE_GAP_PX,
            stride: MOBILE_CALENDAR_EVENT_ITEM_STRIDE_PX,
            rowTopOffset: MOBILE_CALENDAR_EVENT_ROW_TOP_OFFSET_PX,
            rowBottomOffset: CALENDAR_EVENT_ROW_BOTTOM_OFFSET_PX,
            sideGap: MOBILE_CALENDAR_EVENT_ITEM_SIDE_GAP_PX,
            columnGap: MOBILE_CALENDAR_EVENT_ITEM_COLUMN_GAP_PX,
        }
    }

    return {
        height: CALENDAR_EVENT_ITEM_HEIGHT_PX,
        laneGap: CALENDAR_EVENT_ITEM_LANE_GAP_PX,
        stride: CALENDAR_EVENT_ITEM_STRIDE_PX,
        rowTopOffset: CALENDAR_EVENT_ROW_TOP_OFFSET_PX,
        rowBottomOffset: CALENDAR_EVENT_ROW_BOTTOM_OFFSET_PX,
        sideGap: CALENDAR_EVENT_ITEM_SIDE_GAP_PX,
        columnGap: CALENDAR_EVENT_ITEM_COLUMN_GAP_PX,
    }
}
