import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation/misc";
import { handleApiError } from "@/lib/api-helpers";
import { hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = forgotPasswordSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });

    // Always respond the same way to avoid leaking which emails are registered.
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiresAt: expiresAt },
    });

    // No email/SMTP provider is configured for this deployment. In production
    // this token would be emailed to the user rather than returned here.
    const devToken = process.env.NODE_ENV !== "production" ? token : undefined;
    return NextResponse.json({ ok: true, devToken });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = resetPasswordSchema.parse(await request.json());
    const user = await prisma.user.findFirst({ where: { resetToken: body.token } });
    if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      return NextResponse.json({ error: "Reset link is invalid or has expired" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(body.password),
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
