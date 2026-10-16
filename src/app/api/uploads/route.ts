import { NextResponse } from "next/server";
import { LIMITS } from "@/lib/validation";
import { requireViewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { assertSameOrigin, jsonError } from "@/server/http";
import { uploadImage } from "@/server/media/service";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const viewer = await requireViewer();

    // check the size before reading the body (plus some room for multipart overhead)
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (!declared || declared > LIMITS.imageMaxBytes + 64 * 1024) {
      throw new AppError("Images must be 4 MB or smaller.");
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("No file was uploaded.");
    if (file.size > LIMITS.imageMaxBytes) throw new AppError("Images must be 4 MB or smaller.");

    const uploaded = await uploadImage(viewer, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json(uploaded, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return jsonError(err);
  }
}
