// src/app/api/share/[token]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const tx = await prisma.transaction.findFirst({
    where: { shareToken: token },
    include: {
      installments: { orderBy: { monthNumber: "asc" }, include: { penalties: { orderBy: { appliedAt: "desc" } } } },
      penalties: { orderBy: { appliedAt: "desc" } },
      user: { select: { name: true } },
    },
  });

  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check expiry
  if (tx.shareExpiresAt && new Date(tx.shareExpiresAt) < new Date()) {
    return NextResponse.json({ error: "This link has expired" }, { status: 410 });
  }

  // Return safe subset — no userId, no user email
  const { userId, shareToken, user, ...safe } = tx;
  return NextResponse.json({ ...safe, sharedBy: user.name });
}