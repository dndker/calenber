"use client"

const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const ACCEPTED_AVATAR_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
] as const

export function validateAvatarImage(file: File) {
    if (!ACCEPTED_AVATAR_MIME_TYPES.includes(file.type as (typeof ACCEPTED_AVATAR_MIME_TYPES)[number])) {
        return "JPG, PNG, WEBP 이미지 파일만 업로드할 수 있습니다."
    }

    return null
}

export async function compressAvatarImage(file: File) {
    const imageUrl = URL.createObjectURL(file)

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const nextImage = new Image()
            nextImage.onload = () => resolve(nextImage)
            nextImage.onerror = () =>
                reject(new Error("이미지를 불러오지 못했습니다."))
            nextImage.src = imageUrl
        })

        const maxDimension = 768
        const scale = Math.min(
            1,
            maxDimension / Math.max(image.width, image.height)
        )
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext("2d")

        if (!context) {
            throw new Error("이미지 압축을 준비하지 못했습니다.")
        }

        context.drawImage(image, 0, 0, width, height)

        let quality = 0.86
        let output: Blob | null = null

        while (quality >= 0.4) {
            output = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob(resolve, "image/webp", quality)
            })

            if (output && output.size <= MAX_AVATAR_BYTES) {
                break
            }

            quality -= 0.1
        }

        if (!output) {
            throw new Error("이미지 압축에 실패했습니다.")
        }

        return new File([output], "avatar.webp", { type: "image/webp" })
    } finally {
        URL.revokeObjectURL(imageUrl)
    }
}
