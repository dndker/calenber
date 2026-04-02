import DefaultSearchDialog from "@/components/search/search";
import { baseOptions } from "@/lib/layout.shared";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { RootProvider } from "fumadocs-ui/provider/base";
// import { TAGS } from "../api/search/constants";

export default function Layout({ children }: LayoutProps<"/">) {
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
            <HomeLayout {...baseOptions()}>{children}</HomeLayout>
        </RootProvider>
    );
}
