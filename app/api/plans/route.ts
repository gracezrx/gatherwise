import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createPlanningSession, getPlanningSessionView } from "@/lib/services/planning";
import {
  AmbiguousLocationError,
  LocationResolutionError
} from "@/lib/services/locationResolution";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("id");

  if (!requestId) {
    return NextResponse.json({ error: "Missing request id" }, { status: 400 });
  }

  const session = await getPlanningSessionView(requestId);

  if (!session) {
    return NextResponse.json({ error: "Planning request not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const session = await createPlanningSession(body);
    return NextResponse.json(session, { status: 201 });
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

    if (error instanceof AmbiguousLocationError) {
      return NextResponse.json(
        {
          error: error.message,
          locationChoices: error.choices
        },
        { status: 409 }
      );
    }

    if (error instanceof LocationResolutionError) {
      return NextResponse.json(
        { error: error.message },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create plans" },
      { status: 500 }
    );
  }
}
