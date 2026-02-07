import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/photos/:id – update takenAt / description
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.takenAt !== undefined) data.takenAt = new Date(body.takenAt);
    if (body.description !== undefined) data.description = body.description;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const photo = await db.photo.update({ where: { id }, data });
    return NextResponse.json(photo);
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    console.error("PATCH /api/photos/:id error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// DELETE /api/photos/:id – remove from DB (Cloudinary cleanup TBD)
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    await db.photo.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    console.error("DELETE /api/photos/:id error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}