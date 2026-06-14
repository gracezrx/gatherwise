import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const CONFIG_DIR = path.join(process.cwd(), "work");
const CONFIG_FILE = path.join(CONFIG_DIR, "provider-config.json");

interface StoredProviderConfig {
  googlePlacesApiKey?: string;
  updatedAt?: string;
}

export interface ProviderConfigStatus {
  googlePlaces: {
    configured: boolean;
    source: "environment" | "local_file" | "missing";
    localSaveEnabled: boolean;
  };
}

export function canSaveGooglePlacesApiKeyLocally() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.GATHERWISE_ALLOW_LOCAL_CONFIG === "true"
  );
}

async function readProviderConfig(): Promise<StoredProviderConfig> {
  if (!canSaveGooglePlacesApiKeyLocally()) {
    return {};
  }

  try {
    const raw = await readFile(CONFIG_FILE, "utf8");
    return JSON.parse(raw) as StoredProviderConfig;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {};
    }

    throw error;
  }
}

export async function getGooglePlacesApiKey() {
  const config = await readProviderConfig();
  return process.env.GOOGLE_PLACES_API_KEY ?? config.googlePlacesApiKey;
}

export async function hasGooglePlacesApiKey() {
  return Boolean((await getGooglePlacesApiKey())?.trim());
}

export async function getProviderConfigStatus(): Promise<ProviderConfigStatus> {
  const config = await readProviderConfig();
  const localKey = config.googlePlacesApiKey?.trim();
  const envKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const apiKey = envKey || localKey;

  return {
    googlePlaces: {
      configured: Boolean(apiKey),
      source: envKey ? "environment" : localKey ? "local_file" : "missing",
      localSaveEnabled: canSaveGooglePlacesApiKeyLocally()
    }
  };
}

export async function saveGooglePlacesApiKey(apiKey: string) {
  if (!canSaveGooglePlacesApiKeyLocally()) {
    throw new Error(
      "For a shared website, add GOOGLE_PLACES_API_KEY as a private server environment variable instead of saving it from the page."
    );
  }

  const trimmedApiKey = apiKey.trim();

  if (trimmedApiKey.length < 20) {
    throw new Error("Enter a valid Google Places API key.");
  }

  const existing = await readProviderConfig();
  const nextConfig: StoredProviderConfig = {
    ...existing,
    googlePlacesApiKey: trimmedApiKey,
    updatedAt: new Date().toISOString()
  };

  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");

  return getProviderConfigStatus();
}
