import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

const OUTPUT_DIR = path.join(process.cwd(), "data", "outputs");

// GET /api/videos/file/:id – stream rendered mp4
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const filePath = path.join(OUTPUT_DIR, `${id}.mp4`);

  try {
    const info = await stat(filePath);
    const buffer = await readFile(filePath);

    return new Response(buffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": info.size.toString(),
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
