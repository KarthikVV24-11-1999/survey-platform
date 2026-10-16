import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { media } from "@/server/db/schema";
import { isValidMediaKey, storage } from "@/server/media/storage";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_request: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const key = (await ctx.params).key.join("/");
  if (!isValidMediaKey(key)) return notFound();

  // blocked means the poll was rejected or removed
  const row = await db().query.media.findFirst({
    where: eq(media.storageKey, key),
    columns: { status: true, mime: true },
  });
  if (!row || row.status !== "active") return notFound();

  const object = await storage().get(key);
  if (!object) return notFound();

  return new Response(Buffer.from(object.body), {
    headers: {
      "Content-Type": row.mime,
      // short CDN cache so takedowns apply within an hour
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Content-Disposition": "inline",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
