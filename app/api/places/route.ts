import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  deleteUserPlace,
  listUserPlaces,
  saveUserPlace,
  updateUserPlace
} from "@/lib/store/localDb";
import { parseMapBookmarkLines, parseUserPlaceInput } from "@/lib/validation";
import { USER_PLACE_STATUSES, type UserPlaceStatus } from "@/lib/types";

export async function GET() {
  const places = await listUserPlaces();
  return NextResponse.json({ places });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.mode === "maps_import") {
      const imported = parseMapBookmarkLines(String(body.rawText ?? ""));
      const places = [];

      for (const place of imported) {
        places.push(
          await saveUserPlace({
            name: place.name,
            neighborhood: place.neighborhood,
            category: "other",
            status: "bookmarked",
            source: "google_maps_bookmark",
            tags: ["maps"],
            notes: "Imported from a pasted Maps bookmark list."
          })
        );
      }

      return NextResponse.json({ places }, { status: 201 });
    }

    const place = await saveUserPlace(parseUserPlaceInput(body));
    return NextResponse.json({ place }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save place" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      status?: UserPlaceStatus;
    };

    if (!body.id || !body.status) {
      return NextResponse.json({ error: "Missing place id or status" }, { status: 400 });
    }

    if (!USER_PLACE_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Unsupported place status" }, { status: 400 });
    }

    const place = await updateUserPlace(body.id, (current) => ({
      ...current,
      status: body.status as UserPlaceStatus,
      lastVisitedAt:
        body.status === "visited"
          ? current.lastVisitedAt ?? new Date().toISOString()
          : current.lastVisitedAt
    }));

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    return NextResponse.json({ place });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update place" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing place id" }, { status: 400 });
  }

  const deleted = await deleteUserPlace(id);

  if (!deleted) {
    return NextResponse.json({ error: "Place not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
