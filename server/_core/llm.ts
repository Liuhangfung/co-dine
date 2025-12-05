import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = () => {
  // Use process.env as fallback if ENV object doesn't have value
  const apiUrl = ENV.forgeApiUrl || process.env.BUILT_IN_FORGE_API_URL || '';
  if (apiUrl && apiUrl.trim().length > 0) {
    const baseUrl = apiUrl.replace(/\/$/, "");
    // Perplexity uses OpenAI-compatible format with /v1/chat/completions
    if (baseUrl.includes('api.perplexity.ai')) {
      return `${baseUrl}/chat/completions`;
    }
    // DeepSeek uses /v1/chat/completions
    if (baseUrl.includes('api.deepseek.com')) {
      return `${baseUrl}/chat/completions`;
    }
    // xAI uses OpenAI-compatible format
    if (baseUrl.includes('api.x.ai')) {
      return `${baseUrl}/chat/completions`;
    }
    // For other APIs, check if they need /v1/ prefix
    return `${baseUrl}/v1/chat/completions`;
  }
  return "https://api.x.ai/v1/chat/completions"; // Default to xAI
};

const checkApiKey = () => {
  console.log('[LLM] 🔍 Checking API configuration...');
  console.log('[LLM]   - ENV.forgeApiKey exists:', !!ENV.forgeApiKey);
  console.log('[LLM]   - ENV.forgeApiKey length:', ENV.forgeApiKey?.length || 0);
  console.log('[LLM]   - ENV.forgeApiUrl exists:', !!ENV.forgeApiUrl);
  console.log('[LLM]   - ENV.forgeApiUrl value:', ENV.forgeApiUrl || '(empty)');
  console.log('[LLM]   - process.env.BUILT_IN_FORGE_API_KEY exists:', !!process.env.BUILT_IN_FORGE_API_KEY);
  console.log('[LLM]   - process.env.BUILT_IN_FORGE_API_KEY length:', process.env.BUILT_IN_FORGE_API_KEY?.length || 0);
  console.log('[LLM]   - process.env.BUILT_IN_FORGE_API_URL exists:', !!process.env.BUILT_IN_FORGE_API_URL);
  console.log('[LLM]   - process.env.BUILT_IN_FORGE_API_URL value:', process.env.BUILT_IN_FORGE_API_URL || '(empty)');
  
  // Try to use process.env directly if ENV object doesn't have them
  const apiKey = ENV.forgeApiKey || process.env.BUILT_IN_FORGE_API_KEY || '';
  const apiUrl = ENV.forgeApiUrl || process.env.BUILT_IN_FORGE_API_URL || '';
  
  if (!apiKey || !apiUrl) {
    console.error('[LLM] ❌ API configuration missing!');
    return {
      error: "AI service is not configured. Please set BUILT_IN_FORGE_API_KEY and BUILT_IN_FORGE_API_URL environment variables.",
    };
  }
  
  console.log('[LLM] ✅ API configuration valid');
  return null;
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const apiKeyError = checkApiKey();
  if (apiKeyError) {
    throw new Error(apiKeyError.error);
  }

  // Use process.env as fallback if ENV object doesn't have values
  const forgeApiUrl = ENV.forgeApiUrl || process.env.BUILT_IN_FORGE_API_URL || '';
  const forgeApiKey = ENV.forgeApiKey || process.env.BUILT_IN_FORGE_API_KEY || '';

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  // Detect which AI service is being used and set appropriate model
  const isDeepSeek = forgeApiUrl?.includes('api.deepseek.com') || (!forgeApiUrl && forgeApiKey?.startsWith('sk-') && !forgeApiUrl);
  const isPerplexity = forgeApiUrl?.includes('api.perplexity.ai') || forgeApiKey?.startsWith('pplx-');
  const isOpenAI = forgeApiUrl?.includes('api.openai.com');
  const isXAI = forgeApiUrl?.includes('api.x.ai') || forgeApiKey?.startsWith('xai-');
  
  let model: string;
  if (isDeepSeek) {
    model = "deepseek-chat"; // DeepSeek's main model
  } else if (isPerplexity) {
    model = "sonar-pro"; // Perplexity's most capable model
  } else if (isOpenAI) {
    model = "gpt-4o"; // Fast and capable
  } else if (isXAI) {
    model = "grok-2-1212"; // xAI's latest Grok model (fast and capable)
  } else {
    model = "grok-2-1212"; // Default to xAI Grok (fast and reliable)
  }
  
  const payload: Record<string, unknown> = {
    model,
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  // Set max_tokens based on API provider limits
  if (isDeepSeek) {
    payload.max_tokens = 8192; // DeepSeek limit
  } else if (isOpenAI) {
    payload.max_tokens = 4096; // OpenAI GPT-4o default (good balance of speed and length)
  } else if (isXAI) {
    payload.max_tokens = 4096; // xAI Grok default (fast and detailed)
  } else {
    payload.max_tokens = 16384; // Others
  }
  
  // Only add thinking parameter for non-OpenAI/Perplexity/DeepSeek/xAI APIs
  if (!isOpenAI && !isPerplexity && !isDeepSeek && !isXAI) {
    payload.thinking = {
      "budget_tokens": 128
    }
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  // DeepSeek doesn't support response_format parameter yet
  // xAI (Grok) supports OpenAI-compatible response_format
  if (normalizedResponseFormat && !isDeepSeek) {
    payload.response_format = normalizedResponseFormat;
  }

  const apiUrl = resolveApiUrl();
  console.log('[LLM] 📤 Making API request to:', apiUrl);
  console.log('[LLM] 📊 Request details:');
  console.log('[LLM]   - Model:', payload.model);
  console.log('[LLM]   - Messages count:', payload.messages.length);
  console.log('[LLM]   - Payload size:', JSON.stringify(payload).length, 'bytes');
  console.log('[LLM]   - API Key prefix:', forgeApiKey.substring(0, 10) + '...');
  
  let response;
  try {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
    
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${forgeApiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
  } catch (fetchError) {
    console.error('[LLM] ❌ Fetch error details:');
    console.error('[LLM]   - Error type:', fetchError instanceof Error ? fetchError.constructor.name : typeof fetchError);
    console.error('[LLM]   - Error message:', fetchError instanceof Error ? fetchError.message : String(fetchError));
    
    if (fetchError instanceof Error) {
      if ('code' in fetchError) {
        console.error('[LLM]   - Error code:', (fetchError as any).code);
      }
      if (fetchError.cause) {
        console.error('[LLM]   - Error cause:', fetchError.cause);
      }
      if (fetchError.stack) {
        console.error('[LLM]   - Stack trace:', fetchError.stack.substring(0, 500));
      }
    }
    
    // Provide helpful error message
    const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
    let helpfulMessage = `Network error calling LLM API: ${errorMsg}`;
    
    if (errorMsg.includes('fetch failed') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ENOTFOUND')) {
      helpfulMessage += `\n\nPossible causes:
1. Network connectivity issue - check your internet connection
2. xAI API might require VPN in your region
3. Firewall blocking the connection
4. DNS resolution failed for ${apiUrl}
5. API endpoint might be temporarily unavailable

Try:
- Check your internet connection
- Try using a VPN if xAI requires it
- Verify the API URL is correct: ${apiUrl}
- Check if the API key is valid`;
    }
    
    throw new Error(helpfulMessage);
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `LLM invoke failed: ${response.status} ${response.statusText}`;
    
    // Parse error details for better error messages
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error) {
        const error = errorJson.error;
        if (error.code === 'unsupported_country_region_territory') {
          errorMessage = `OpenAI API 在您的地區不可用。請使用 VPN/代理，或切換到其他 AI 服務。\n錯誤詳情: ${error.message}`;
        } else if (error.message) {
          errorMessage = `AI 服務錯誤: ${error.message}`;
        }
      }
    } catch {
      // If parsing fails, use the raw error text
      errorMessage += ` – ${errorText}`;
    }
    
    throw new Error(errorMessage);
  }

  return (await response.json()) as InvokeResult;
}
