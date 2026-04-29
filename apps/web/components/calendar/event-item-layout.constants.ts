/**
 * 월간 뷰 이벤트 칩 기본 높이(px).
 * 예) lane 0/1/2의 실제 칩 높이는 모두 이 값을 사용한다.
 */
export const CALENDAR_EVENT_ITEM_HEIGHT_PX = 26

/**
 * 월간 뷰 이벤트 칩 lane 간 세로 간격(px).
 * 예) lane 0 -> 1로 내려갈 때 추가되는 간격.
 */
export const CALENDAR_EVENT_ITEM_LANE_GAP_PX = 2

/**
 * 월간 뷰 이벤트 칩 lane 한 칸 이동 시 stride(px).
 * = 높이 + lane 간격
 */
export const CALENDAR_EVENT_ITEM_STRIDE_PX =
    CALENDAR_EVENT_ITEM_HEIGHT_PX + CALENDAR_EVENT_ITEM_LANE_GAP_PX
