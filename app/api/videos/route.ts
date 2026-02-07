import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/videos – create a pending video job
export async function POST(request: NextRequest) {
  try {
    const { dateFrom, dateTo } = await request.json();

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: "Missing required fields: dateFrom, dateTo" },
        { status: 400 }
      );
    }

    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    if (from > to) {
      return NextResponse.json(
        { error: "dateFrom must be before dateTo" },
        { status: 400 }
      );
    }

    const job = await db.videoJob.create({
      data: {
        dateFrom: from,
        dateTo: to,
      },
    });

    return NextResponse.json({ id: job.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/videos error:", error);
    return NextResponse.json({ error: "Failed to create video job" }, { status: 500 });
  }
}