import { NextRequest, NextResponse } from "next/server";
import { Prisma as PrismaRuntime } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession, handleApiError, paginationParams } from "@/lib/api-helpers";
import { employeeSchema } from "@/lib/validation/employee";
import { generateNextEmployeeCode } from "@/lib/employeeCode";
import { writeAuditLog } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim();
    const department = searchParams.get("department")?.trim();
    const status = searchParams.get("status")?.trim();
    const { page, pageSize, skip, take } = paginationParams(searchParams);

    const where: Prisma.EmployeeWhereInput = {
      ...(department ? { department } : {}),
      ...(status ? { status: status as "ACTIVE" | "INACTIVE" } : {}),
      ...(search
        ? {
            OR: [
              { employeeCode: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { department: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: { salaryConfig: true },
        orderBy: { employeeCode: "asc" },
        skip,
        take,
      }),
      prisma.employee.count({ where }),
    ]);

    return NextResponse.json({ employees, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const body = employeeSchema.parse(await request.json());

    if (body.employeeCode) {
      const existing = await prisma.employee.findUnique({ where: { employeeCode: body.employeeCode } });
      if (existing) {
        return NextResponse.json({ error: "An employee with this Employee ID already exists" }, { status: 409 });
      }
    }

    // Employee ID is auto-generated (EMP001, EMP002, ...) unless explicitly
    // supplied (e.g. by an Excel import). Retry a couple of times in the rare
    // case two employees are created concurrently and collide on the code.
    let employee = null;
    for (let attempt = 0; attempt < 3 && !employee; attempt++) {
      const employeeCode = body.employeeCode || (await generateNextEmployeeCode());
      try {
        employee = await prisma.employee.create({
          data: {
            employeeCode,
            name: body.name,
            mobile: body.mobile || null,
            email: body.email || null,
            address: body.address || null,
            department: body.department || null,
            designation: body.designation || null,
            joiningDate: body.joiningDate ? new Date(body.joiningDate) : null,
            status: body.status,
            salaryConfig: {
              create: {
                basicSalary: body.basicSalary,
                hra: body.hra,
                conveyance: body.conveyance,
                monthlySalary: body.basicSalary + body.hra + body.conveyance,
                pfApplicable: body.pfApplicable,
                esiApplicable: body.esiApplicable,
                ptApplicable: body.ptApplicable,
                rttApplicable: body.rttApplicable,
                paidLeaveApplicable: body.paidLeaveApplicable,
              },
            },
          },
          include: { salaryConfig: true },
        });
      } catch (err) {
        const isUniqueClash = err instanceof PrismaRuntime.PrismaClientKnownRequestError && err.code === "P2002";
        if (!isUniqueClash || body.employeeCode) throw err;
      }
    }
    if (!employee) {
      return NextResponse.json({ error: "Unable to generate a unique Employee ID, please try again" }, { status: 500 });
    }

    await writeAuditLog({
      userId: session.sub,
      action: "EMPLOYEE_CREATED",
      entity: "Employee",
      entityId: employee.id,
      newValue: { ...body, employeeCode: employee.employeeCode },
    });

    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
