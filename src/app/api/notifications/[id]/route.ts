// src/app/api/notifications/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notification = await prisma.notification.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!notification) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.notification.update({
    where: { id: params.id },
    data: { isRead: true },
  });

  return NextResponse.json(updated);
}