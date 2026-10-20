"use server";

import { renameAccount } from "@/server/account";
import { requireViewer } from "@/server/auth/session";
import { toActionResult } from "@/server/errors";

export async function renameAccountAction(name: unknown) {
  return toActionResult(async () => renameAccount(await requireViewer(), name));
}
