import { existsSync } from "node:fs";
import { join } from "node:path";
import { getCollection, type CollectionEntry } from "astro:content";

export type Project = CollectionEntry<"projects">;

/** order 昇順（同順位はタイトル順）で全プロジェクトを返す */
export async function getProjects(): Promise<Project[]> {
  const all = await getCollection("projects");
  return all.sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title, "ja"));
}

/** public/ 配下の画像に同名 .webp があればそのパスを返す（scripts/convert-images.mjs が生成） */
export function webpOf(url: string): string | undefined {
  if (!url.startsWith("/") || !/\.(png|jpe?g)$/i.test(url)) return undefined;
  const webp = url.replace(/\.(png|jpe?g)$/i, ".webp");
  return existsSync(join(process.cwd(), "public", webp)) ? webp : undefined;
}
