import { NextResponse } from "next/server";
import { recordPlanPlaceFeedback } from "@/lib/store/localDb";
import { USER_PLACE_STATUSES, type UserPlaceStatus } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      requestId?: string;
      planId?: string;
      status?: UserPlaceStatus;
    };

    if (!body.requestId || !body.planId || !body.status) {
      return NextResponse.json(
        { error: "Missing request id, plan id, or feedback status" },
        { status: 400 }
      );
    }

    if (!USER_PLACE_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Unsupported feedback status" }, { status: 400 });
    }

    const place = await recordPlanPlaceFeedback(body.requestId, body.planId, body.status);

    if (!place) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({ place });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save feedback" },
      { status: 500 }
    );
  }
}
