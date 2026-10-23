import { join } from "node:path";
import sharp from "sharp";

// 記事内の画像（public/ 配下を指す <img>）に width・height を付け、読み込み中のレイアウトのずれ（CLS）を防ぐ。
// 表示サイズは CSS（max-width: 100%; height: auto）で縮むので、比率だけが効く
export default function rehypeImageSize() {
  return async (tree) => {
    const imgs = [];
    (function walk(node) {
      if (node.type === "element" && node.tagName === "img") imgs.push(node);
      node.children?.forEach(walk);
    })(tree);

    await Promise.all(
      imgs.map(async (img) => {
        const src = img.properties?.src;
        if (typeof src !== "string" || !src.startsWith("/") || img.properties.width) return;
        // 画像が見つからないときはビルドを止める（リンク切れに気づけるように）
        const { width, height } = await sharp(join("public", decodeURI(src))).metadata();
        Object.assign(img.properties, { width, height, loading: "lazy", decoding: "async" });
      }),
    );
  };
}
