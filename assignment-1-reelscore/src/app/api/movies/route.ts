import { NextRequest, NextResponse } from "next/server";
import { popularMovies, searchMovies } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const page = Number(searchParams.get("page") ?? "1") || 1;

  try {
    const result = query ? await searchMovies(query, page) : await popularMovies(page);
    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/movies failed:", err);
    return NextResponse.json(
      { error: "Couldn't reach the movie database. Please try again." },
      { status: 502 }
    );
  }
}
