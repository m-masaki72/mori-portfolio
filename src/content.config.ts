import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

// 一覧のフィルタ・チップ表示に使うカテゴリ（表示順もこの順）
export const CATEGORIES = ["音楽・オーディオ", "Webツール", "ゲーム", "開発ツール"] as const;

const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(CATEGORIES),
    // 動作環境（Web / Windows / VST など）
    platform: z.string(),
    tech: z.array(z.string()).default([]),
    // 小さいほど上に表示。トップページには上位のみ掲載
    order: z.number().default(100),
    liveUrl: z.url().optional(),
    githubUrl: z.url().optional(),
    image: z.object({
      url: z.string(),
      alt: z.string(),
    }),
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/articles" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    // はてなブログから移設した記事の元URL
    originalUrl: z.url().optional(),
  }),
});

export const collections = { projects, articles };
