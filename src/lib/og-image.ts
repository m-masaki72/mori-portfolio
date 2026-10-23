import satori from "satori";
import sharp from "sharp";
import { SITE } from "@/consts";

// 記事ごとの OGP 画像（1200×630）。デザインは public/og-default.png に合わせる
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

type Card = { title: string; tags: string[]; date: string };

// Google Fonts から、使う文字だけを含む TTF を取る（satori は woff2 を読めない。
// User-Agent を付けなければ truetype が返る）
async function loadFont(family: string, text: string): Promise<ArrayBuffer> {
  const params = new URLSearchParams({ family: `${family}:wght@700`, text });
  const css = await (await fetch(`https://fonts.googleapis.com/css2?${params}`)).text();
  const url = css.match(/src: url\((.+?)\) format\('truetype'\)/)?.[1];
  if (!url) throw new Error(`OGP 用フォントを取得できませんでした: ${family}`);
  return (await fetch(url)).arrayBuffer();
}

// 全記事ぶんの文字をまとめて1回だけ取る
let fontsPromise: Promise<{ name: string; data: ArrayBuffer; weight: 700 }[]> | undefined;
export function prepareFonts(cards: Card[]) {
  const jpText = [...new Set(cards.flatMap((c) => [c.title, ...c.tags, c.date]).join("") + SITE.URL)].join("");
  fontsPromise ??= Promise.all([
    loadFont("Noto Sans JP", jpText).then((data) => ({ name: "Noto Sans JP", data, weight: 700 as const })),
    loadFont("IBM Plex Mono", SITE.TITLE.toUpperCase() + "morilab-garage.com").then((data) => ({ name: "IBM Plex Mono", data, weight: 700 as const })),
  ]);
  return fontsPromise;
}

const h = (type: string, style: Record<string, unknown>, children?: unknown) => ({ type, props: { style, children } });

function titleSize(title: string): number {
  const len = [...title].length;
  if (len <= 24) return 68;
  if (len <= 40) return 58;
  if (len <= 60) return 50;
  return 44;
}

export async function renderOgImage(card: Card, fonts: Awaited<ReturnType<typeof prepareFonts>>): Promise<Buffer> {
  const mono = "IBM Plex Mono";
  const tree = h(
    "div",
    {
      width: "100%",
      height: "100%",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "60px 64px",
      backgroundColor: "#FEFEFE",
      backgroundImage: "radial-gradient(circle, #d4d4d4 1.5px, transparent 1.5px)",
      backgroundSize: "28px 28px",
      fontFamily: "Noto Sans JP",
      color: "#111111",
    },
    [
      h(
        "div",
        { display: "flex", gap: "12px" },
        card.tags.slice(0, 3).map((tag, i) =>
          h(
            "div",
            {
              display: "flex",
              padding: "6px 18px",
              borderRadius: "10px",
              fontSize: "26px",
              backgroundColor: i === 0 ? "#27FF0B" : "#FEFEFE",
              border: "2px solid #111111",
            },
            tag,
          ),
        ),
      ),
      h(
        "div",
        { display: "flex", fontSize: `${titleSize(card.title)}px`, lineHeight: 1.35, wordBreak: "auto-phrase", maxHeight: "400px", overflow: "hidden" },
        card.title,
      ),
      h("div", { display: "flex", alignItems: "flex-end", justifyContent: "space-between" }, [
        h("div", { display: "flex", fontFamily: mono, fontSize: "56px", letterSpacing: "-1px" }, SITE.TITLE.toUpperCase()),
        h("div", { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", fontSize: "24px" }, [
          h("div", { display: "flex", color: "#555555" }, card.date),
          h("div", { display: "flex", fontFamily: mono, borderLeft: "6px solid #27FF0B", paddingLeft: "12px" }, "morilab-garage.com"),
        ]),
      ]),
    ],
  );
  const svg = await satori(tree as never, { width: OG_WIDTH, height: OG_HEIGHT, fonts });
  return sharp(Buffer.from(svg)).png().toBuffer();
}
