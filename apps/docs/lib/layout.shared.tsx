import { baseLogo } from "@/app/layout.config";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { gitConfig } from "./shared";

export function baseOptions(): BaseLayoutProps {
    return {
        nav: {
            // JSX supported
            // title: appName,
            title: baseLogo,
        },
        githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
        links: [
            {
                text: "Documentation",
                url: "/calenber",
                active: "none", // 현재 경로가 포함될 때 활성화 표시
            },
            {
                text: "Blog",
                url: "/calenber",
            },
            {
                text: "Showcase",
                url: "/calenber",
            },
            {
                text: "Community",
                url: "https://discord.com/", // 외부 링크도 가능
                external: true,
            },
        ],
    };
}
