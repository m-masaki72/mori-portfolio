import type { APIRoute } from "astro";
import { ADSENSE_CLIENT } from "@/consts";

// AdSense の ads.txt。ID未設定時はコメントのみ（空の ads.txt は「認定販売者なし」と解釈されうるため）
export const GET: APIRoute = () => {
  const body = ADSENSE_CLIENT
    ? `google.com, ${ADSENSE_CLIENT.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`
    : "# AdSense publisher ID not configured yet\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
