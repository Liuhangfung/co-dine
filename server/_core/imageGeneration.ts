/**
 * Image generation helper using internal ImageService
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 *
 * For editing:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "Add a rainbow to this landscape",
 *     originalImages: [{
 *       url: "https://example.com/original.jpg",
 *       mimeType: "image/jpeg"
 *     }]
 *   });
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  // Priority 1: Stability AI (Stable Diffusion) - No VPN needed, good quality
  const stabilityApiKey = ENV.stabilityAiApiKey || process.env.STABILITY_AI_API_KEY || '';
  if (stabilityApiKey) {
    console.log('[ImageGeneration] Using Stability AI (Stable Diffusion) for image generation');
    return await generateImageWithStabilityAI(options, stabilityApiKey);
  }

  // Priority 2: Replicate (hosts Stable Diffusion) - No VPN needed
  const replicateToken = ENV.replicateApiToken || process.env.REPLICATE_API_TOKEN || '';
  if (replicateToken) {
    console.log('[ImageGeneration] Using Replicate for image generation');
    return await generateImageWithReplicate(options, replicateToken);
  }

  // Priority 3: OpenAI DALL-E API (requires VPN in some regions)
  const openaiApiKey = ENV.openaiApiKey || process.env.OPENAI_API_KEY || '';
  if (openaiApiKey) {
    console.log('[ImageGeneration] Using OpenAI DALL-E 3 for image generation');
    return await generateImageWithDALLE(options, openaiApiKey);
  }

  // Fallback to Connect RPC service (if configured)
  const forgeApiUrl = ENV.forgeApiUrl || process.env.BUILT_IN_FORGE_API_URL || '';
  const forgeApiKey = ENV.forgeApiKey || process.env.BUILT_IN_FORGE_API_KEY || '';
  
  if (forgeApiUrl && forgeApiKey) {
    console.log('[ImageGeneration] Using Connect RPC service for image generation');
    return await generateImageWithConnectRPC(options, forgeApiUrl, forgeApiKey);
  }

  throw new Error("No image generation service configured. Please set one of: STABILITY_AI_API_KEY, REPLICATE_API_TOKEN, OPENAI_API_KEY, or BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY.");
}

/**
 * Generate image using Stability AI (Stable Diffusion) API
 * No VPN required, good quality, affordable
 */
