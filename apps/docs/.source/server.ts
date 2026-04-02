// @ts-nocheck
import * as __fd_glob_11 from "../content/calenber/getting-started/installation/webpack.mdx?collection=calenber"
import * as __fd_glob_10 from "../content/calenber/getting-started/installation/vite.mdx?collection=calenber"
import * as __fd_glob_9 from "../content/calenber/getting-started/installation/rsbuild.mdx?collection=calenber"
import * as __fd_glob_8 from "../content/calenber/getting-started/installation/nextjs.mdx?collection=calenber"
import * as __fd_glob_7 from "../content/calenber/getting-started/cli/configuration.mdx?collection=calenber"
import * as __fd_glob_6 from "../content/calenber/getting-started/cli/commands.mdx?collection=calenber"
import * as __fd_glob_5 from "../content/calenber/test.mdx?collection=calenber"
import * as __fd_glob_4 from "../content/calenber/index.mdx?collection=calenber"
import { default as __fd_glob_3 } from "../content/calenber/getting-started/installation/meta.json?collection=calenber"
import { default as __fd_glob_2 } from "../content/calenber/getting-started/cli/meta.json?collection=calenber"
import { default as __fd_glob_1 } from "../content/calenber/getting-started/meta.json?collection=calenber"
import { default as __fd_glob_0 } from "../content/calenber/meta.json?collection=calenber"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const calenber = await create.docs("calenber", "content/calenber", {"meta.json": __fd_glob_0, "getting-started/meta.json": __fd_glob_1, "getting-started/cli/meta.json": __fd_glob_2, "getting-started/installation/meta.json": __fd_glob_3, }, {"index.mdx": __fd_glob_4, "test.mdx": __fd_glob_5, "getting-started/cli/commands.mdx": __fd_glob_6, "getting-started/cli/configuration.mdx": __fd_glob_7, "getting-started/installation/nextjs.mdx": __fd_glob_8, "getting-started/installation/rsbuild.mdx": __fd_glob_9, "getting-started/installation/vite.mdx": __fd_glob_10, "getting-started/installation/webpack.mdx": __fd_glob_11, });