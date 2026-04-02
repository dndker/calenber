import { calenberSource } from "@/lib/source";
import clsx from "clsx";
import type { DocsLayoutProps } from "fumadocs-ui/layouts/notebook";
import { File } from "lucide-react";
import type { PropsWithChildren } from "react";

function SidebarTabIconContainer({
    children,
    className,
}: PropsWithChildren<{ className?: string }>) {
    return (
        <div
            className={clsx(
                className,
                "[&_svg]:size-full rounded-lg size-full text-(--tab-color) max-md:bg-(--tab-color)/10 max-md:border max-md:p-1.5",
            )}
        >
            {children}
        </div>
    );
}

/**
 * Shared layout configurations
 *
 * you can configure layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */

export const baseLogo = (
    <div className="flex gap-2 justify-center items-center">
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 108.24 82.15"
            width="108"
            height="82"
            className="text-black dark:text-white shrink-0 w-7 h-auto"
            fill="currentColor"
        >
            <circle className="cb-symbol1" cx="97.66" cy="40.07" r="10.58" />
            <path
                className="cb-symbol1"
                d="M50.18,45h0a10.58,10.58,0,0,1,0-15L76.29,4a10.58,10.58,0,0,1,15,0h0a10.58,10.58,0,0,1,0,15L65.14,45A10.58,10.58,0,0,1,50.18,45Z"
            />
            <path
                className="cb-symbol2"
                d="M58.68,79.05h0a10.58,10.58,0,0,1,0-15l11.49-11.5a10.58,10.58,0,0,1,15,0h0a10.58,10.58,0,0,1,0,15L73.64,79.05A10.58,10.58,0,0,1,58.68,79.05Z"
            />
            <circle className="cb-symbol1" cx="10.58" cy="42.89" r="10.58" />
            <path
                className="cb-symbol2"
                d="M50.37,3.1h0a10.58,10.58,0,0,1,0,15L39,29.44a10.56,10.56,0,0,1-15,0h0a10.58,10.58,0,0,1,0-15L35.41,3.1A10.58,10.58,0,0,1,50.37,3.1Z"
            />
            <path
                className="cb-symbol2"
                d="M45.36,49.85h0a10.56,10.56,0,0,1,0,15L34,76.2a10.58,10.58,0,0,1-15,0h0a10.58,10.58,0,0,1,0-15L30.4,49.85A10.58,10.58,0,0,1,45.36,49.85Z"
            />
        </svg>
        <div>Calenber</div>
    </div>
);

export const baseOptions: Omit<DocsLayoutProps, "tree"> = {
    githubUrl: "https://github.com/stunitas-tech/st-design",
    sidebar: {
        tabs: [
            {
                title: "Docs",
                description: "단기 앱을 위한 디자인 언어",
                url: "/calenber",
                icon: (
                    <SidebarTabIconContainer className="[--tab-color:var(--design-color)]">
                        <File />
                    </SidebarTabIconContainer>
                ),
            },
            // {
            //     title: "Calenber",
            //     description: "Calenber 라이브러리",
            //     url: "/react",
            //     icon: (
            //         <SidebarTabIconContainer className="[--tab-color:var(--design-color)]">
            //             <File />
            //         </SidebarTabIconContainer>
            //     ),
            // },
        ],
    },
    tabMode: "navbar",
    nav: {
        mode: "top",
        url: "/",
        title: baseLogo,
    },
};

export const docsOptions: DocsLayoutProps = {
    ...baseOptions,
    tree: calenberSource.pageTree,

    // tree: await source.getTransformedPageTree(),
};
