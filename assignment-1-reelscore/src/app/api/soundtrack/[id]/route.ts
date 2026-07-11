import { NextRequest, NextResponse } from "next/server";
import { findSoundtrack } from "@/lib/deezer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const title = new URL(request.url).searchParams.get("title")?.trim();

  if (!title) {
    return NextResponse.json({ error: "Missing ?title= for soundtrack lookup." }, { status: 400 });
  }

  try {
    const soundtrack = await findSoundtrack(title);
    if (!soundtrack) {
      return NextResponse.json({ error: "No soundtrack found for this title." }, { status: 404 });
    }
    return NextResponse.json(soundtrack);
  } catch (err) {
    console.error(`GET /api/soundtrack/${id} failed:`, err);
    return NextResponse.json(
      { error: "Couldn't reach the music catalog. Please try again." },
      { status: 502 }
    );
  }
}
