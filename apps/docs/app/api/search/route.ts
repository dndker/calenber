import { tokenize } from "@/components/search/tokenizer";
import { calenberSource } from "@/lib/source";
import { AdvancedIndex, createSearchAPI } from "fumadocs-core/search/server";

// it should be cached forever
export const revalidate = false;

export const { staticGET: GET } = createSearchAPI("advanced", {
    indexes: () =>
        Promise.all([
            ...calenberSource.getPages().map(async (page) => {
                return {
                    id: page.url,
                    title: page.data.title,
                    description: page.data.description,
                    structuredData: page.data.structuredData,
                    // tag: TAGS.design.value,
                    url: page.url,
                } satisfies AdvancedIndex;
            }),
        ]),
    tokenizer: {
        language: "english",
        tokenize,
    },
});
