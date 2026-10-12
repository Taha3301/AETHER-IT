import { readFile } from "node:fs/promises";
import { join } from "node:path";

const assets = {
  "swagger-ui.css": "text/css; charset=utf-8",
  "swagger-ui-bundle.js": "text/javascript; charset=utf-8",
  "swagger-ui-standalone-preset.js": "text/javascript; charset=utf-8",
} as const;

type AssetName = keyof typeof assets;
type AssetContext = { params: Promise<{ asset: string }> };

function isAssetName(asset: string): asset is AssetName {
  return Object.hasOwn(assets, asset);
}

export async function GET(_request: Request, { params }: AssetContext): Promise<Response> {
  const { asset } = await params;
  if (!isAssetName(asset)) {
    return new Response("Not found.", { status: 404 });
  }

  const content = await readFile(join(process.cwd(), "node_modules", "swagger-ui-dist", asset));
  return new Response(content, {
    headers: {
      "Content-Type": assets[asset],
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
