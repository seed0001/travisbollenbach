import { NextRequest, NextResponse } from "next/server";
import {
  getAdminBySession,
  getUserByEmail,
  normalizeEmail,
  SESSION_COOKIE,
} from "@/lib/auth";
import { assignUnit, listStudios, vacateUnit } from "@/lib/studios";

export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  return getAdminBySession(token);
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  return NextResponse.json({ studios: await listStudios() });
}

// Assign a unit to a registered member by email.
export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const unit = (body as { unit?: unknown })?.unit;
  const email = normalizeEmail((body as { email?: unknown })?.email);
  if (typeof unit !== "string" || !email) {
    return NextResponse.json(
      { error: "A unit and a valid email are required." },
      { status: 400 },
    );
  }
  const user = await getUserByEmail(email);
  if (!user) {
    return NextResponse.json(
      { error: "No registered member with that email." },
      { status: 404 },
    );
  }
  const studio = await assignUnit(unit, user.id, user.email);
  if (!studio) {
    return NextResponse.json({ error: "Unknown unit." }, { status: 400 });
  }
  return NextResponse.json({ studio });
}

// Vacate a unit (remove its owner).
export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const unit = (body as { unit?: unknown })?.unit;
  if (typeof unit !== "string") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const ok = await vacateUnit(unit);
  if (!ok) {
    return NextResponse.json({ error: "Unit was already empty." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
