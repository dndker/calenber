export const APP_NAME = "캘린버"
export const APP_DESCRIPTION = "일정, 그 이상을 기억하다."
export const APP_DEFAULT_TITLE = APP_NAME
export const APP_TITLE_TEMPLATE = `%s - ${APP_NAME}`
export const APP_URL =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")

export const APP_DEFAULT_IMAGE_ALT = `${APP_DESCRIPTION} - ${APP_NAME}`
