/**
 * 일정 폼·퀵 편집에서 공통으로 쓰는 컬렉션(표시) 이름 정규화.
 * @example normalizeNames([" a ", "b", "a"]) → ["a", "b"]
 */
export function normalizeNames(values: string[]) {
    return Array.from(
        new Set(values.map((value) => value.trim()).filter(Boolean))
    )
}

/**
 * 컬렉션 이름 비교용 키 (대소문자·앞뒤 공백 무시).
 * @example normalizeCollectionName("  회의  ") → "회의"
 */
export function normalizeCollectionName(value: string) {
    return value.trim().toLowerCase()
}
