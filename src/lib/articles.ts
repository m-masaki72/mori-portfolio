import { getCollection, type CollectionEntry } from "astro:content";
import { TOPICS, type Topic } from "@/consts";

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

/** テーマページのパス（末尾スラッシュ付き） */
export const topicPath = (slug: string) => `/articles/topics/${slug}/`;

export const articlesOfTopic = (topic: Topic, articles: Article[]) =>
  articles.filter((a) => a.data.tags.some((t) => topic.tags.includes(t)));

/** タグが属するテーマ（なければ undefined） */
export const topicOfTag = (tag: string) => TOPICS.find((t) => t.tags.includes(tag));

/**
 * 関連記事。共有タグを「そのタグの記事数の逆数」で重みづけして合計し、同点なら公開日が近い順。
 * 多くの記事に付く Claude Code だけが共通の記事より、珍しいタグが共通の記事を優先し、
 * 最新記事にばかりリンクが集まらないようにする
 */
export function relatedArticles(article: Article, all: Article[], limit: number, exclude: Set<string> = new Set()): Article[] {
  const counts = new Map(tagsOf(all).map(({ tag, count }) => [tag, count]));
  const time = article.data.pubDate.getTime();
  return all
    .filter((a) => a.id !== article.id && !exclude.has(a.id))
    .map((a) => ({
      a,
      score: a.data.tags.filter((t) => article.data.tags.includes(t)).reduce((s, t) => s + 1 / (counts.get(t) ?? 1), 0),
      distance: Math.abs(a.data.pubDate.getTime() - time),
    }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.distance - y.distance)
    .slice(0, limit)
    .map((x) => x.a);
}

/** 本文から制作物ページ（/projects/<id>/）へリンクしている記事 */
export const articlesMentioningProject = (projectId: string, articles: Article[]) =>
  articles.filter((a) => new RegExp(`/projects/${projectId}/?[)#"]`).test(a.body ?? ""));

export function formatDate(date: Date): string {
  return date.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tokyo" });
}

/** <time datetime> 用の YYYY-MM-DD */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
