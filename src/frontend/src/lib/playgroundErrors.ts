const errorMappings: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /connection refused|econnrefused/i,
    message: 'The AI provider is not responding. Check your API key and provider settings.',
  },
  {
    pattern: /timeout|timed out/i,
    message:
      'The request timed out. The model may be overloaded — try again or switch to a different model.',
  },
  {
    pattern: /401|unauthorized|invalid.*key|invalid.*api/i,
    message: 'Authentication failed with the AI provider. Your API key may be invalid or expired.',
  },
  {
    pattern: /model.*not found|MODEL_NOT_FOUND/i,
    message: 'This model is no longer available. Select a different model.',
  },
];

export function mapPlaygroundError(message: string): string {
  for (const { pattern, message: friendly } of errorMappings) {
    if (pattern.test(message)) return friendly;
  }
  return message;
}

export function isRateLimitError(message: string): boolean {
  return /RATE_LIMITED|429|too many requests/i.test(message);
}
