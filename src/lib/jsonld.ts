import { SITE, SOCIALS } from "@/consts";

// 各アプリ（*.morilab-garage.com）の JSON-LD からも author としてこの @id を参照する
export const PERSON_ID = `${SITE.URL}/#person`;
export const WEBSITE_ID = `${SITE.URL}/#website`;

export type JsonLdNode = Record<string, unknown>;

const person: JsonLdNode = {
  "@type": "Person",
  "@id": PERSON_ID,
  name: "MasakiMori",
  url: `${SITE.URL}/about/`,
  image: `${SITE.URL}/portrait.jpg`,
  description: SITE.DESCRIPTION,
  sameAs: SOCIALS.filter((s) => !s.HREF.includes("ofuse.me")).map((s) => s.HREF),
};

const website: JsonLdNode = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: SITE.TITLE,
  url: `${SITE.URL}/`,
  description: SITE.DESCRIPTION,
  inLanguage: "ja",
  publisher: { "@id": PERSON_ID },
};

export function buildGraph(extra: JsonLdNode[] = []): string {
  const json = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [website, person, ...extra],
  });
  // </script> による script タグ脱出を防ぐ
  return json.replace(/</g, "\\u003c");
}

export function breadcrumb(items: { name: string; url: string }[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
