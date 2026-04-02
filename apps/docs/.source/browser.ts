// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  calenber: create.doc("calenber", {"index.mdx": () => import("../content/calenber/index.mdx?collection=calenber"), "test.mdx": () => import("../content/calenber/test.mdx?collection=calenber"), "getting-started/cli/commands.mdx": () => import("../content/calenber/getting-started/cli/commands.mdx?collection=calenber"), "getting-started/cli/configuration.mdx": () => import("../content/calenber/getting-started/cli/configuration.mdx?collection=calenber"), "getting-started/installation/nextjs.mdx": () => import("../content/calenber/getting-started/installation/nextjs.mdx?collection=calenber"), "getting-started/installation/rsbuild.mdx": () => import("../content/calenber/getting-started/installation/rsbuild.mdx?collection=calenber"), "getting-started/installation/vite.mdx": () => import("../content/calenber/getting-started/installation/vite.mdx?collection=calenber"), "getting-started/installation/webpack.mdx": () => import("../content/calenber/getting-started/installation/webpack.mdx?collection=calenber"), }),
};
export default browserCollections;