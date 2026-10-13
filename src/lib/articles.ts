import { getCollection, type CollectionEntry } from "astro:content";

export type Article = CollectionEntry<"articles">;

/** 公開日の新しい順で全記事を返す */
export async function getArticles(): Promise<Article[]> {
  const all = await getCollection("articles");
  return all.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

/** 記事ページのパス（末尾スラッシュ付き） */
export const articlePath = (id: string) => `/articles/${id}/`;

// 移設元（originalUrl）のホスト → 表示名
const ORIGINAL_SITES: Record<string, string> = {
  "zenn.dev": "Zenn",
  "mementomori7272.hatenablog.com": "はてなブログ",
};

export function originalSiteName(url: string): string {
  const host = new URL(url).hostname;
  const name = ORIGINAL_SITES[host];
  if (!name) throw new Error(`originalUrl の移設元が未登録です: ${host}（src/lib/articles.ts の ORIGINAL_SITES に追加）`);
  return name;
}

/** 記事数の多い順にタグを返す */
export function tagsOf(articles: Article[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of articles) for (const t of a.data.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ja"));
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tokyo" });
}

/** <time datetime> 用の YYYY-MM-DD */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
