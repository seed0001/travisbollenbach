import { NextRequest, NextResponse } from "next/server";
import {
  deleteUser,
  getAdminBySession,
  listUsers,
  setUserRole,
  SESSION_COOKIE,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  return getAdminBySession(token);
}

// Refresh the member list without a full page reload.
export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  return NextResponse.json({ members: await listUsers() });
}

// Change a member's role (admin <-> user). The owner is not writable.
export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const userId = (body as { userId?: unknown })?.userId;
  const role = (body as { role?: unknown })?.role;
  if (typeof userId !== "string" || (role !== "admin" && role !== "user")) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const updated = await setUserRole(userId, role);
  if (!updated) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
  return NextResponse.json({ member: updated });
}

// Remove a member entirely and revoke their sessions. The owner is protected.
export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const userId = (body as { userId?: unknown })?.userId;
  if (typeof userId !== "string") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const ok = await deleteUser(userId);
  if (!ok) {
    return NextResponse.json(
      { error: "That member can't be removed." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
