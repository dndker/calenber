import DefaultSearchDialog from "@/components/search/search";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { RootProvider } from "fumadocs-ui/provider/base";
// import { TAGS } from "../api/search/constants";
import { docsOptions } from "../layout.config";

export default function Layout({ children }: LayoutProps<"/calenber">) {
    return (
        <RootProvider
            search={{
                SearchDialog: DefaultSearchDialog,
                options: {
                    // defaultTag: TAGS.design.value,
                    // tags: Object.values(TAGS),
                },
            }}
        >
            <DocsLayout {...docsOptions}>{children}</DocsLayout>
        </RootProvider>
    );
}
