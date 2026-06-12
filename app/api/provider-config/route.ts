import { NextResponse } from "next/server";
import {
  getProviderConfigStatus,
  saveGooglePlacesApiKey
} from "@/lib/store/providerConfig";

export async function GET() {
  return NextResponse.json(await getProviderConfigStatus());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const googlePlacesApiKey =
      typeof body.googlePlacesApiKey === "string"
        ? body.googlePlacesApiKey
        : "";

    return NextResponse.json(await saveGooglePlacesApiKey(googlePlacesApiKey));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save Google Places API key."
      },
      { status: 400 }
    );
  }
}
