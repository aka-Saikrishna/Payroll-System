import { NextResponse } from "next/server";
import { getSessionUser, SessionPayload } from "@/lib/auth";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSessionUser();
  if (!session) throw new ApiError(401, "Not authenticated");
  return session;
}

export async function requireRole(roles: SessionPayload["role"][]): Promise<SessionPayload> {
  const session = await requireSession();
  if (!roles.includes(session.role)) throw new ApiError(403, "You do not have permission to perform this action");
  return session;
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: error.flatten() },
      { status: 400 }
    );
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientValidationError
  ) {
    // eslint-disable-next-line no-console
    console.error(error);
    const notFound = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
    return NextResponse.json(
      { error: notFound ? "The requested record could not be found. Please refresh and try again." : "A database error occurred." },
      { status: notFound ? 404 : 500 }
    );
  }
  if (error instanceof Error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function paginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
