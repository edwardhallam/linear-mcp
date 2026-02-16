/**
 * Format errors into LLM-friendly messages with recovery hints.
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;

    // Linear SDK specific errors
    if (msg.includes("authentication") || msg.includes("Unauthorized") || msg.includes("401")) {
      return "Error: Authentication failed. Verify your LINEAR_API_KEY is valid and not expired. " +
        "Generate a new key at: Linear Settings > Account > API > Personal API Keys.";
    }
    if (msg.includes("not found") || msg.includes("404")) {
      return `Error: Resource not found. Verify the identifier format (e.g., "GEN-123" for issues, or a valid UUID for IDs). ${msg}`;
    }
    if (msg.includes("rate limit") || msg.includes("429")) {
      return "Error: Rate limit exceeded. Linear allows 5000 requests/hour. Wait a moment and retry.";
    }
    if (msg.includes("forbidden") || msg.includes("403")) {
      return "Error: Permission denied. Your API key may not have access to this resource.";
    }
    if (msg.includes("validation") || msg.includes("invalid")) {
      return `Error: Invalid input. ${msg}`;
    }

    return `Error: ${msg}`;
  }

  return `Error: An unexpected error occurred: ${String(error)}`;
}

/**
 * Wrap a handler with consistent error formatting.
 */
export function toolResult(text: string, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    ...(isError && { isError: true }),
  };
}
