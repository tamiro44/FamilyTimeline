import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";


// POST /api/photos – save photo metadata after client-side Cloudinary upload
export async function POST(request: NextRequest) {
  try {
    const { publicId, url, takenAt, description } = await request.json();

    if (!publicId || !url || !takenAt) {
      return NextResponse.json(
        { error: "Missing required fields: publicId, url, takenAt" },
        { status: 400 }
      );
    }

    const photo = await db.photo.create({
      data: {
        cloudinaryPublicId: publicId,
        url,
        takenAt: new Date(takenAt),
        description: description || null,
      },
    });

    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    console.error("POST /api/photos error:", error);
    return NextResponse.json(
      { error: "Failed to save photo" },
      { status: 500 }
    );
  }
}

// GET /api/photos – list photos with cursor pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
    const cursor = searchParams.get("cursor");

    const photos = await db.photo.findMany({
      take: limit + 1, // fetch one extra to determine nextCursor
      orderBy: [{ takenAt: "desc" }, { id: "desc" }],
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // skip the cursor itself
      }),
      select: {
        id: true,
        url: true,
        takenAt: true,
        description: true,
        cloudinaryPublicId: true,
        uploadedAt: true,
      },
    });

    let nextCursor: string | null = null;
    if (photos.length > limit) {
      const last = photos.pop()!;
      nextCursor = last.id;
    }

    return NextResponse.json({ items: photos, nextCursor });
  } catch (error) {
    console.error("GET /api/photos error:", error);
    return NextResponse.json({ error: "Failed to fetch photos" }, { status: 500 });
  }
}