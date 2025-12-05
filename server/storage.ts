// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)

import { ENV } from './_core/env';

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  // Use process.env as fallback if ENV object doesn't have values
  const baseUrl = ENV.forgeApiUrl || process.env.BUILT_IN_FORGE_API_URL || '';
  const apiKey = ENV.forgeApiKey || process.env.BUILT_IN_FORGE_API_KEY || '';

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  try {
    const { baseUrl, apiKey } = getStorageConfig();
    const key = normalizeKey(relKey);
    const uploadUrl = buildUploadUrl(baseUrl, key);
    
    console.log('[Storage] 📤 Uploading to storage:', key);
    console.log('[Storage] 📊 Upload details:');
    console.log('[Storage]   - Base URL:', baseUrl);
    console.log('[Storage]   - Upload URL:', uploadUrl.toString());
    console.log('[Storage]   - Content type:', contentType);
    console.log('[Storage]   - Data size:', typeof data === 'string' ? data.length : data.length, 'bytes');
    
    const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: buildAuthHeaders(apiKey),
      body: formData,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      console.error('[Storage] ❌ Upload failed:', response.status, response.statusText);
      console.error('[Storage]   Error details:', message);
      throw new Error(
        `Storage upload failed (${response.status} ${response.statusText}): ${message}`
      );
    }
    
    const result = await response.json();
    const url = result.url;
    console.log('[Storage] ✅ Upload successful:', url);
    return { key, url };
  } catch (error) {
    console.error('[Storage] ❌ Storage upload error:');
    console.error('[Storage]   Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[Storage]   Error message:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}
