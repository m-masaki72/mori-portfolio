import type { APIRoute, GetStaticPaths } from "astro";
import { formatDate, getArticles } from "@/lib/articles";
import { prepareFonts, renderOgImage } from "@/lib/og-image";

const card = (a: Awaited<ReturnType<typeof getArticles>>[number]) => ({
  title: a.data.title,
  tags: a.data.tags,
  date: formatDate(a.data.updatedDate ?? a.data.pubDate),
});

export const getStaticPaths: GetStaticPaths = async () => {
  const all = await getArticles();
  return all.map((article) => ({ params: { id: article.id }, props: { article } }));
};

export const GET: APIRoute = async ({ props }) => {
  const fonts = await prepareFonts((await getArticles()).map(card));
  const png = await renderOgImage(card(props.article), fonts);
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
};
