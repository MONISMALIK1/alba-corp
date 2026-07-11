import { NextResponse } from "next/server";
import { movieDetail } from "@/lib/tmdb";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const detail = await movieDetail(id);
    return NextResponse.json(detail);
  } catch (err) {
    console.error(`GET /api/movies/${id} failed:`, err);
    return NextResponse.json(
      { error: "Couldn't load this movie right now. Please try again." },
      { status: 502 }
    );
  }
}
