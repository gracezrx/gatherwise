import { NextResponse } from "next/server";
import { getProviderConfigStatus } from "@/lib/store/providerConfig";

export async function GET() {
  const providerStatus = await getProviderConfigStatus();

  return NextResponse.json({
    ok: true,
    app: "Gatherwise",
    googlePlacesConfigured: providerStatus.googlePlaces.configured,
    storage: "local-json"
  });
}
