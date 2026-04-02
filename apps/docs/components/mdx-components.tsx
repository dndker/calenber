import clsx from "clsx";
import {
    createFileSystemGeneratorCache,
    createGenerator,
} from "fumadocs-typescript";
import { AutoTypeTable } from "fumadocs-typescript/ui";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { File, Files, Folder } from "fumadocs-ui/components/files";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Download, FileText } from "lucide-react";
import type { MDXComponents } from "mdx/types";

const generator = createGenerator({
    // set a cache, necessary for serverless platform like Vercel
    cache: createFileSystemGeneratorCache(".next/fumadocs-typescript"),
});

export const mdxComponents: MDXComponents = {
    ...defaultMdxComponents,

    img: ({ className, alt, src, ...rest }) => {
        // src가 string이 아닐 경우(Blob 등)를 대비해 안전하게 처리
        const imageSrc = typeof src === "string" ? src : "";

        return (
            <ImageZoom
                src={imageSrc}
                alt={alt ?? "image"}
                className={clsx(
                    className,
                    "bg-palette-gray-100 dark:bg-palette-gray-900 rounded-r2 overflow-hidden",
                )}
                {...(rest as Omit<typeof rest, "src" | "alt">)}
            />
        );
    },

    // Layout
    Grid: ({ children }) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-2 md:items-start my-[2em] [&>figure]:my-0 not-prose [&>ul]:list-disc [&>ul]:p-2.5 [&>ul]:pl-8">
            {children}
        </div>
    ),

    // Components
    Tab,
    Tabs,
    Step,
    Steps,
    File,
    Folder,
    Files,
    Accordion,
    Accordions,
    CodeBlock,
    Pre,
    TypeTable,
    AutoTypeTable: (props) => (
        <AutoTypeTable {...props} generator={generator} />
    ),
    InlineTOC,

    // Icons for MDX
    FileText,
    Download,

    // Guidelines
    ImageZoom,

    FigmaImage: () => null,
};
