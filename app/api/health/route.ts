import { NextResponse } from "next/server";
import { getProviderConfigStatus } from "@/lib/store/providerConfig";
import { getDbStorageMode } from "@/lib/store/localDb";

export async function GET() {
  const providerStatus = await getProviderConfigStatus();

  return NextResponse.json({
    ok: true,
    app: "Gatherwise",
    googlePlacesConfigured: providerStatus.googlePlaces.configured,
    storage: getDbStorageMode()
  });
}
