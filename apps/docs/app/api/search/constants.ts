import type { TagItem } from "fumadocs-ui/contexts/search";

export const TAGS = {
    Docs: { name: "Docs", value: "docs" },
    Calenber: { name: "Calenber", value: "calenber" },
} as const satisfies Record<string, TagItem>;
