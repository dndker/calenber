import { APP_NAME } from "@/lib/app-config"
import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"

type CalendarOgImageOptions = {
    badge: string
    title: string
    description: string
}

export const ogImageSize = {
    width: 1200,
    height: 630,
}

export const ogImageContentType = "image/png"

let logoDataUrlPromise: Promise<string> | null = null

function getLogoDataUrl() {
    if (!logoDataUrlPromise) {
        logoDataUrlPromise = readFile(
            new URL("../../public/logo.png", import.meta.url)
        ).then((buffer) => `data:image/png;base64,${buffer.toString("base64")}`)
    }

    return logoDataUrlPromise
}

function renderMultilineText(value: string) {
    return value.split("\n").map((line, index) => (
        <span key={`${line}-${index}`}>
            {index > 0 ? <br /> : null}
            {line}
        </span>
    ))
}

export async function createCalendarOgImage({
    badge,
    title,
    description,
}: CalendarOgImageOptions) {
    const logoDataUrl = await getLogoDataUrl()

    return new ImageResponse(
        <div
            style={{
                display: "flex",
                width: "100%",
                height: "100%",
                background:
                    "linear-gradient(135deg, #f8fafc 0%, #e0f2fe 45%, #dbeafe 100%)",
                color: "#0f172a",
                padding: "48px",
                fontFamily:
                    "Geist, Inter, ui-sans-serif, system-ui, sans-serif",
            }}
        >
            <div
                style={{
                    display: "flex",
                    flex: 1,
                    borderRadius: "36px",
                    padding: "44px",
                    background:
                        "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.78) 100%)",
                    border: "1px solid rgba(15, 23, 42, 0.08)",
                    boxShadow: "0 24px 80px rgba(15, 23, 42, 0.12)",
                    flexDirection: "column",
                    justifyContent: "space-between",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "24px",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            alignSelf: "flex-start",
                            borderRadius: "999px",
                            backgroundColor: "#0f172a",
                            color: "#f8fafc",
                            padding: "0 20px",
                            height: "50px",
                            fontSize: "24px",
                            fontWeight: 700,
                            lineHeight: "normal",
                        }}
                    >
                        {badge}
                    </div>

                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "18px",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                fontSize: "64px",
                                lineHeight: 1.1,
                                fontWeight: 800,
                                letterSpacing: "-0.04em",
                                color: "#020617",
                                overflow: "hidden",
                                maxHeight: "142px",
                            }}
                        >
                            {title}
                        </div>

                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "30px",
                                fontSize: "30px",
                                lineHeight: 1.45,
                                color: "#334155",
                                overflow: "hidden",
                                maxHeight: "150px",
                            }}
                        >
                            {renderMultilineText(description)}
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "24px",
                        fontSize: "26px",
                        color: "#475569",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            color: "#0f172a",
                            fontWeight: 700,
                        }}
                    >
                        {/* `next/og` ImageResponse uses plain HTML elements, not `next/image`. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={logoDataUrl}
                            alt={APP_NAME}
                            style={{
                                width: "34px",
                                height: "34px",
                            }}
                        />
                        {APP_NAME}
                    </div>
                </div>
            </div>
        </div>,
        ogImageSize
    )
}
