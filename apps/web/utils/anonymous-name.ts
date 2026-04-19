import { uniqueNamesGenerator } from "unique-names-generator"

const ADJECTIVES = [
    "빠른",
    "조용한",
    "귀여운",
    "용감한",
    "졸린",
    "배고픈",
    "똑똑한",
    "느긋한",
    "수줍은",
    "활발한",
    "엉뚱한",
    "차분한",
]

// const COLORS = [
//     "빨간",
//     "파란",
//     "노란",
//     "초록",
//     "보라",
//     "검은",
//     "하얀",
//     "분홍",
//     "주황",
// ]

const ANIMALS = [
    "고라니",
    "사자",
    "호랑이",
    "판다",
    "여우",
    "늑대",
    "펭귄",
    "기린",
    "코끼리",
    "하마",
    "수달",
    "치타",
    "캥거루",
    "곰",
    "코알라",
]

export function getAnonymousName(id: string) {
    const nickname = uniqueNamesGenerator({
        dictionaries: [ADJECTIVES, ANIMALS],
        seed: id,
        separator: " ",
        style: "lowerCase",
    })

    return `익명의 ${nickname}`
}
