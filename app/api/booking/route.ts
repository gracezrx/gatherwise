import { NextResponse } from "next/server";
import { getPlanningSessionView } from "@/lib/services/planning";
import { bookApprovedPlans, confirmManualBooking } from "@/lib/services/booking";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("requestId");

  if (!requestId) {
    return NextResponse.json({ error: "Missing request id" }, { status: 400 });
  }

  const session = await getPlanningSessionView(requestId);

  if (!session) {
    return NextResponse.json({ error: "Planning request not found" }, { status: 404 });
  }

  return NextResponse.json({
    request: session.request,
    recommendations: session.recommendations,
    approvedPlanIds: session.approvedPlanIds,
    booking: {
      requestId,
      state: session.bookingState,
      attempts: session.attempts,
      confirmation: session.confirmation
    }
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      requestId?: string;
      approvedPlanIds?: string[];
    };

    if (!body.requestId) {
      return NextResponse.json({ error: "Missing request id" }, { status: 400 });
    }

    const result = await bookApprovedPlans(body.requestId, body.approvedPlanIds ?? []);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to book plans" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      requestId?: string;
      planId?: string;
    };

    if (!body.requestId) {
      return NextResponse.json({ error: "Missing request id" }, { status: 400 });
    }

    const result = await confirmManualBooking(body.requestId, body.planId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to confirm manual booking"
      },
      { status: 500 }
    );
  }
}
