import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// GET /api/videos/:id – get video job status
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const job = await db.videoJob.findUnique({ where: { id } });

    if (!job) {
      return NextResponse.json({ error: "Video job not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      outputUrl: job.outputUrl,
      dateFrom: job.dateFrom,
      dateTo: job.dateTo,
      createdAt: job.createdAt,
    });
  } catch (error) {
    console.error("GET /api/videos/:id error:", error);
    return NextResponse.json({ error: "Failed to fetch video job" }, { status: 500 });
  }
}