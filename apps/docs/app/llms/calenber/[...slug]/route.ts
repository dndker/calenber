import { getLLMText } from "@/app/_llms/get-llm-text";
import { calenberSource } from "@/lib/source";
import { notFound } from "next/navigation";

export const revalidate = false;

export async function GET(
    _request: Request,
    context: { params: Promise<{ slug: string[] }> },
) {
    const { slug } = await context.params;

    let actualSlug: string[];

    if (!slug || slug.length === 0) {
        actualSlug = [];
    } else {
        actualSlug = slug.map((s, i, arr) =>
            i === arr.length - 1 ? s.replace(/\.txt$/, "") : s,
        );

        // 🔥 index.txt → root 처리
        if (actualSlug.length === 1 && actualSlug[0] === "index") {
            actualSlug = [];
        }
    }

    const page = calenberSource.getPage(actualSlug);

    if (!page) notFound();

    return new Response(await getLLMText(page, "docs"), {
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
        },
    });
}

export async function generateStaticParams() {
    return calenberSource.generateParams().map((p) => ({
        slug: p.slug?.length
            ? p.slug.map((s, i) => (i === p.slug!.length - 1 ? `${s}.txt` : s))
            : ["index.txt"],
    }));
}