async function generateImageWithStabilityAI(
  options: GenerateImageOptions,
  apiKey: string
): Promise<GenerateImageResponse> {
  // Use Stable Diffusion XL for best quality
  const response = await fetch("https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
    },
    body: JSON.stringify({
      text_prompts: [
        {
          text: options.prompt,
          weight: 1.0
        }
      ],
      cfg_scale: 7,
      height: 1024,
      width: 1024,
      steps: 30,
      samples: 1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Stability AI image generation failed (${response.status} ${response.statusText})${errorText ? `: ${errorText}` : ""}`
    );
  }

  const result = await response.json() as {
    artifacts: Array<{
      base64: string;
      finishReason: string;
    }>;
  };

  if (!result.artifacts || result.artifacts.length === 0) {
    throw new Error("Stability AI returned no image data");
  }

  const base64Data = result.artifacts[0].base64;
  const buffer = Buffer.from(base64Data, "base64");

  // Try to save to S3, but if storage is not configured, return data URL as fallback
  try {
    const { url } = await storagePut(
      `generated/${Date.now()}.png`,
      buffer,
      "image/png"
    );
    console.log('[ImageGeneration] ✅ Stability AI image generated and saved to storage:', url);
    return { url };
  } catch (storageError) {
    console.warn('[ImageGeneration] ⚠️  Storage upload failed, using data URL fallback');
    console.warn('[ImageGeneration]   Error:', storageError instanceof Error ? storageError.message : String(storageError));
    // Return data URL as fallback (can be used directly in img src)
    const dataUrl = `data:image/png;base64,${base64Data}`;
    console.log('[ImageGeneration] ✅ Returning data URL (length:', dataUrl.length, 'chars)');
    return { url: dataUrl };
  }
}

/**
 * Generate image using Replicate API (hosts Stable Diffusion)
 * No VPN required, easy to use, pay-per-use
 */
async function generateImageWithReplicate(
  options: GenerateImageOptions,
  apiToken: string
): Promise<GenerateImageResponse> {
  // Use Stable Diffusion XL model via Replicate
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Token ${apiToken}`,
    },
    body: JSON.stringify({
      version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b", // stable-diffusion-xl
      input: {
        prompt: options.prompt,
        width: 1024,
        height: 1024,
        num_outputs: 1,
        guidance_scale: 7.5,
        num_inference_steps: 30,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Replicate image generation failed (${response.status} ${response.statusText})${errorText ? `: ${errorText}` : ""}`
    );
  }

  const prediction = await response.json() as {
    id: string;
    status: string;
    urls?: {
      get: string;
    };
  };

  // Poll for completion (Replicate is async)
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max
  let finalPrediction = prediction;

  while (finalPrediction.status !== "succeeded" && finalPrediction.status !== "failed" && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: {
        "Authorization": `Token ${apiToken}`,
      },
    });

    if (!statusResponse.ok) {
      throw new Error(`Failed to check Replicate prediction status: ${statusResponse.statusText}`);
    }

    finalPrediction = await statusResponse.json() as typeof prediction;
    attempts++;
  }

  if (finalPrediction.status !== "succeeded") {
    throw new Error(`Replicate prediction failed or timed out. Status: ${finalPrediction.status}`);
  }

  // Get the image URL
  const getResponse = await fetch(finalPrediction.urls!.get, {
    headers: {
      "Authorization": `Token ${apiToken}`,
    },
  });

  if (!getResponse.ok) {
    throw new Error(`Failed to get Replicate image: ${getResponse.statusText}`);
  }

  const imageResult = await getResponse.json() as {
    output: string | string[]; // URL or array of URLs
  };

  const imageUrl = Array.isArray(imageResult.output) ? imageResult.output[0] : imageResult.output;
  
  // Replicate provides a direct URL that we can use without saving to storage
  // However, if storage is configured, we can optionally save it for better control
  try {
    // Try to download and save to our storage for better control
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download generated image: ${imageResponse.statusText}`);
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Save to S3
    const { url } = await storagePut(
      `generated/${Date.now()}.png`,
      imageBuffer,
      "image/png"
    );

    console.log('[ImageGeneration] ✅ Replicate image generated and saved to storage:', url);
    return { url };
  } catch (storageError) {
    // If storage fails, use Replicate's direct URL (it's hosted by Replicate)
    console.warn('[ImageGeneration] ⚠️  Storage upload failed, using Replicate URL directly');
    console.warn('[ImageGeneration]   Error:', storageError instanceof Error ? storageError.message : String(storageError));
    console.log('[ImageGeneration] ✅ Using Replicate-hosted URL:', imageUrl);
    return { url: imageUrl };
  }
}

/**
 * Generate image using OpenAI DALL-E 3 API
 */
async function generateImageWithDALLE(
  options: GenerateImageOptions,
  apiKey: string
): Promise<GenerateImageResponse> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: options.prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "b64_json", // Get base64 encoded image
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `OpenAI DALL-E image generation failed (${response.status} ${response.statusText})${errorText ? `: ${errorText}` : ""}`
    );
  }

  const result = await response.json() as {
    data: Array<{
      b64_json: string;
      revised_prompt?: string;
    }>;
  };

  if (!result.data || result.data.length === 0) {
    throw new Error("OpenAI DALL-E returned no image data");
  }

  const base64Data = result.data[0].b64_json;
  const buffer = Buffer.from(base64Data, "base64");

  // Save to S3
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    "image/png"
  );

  console.log('[ImageGeneration] ✅ DALL-E image generated and saved:', url);
  if (result.data[0].revised_prompt) {
    console.log('[ImageGeneration] 📝 Revised prompt:', result.data[0].revised_prompt);
  }

  return { url };
}

/**
 * Generate image using Connect RPC service (legacy/fallback)
 */
async function generateImageWithConnectRPC(
  options: GenerateImageOptions,
  apiUrl: string,
  apiKey: string
): Promise<GenerateImageResponse> {
  // Build the full URL by appending the service path to the base URL
  const baseUrl = apiUrl.endsWith("/")
    ? apiUrl
    : `${apiUrl}/`;
  const fullUrl = new URL(
    "images.v1.ImageService/GenerateImage",
    baseUrl
  ).toString();

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: options.prompt,
      original_images: options.originalImages || [],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as {
    image: {
      b64Json: string;
      mimeType: string;
    };
  };
  const base64Data = result.image.b64Json;
  const buffer = Buffer.from(base64Data, "base64");

  // Save to S3
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    result.image.mimeType
  );
  return {
    url,
  };
}
