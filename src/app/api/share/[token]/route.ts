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
      installments: {
        orderBy: { monthNumber: "asc" },
        include: { penalties: { orderBy: { appliedAt: "desc" } } },
      },
      penalties: { orderBy: { appliedAt: "desc" } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!tx) {
    return NextResponse.json({ error: "This link is invalid or has been revoked." }, { status: 404 });
  }

  if (tx.shareExpiresAt && new Date(tx.shareExpiresAt) < new Date()) {
    return NextResponse.json({ error: "This link has expired." }, { status: 410 });
  }

  // Strip sensitive user data — only expose display name
  const { user, userId, shareToken, ...publicTx } = tx as typeof tx & { user: { name: string | null; email: string } };

  return NextResponse.json({
    ...publicTx,
    sharedBy: user.name ?? user.email.split("@")[0],
  });
}