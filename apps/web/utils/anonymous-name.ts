import { uniqueNamesGenerator } from "unique-names-generator"

// Adjective word count matches original Korean list (12 items)
const ADJECTIVES = [
    "swift",
    "quiet",
    "cute",
    "brave",
    "sleepy",
    "hungry",
    "clever",
    "mellow",
    "shy",
    "lively",
    "quirky",
    "calm",
]

// Animal word count matches original Korean list (15 items)
const ANIMALS = [
    "roedeer",
    "lion",
    "tiger",
    "panda",
    "fox",
    "wolf",
    "penguin",
    "giraffe",
    "elephant",
    "hippo",
    "otter",
    "cheetah",
    "kangaroo",
    "bear",
    "koala",
]

export function getAnonymousName(id: string) {
    const nickname = uniqueNamesGenerator({
        dictionaries: [ADJECTIVES, ANIMALS],
        seed: id,
        separator: " ",
        style: "lowerCase",
    })

    return `Anonymous ${nickname}`
}
