import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { mkdir } from "fs/promises";
import { db } from "@/lib/db";

const OUTPUT_DIR = path.join(process.cwd(), "data", "outputs");

function renderVideo(jobId: string): void {
  (async () => {
    try {
      await db.videoJob.update({
        where: { id: jobId },
        data: { status: "processing" },
      });

      await mkdir(OUTPUT_DIR, { recursive: true });

      const outPath = path.join(OUTPUT_DIR, `${jobId}.mp4`);

      await new Promise<void>((resolve, reject) => {
  const ff = spawn("ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", "color=c=black:s=1280x720:d=4:r=25",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    outPath,
  ]);

  let stderr = "";

  ff.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
    if (stderr.length > 20000) {
      stderr = stderr.slice(-20000); // שומר רק 20KB אחרונים
    }
  });

  ff.on("close", (code) => {
    if (code === 0) {
      resolve();
    } else {
      reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`));
    }
  });

  ff.on("error", reject);
});


      await db.videoJob.update({
        where: { id: jobId },
        data: { status: "done", outputUrl: `/api/videos/file/${jobId}` },
      });
    } catch (err) {
      console.error(`Video render failed for job ${jobId}:`, err);
      await db.videoJob.update({
        where: { id: jobId },
        data: { status: "failed" },
      }).catch(() => {});
    }
  })();
}

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

    // Fire-and-forget background render
    renderVideo(job.id);

    return NextResponse.json({ id: job.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/videos error:", error);
    return NextResponse.json({ error: "Failed to create video job" }, { status: 500 });
  }
}