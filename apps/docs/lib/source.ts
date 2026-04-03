import { calenber } from "collections/server"
import type { Source, SourceConfig } from "fumadocs-core/source"
import { type InferPageType, loader } from "fumadocs-core/source"
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons"
import { docsContentRoute, docsImageRoute, docsRoute } from "./shared"

// See https://fumadocs.dev/docs/headless/source-api for more info

type SourceConfigFromSource<
    TSource extends { files: Array<{ type: string; data: unknown }> },
> = {
    pageData: Extract<TSource["files"][number], { type: "page" }>["data"]
    metaData: Extract<TSource["files"][number], { type: "meta" }>["data"]
} & SourceConfig

function createTypedLoader<
    TSource extends { files: Array<{ type: string; data: unknown }> },
>(baseUrl: string, source: TSource) {
    type Config = SourceConfigFromSource<TSource>

    return loader<Config>({
        baseUrl,
        source: source as unknown as Source<Config>,
        plugins: [lucideIconsPlugin()],
    })
}
export const source = loader({
    baseUrl: docsRoute,
    source: calenber.toFumadocsSource(),
    plugins: [lucideIconsPlugin()],
})

const baseCalenberSource = createTypedLoader(
    "/calenber",
    calenber.toFumadocsSource()
)

export const calenberSource = {
    ...baseCalenberSource,
}

// export const calenberSource = loader({
//     baseUrl: "/calenber",
//     source: calenber.toFumadocsSource(),
//     plugins: [lucideIconsPlugin()],
// })

export function getPageImage(page: InferPageType<typeof baseCalenberSource>) {
    const segments = [...page.slugs, "image.png"]

    return {
        segments,
        url: `${docsImageRoute}/${segments.join("/")}`,
    }
}

export function getPageMarkdownUrl(
    page: InferPageType<typeof baseCalenberSource>
) {
    const segments = [...page.slugs, "content.md"]

    return {
        segments,
        url: `${docsContentRoute}/${segments.join("/")}`,
    }
}
