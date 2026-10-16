"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  addModerationTerm,
  removeModerationTerm,
  setUserBanned,
  setUserRole,
  setUserTrust,
  updateSiteSettings,
} from "@/server/admin/service";
import { requireAdmin, requireStaff } from "@/server/auth/session";
import { toActionResult } from "@/server/errors";
import { dismissReports, moderatePollAction as moderate } from "@/server/polls/manage";

const id = z.uuid();
const userId = z.string().min(1).max(100);
const note = z.string().max(500).optional();

export async function moderatePollAction(pollId: unknown, action: unknown, reason?: unknown) {
  return toActionResult(async () => {
    const staff = await requireStaff();
    const parsedAction = z.enum(["approve", "reject", "remove", "restore"]).parse(action);
    await moderate(staff, id.parse(pollId), parsedAction, note.parse(reason));
    refresh();
  });
}

export async function dismissReportsAction(pollId: unknown) {
  return toActionResult(async () => {
    const staff = await requireStaff();
    await dismissReports(staff, id.parse(pollId));
    refresh();
  });
}

export async function setUserTrustAction(targetId: unknown, trust: unknown) {
  return toActionResult(async () => {
    const staff = await requireStaff();
    await setUserTrust(staff, userId.parse(targetId), trust);
    refresh();
  });
}

export async function setUserRoleAction(targetId: unknown, role: unknown) {
  return toActionResult(async () => {
    const admin = await requireAdmin();
    await setUserRole(admin, userId.parse(targetId), role);
    refresh();
  });
}

export async function setUserBannedAction(targetId: unknown, banned: unknown, reason?: unknown) {
  return toActionResult(async () => {
    const admin = await requireAdmin();
    await setUserBanned(admin, userId.parse(targetId), z.boolean().parse(banned), note.parse(reason));
    refresh();
  });
}

export async function updateSettingsAction(settings: unknown) {
  return toActionResult(async () => {
    const admin = await requireAdmin();
    await updateSiteSettings(admin, settings);
    refresh();
  });
}

export async function addTermAction(term: unknown) {
  return toActionResult(async () => {
    const admin = await requireAdmin();
    await addModerationTerm(admin, term);
    refresh();
  });
}

export async function removeTermAction(termId: unknown) {
  return toActionResult(async () => {
    const admin = await requireAdmin();
    await removeModerationTerm(admin, id.parse(termId));
    refresh();
  });
}
