import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/config/env";

/**
 * Provider boundary for the AI Platform (spec §4: "Every AI request passes
 * through the AI Gateway before reaching external providers").
 *
 * This module is the ONLY place the Anthropic SDK is constructed. It is
 * `server-only` — the API key must never reach client code (Security Rules).
 * The rest of the platform talks to the gateway service, keeping the provider
 * swappable (spec §3: Provider Independence).
 */

/** Thrown when an AI capability is used without a configured provider key. */
export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "AI is not configured. Set ANTHROPIC_API_KEY to enable AI features."
    );
    this.name = "AiNotConfiguredError";
  }
}

/** Model selection — resolved from validated env, with safe defaults. */
export const AI_MODELS = {
  /** Reasoning / assistant / vision-OCR / report generation. */
  default: env.AI_DEFAULT_MODEL,
  /** High-volume, latency-sensitive extraction (search parsing). */
  fast: env.AI_FAST_MODEL,
} as const;

let cachedClient: Anthropic | null = null;

/** Returns true when a provider key is configured. */
export function isAiConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

/**
 * Returns the singleton Anthropic client.
 * @throws {AiNotConfiguredError} when no API key is configured.
 */
export function getAnthropicClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AiNotConfiguredError();
  }
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return cachedClient;
}

/** Test-only: reset the cached client (used by unit tests). */
export function __resetAnthropicClientForTests(): void {
  cachedClient = null;
}
