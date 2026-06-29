import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  MessageParam,
  TextBlockParam,
  Tool,
  ToolResultBlockParam,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";
import type { ParsedMessage } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// AI structured-output schemas use Zod v4 (required by the SDK's
// zodOutputFormat helper). The rest of the app uses classic `zod` for form
// validation; the two APIs coexist within the same zod 3.25+ install.
import type { z } from "zod/v4";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import {
  AI_MODELS,
  AiNotConfiguredError,
  getAnthropicClient,
  isAiConfigured,
} from "@/features/ai/client/anthropic-client";
import { AiInteractionService } from "@/features/ai/services/ai-interaction.service";
import type {
  AiCapability,
  AiContext,
  AiDocumentInput,
  AiError,
  AiImageInput,
  AiResult,
  AiUsage,
} from "@/features/ai/types/ai.types";

/**
 * The AI Gateway (spec §4) — the single orchestration point between Syncrate
 * business services and the LLM provider. Every call is timed, error-mapped to
 * a typed {@link AiError}, and recorded to the immutable AI audit trail
 * (spec §20). Capability services never call the SDK directly; they go through
 * here so governance, auditing, and provider-independence hold everywhere.
 */

const DEFAULT_MAX_TOKENS = 4096;

interface BaseCallOptions {
  readonly capability: AiCapability;
  readonly context: AiContext;
  /** Frozen system prompt — placed first for prompt-cache stability. */
  readonly system: string;
  readonly model?: string;
  readonly maxTokens?: number;
}

interface StructuredTextOptions<S extends z.ZodType> extends BaseCallOptions {
  readonly prompt: string;
  readonly schema: S;
  /** Cache the (large, stable) system prompt across requests. */
  readonly cacheSystem?: boolean;
}

interface StructuredVisionOptions<S extends z.ZodType>
  extends BaseCallOptions {
  readonly instruction: string;
  readonly schema: S;
  readonly image?: AiImageInput;
  readonly document?: AiDocumentInput;
}

export interface AiStructuredResult<T> {
  readonly data: T;
  readonly usage: AiUsage;
  readonly model: string;
}

/** A tool the model may invoke during an assistant turn. */
export interface AiTool {
  readonly definition: Tool;
  /**
   * Executes a read-only tool and returns a result fed back to the model.
   * Omit for "propose" tools — calling them halts the loop instead (the input
   * is surfaced as a proposed action requiring human approval, spec §6/§19).
   */
  readonly execute?: (input: unknown) => Promise<unknown>;
}

/** A mutating intent the model proposed; requires explicit user approval. */
export interface AiProposedAction {
  readonly tool: string;
  readonly input: Record<string, unknown>;
}

export interface AiConversationResult {
  readonly text: string;
  readonly usage: AiUsage;
  readonly model: string;
  /** Read-only tools the assistant invoked this turn (for transparency). */
  readonly toolCalls: ReadonlyArray<{ name: string; input: unknown }>;
  /** Set when the assistant proposed a mutating action awaiting approval. */
  readonly proposedAction: AiProposedAction | null;
}

interface ConversationOptions extends BaseCallOptions {
  readonly messages: MessageParam[];
  readonly tools?: ReadonlyArray<AiTool>;
  readonly maxIterations?: number;
}

const MAX_TOOL_ITERATIONS = 6;

function truncate(text: string, max = 500): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Maps any thrown provider error to a typed {@link AiError}. */
function mapError(err: unknown): AiError {
  if (err instanceof AiNotConfiguredError) {
    return { code: "not_configured", message: err.message };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return {
      code: "rate_limited",
      message: "The AI service is busy. Please try again in a moment.",
    };
  }
  if (err instanceof Anthropic.APIError) {
    return {
      code: "provider_error",
      message: "The AI service returned an error. Please try again.",
    };
  }
  return {
    code: "unknown",
    message: "An unexpected error occurred while contacting the AI service.",
  };
}

export class AiGatewayService {
  private readonly interactions: AiInteractionService;

  constructor(supabase: AppSupabaseClient) {
    this.interactions = new AiInteractionService(supabase);
  }

  /** True when a provider key is configured. */
  get isConfigured(): boolean {
    return isAiConfigured();
  }

  /**
   * Generate a schema-validated structured object from a text prompt.
   * Used by forecasting, recommendations, insights, search, reports.
   */
  async generateStructured<S extends z.ZodType>(
    options: StructuredTextOptions<S>
  ): Promise<AiResult<AiStructuredResult<z.infer<S>>>> {
    const model = options.model ?? AI_MODELS.default;
    const startedAt = Date.now();

    try {
      const client = getAnthropicClient();
      const system: TextBlockParam[] = [
        {
          type: "text",
          text: options.system,
          ...(options.cacheSystem
            ? { cache_control: { type: "ephemeral" as const } }
            : {}),
        },
      ];

      const message = await client.messages.parse({
        model,
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        system,
        thinking: { type: "adaptive" },
        messages: [{ role: "user", content: options.prompt }],
        output_config: { format: zodOutputFormat(options.schema) },
      });

      return await this.finish(options, model, startedAt, message);
    } catch (err) {
      return this.failure(options, model, startedAt, err);
    }
  }

  /**
   * Extract a schema-validated structured object from an image or PDF
   * (vision). Powers AI OCR (spec §7) for bills, invoices, receipts, labels.
   */
  async extractFromDocument<S extends z.ZodType>(
    options: StructuredVisionOptions<S>
  ): Promise<AiResult<AiStructuredResult<z.infer<S>>>> {
    const model = options.model ?? AI_MODELS.default;
    const startedAt = Date.now();

    if (!options.image && !options.document) {
      return {
        success: false,
        error: { code: "validation", message: "No image or document provided." },
      };
    }

    try {
      const client = getAnthropicClient();
      const content: ContentBlockParam[] = [];

      if (options.document) {
        content.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: options.document.pdfBase64,
          },
        });
      }
      if (options.image) {
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: options.image.mediaType,
            data: options.image.base64,
          },
        });
      }
      content.push({ type: "text", text: options.instruction });

      const message = await client.messages.parse({
        model,
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: options.system,
        thinking: { type: "adaptive" },
        messages: [{ role: "user", content }],
        output_config: { format: zodOutputFormat(options.schema) },
      });

      return await this.finish(options, model, startedAt, message);
    } catch (err) {
      return this.failure(options, model, startedAt, err);
    }
  }

  /**
   * Runs an assistant turn with a manual tool-use loop (spec §6/§17). Read
   * tools execute server-side and feed results back to the model; "propose"
   * tools (no `execute`) halt the loop and surface their input as a proposed
   * action requiring human approval — the AI never mutates business data.
   */
  async runConversation(
    options: ConversationOptions
  ): Promise<AiResult<AiConversationResult>> {
    const model = options.model ?? AI_MODELS.default;
    const startedAt = Date.now();
    const toolMap = new Map((options.tools ?? []).map((t) => [t.definition.name, t]));
    const toolDefs = (options.tools ?? []).map((t) => t.definition);
    const maxIterations = options.maxIterations ?? MAX_TOOL_ITERATIONS;

    let inputTokens = 0;
    let outputTokens = 0;
    const messages: MessageParam[] = [...options.messages];
    const toolCalls: Array<{ name: string; input: unknown }> = [];

    try {
      const client = getAnthropicClient();

      for (let i = 0; i < maxIterations; i++) {
        const response = await client.messages.create({
          model,
          max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
          system: options.system,
          thinking: { type: "adaptive" },
          messages,
          ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
        });

        inputTokens += response.usage.input_tokens;
        outputTokens += response.usage.output_tokens;

        if (response.stop_reason === "refusal") {
          const usage: AiUsage = {
            inputTokens,
            outputTokens,
            executionMs: Date.now() - startedAt,
          };
          await this.audit(options, model, usage, "refused", "Model declined request");
          return {
            success: false,
            error: {
              code: "refused",
              message: "The AI declined to process this request.",
            },
          };
        }

        const textOut = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();

        const toolUses = response.content.filter(
          (b): b is ToolUseBlock => b.type === "tool_use"
        );

        // Check for a "propose" tool (no executor) → halt for human approval.
        const proposeBlock = toolUses.find((tu) => !toolMap.get(tu.name)?.execute);
        if (proposeBlock) {
          const usage: AiUsage = {
            inputTokens,
            outputTokens,
            executionMs: Date.now() - startedAt,
          };
          const proposedAction: AiProposedAction = {
            tool: proposeBlock.name,
            input: (proposeBlock.input as Record<string, unknown>) ?? {},
          };
          await this.audit(options, model, usage, "success", null, {
            proposedAction,
          });
          return {
            success: true,
            data: { text: textOut, usage, model, toolCalls, proposedAction },
          };
        }

        if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
          // Normal completion — no more tools to run.
          const usage: AiUsage = {
            inputTokens,
            outputTokens,
            executionMs: Date.now() - startedAt,
          };
          await this.audit(options, model, usage, "success", null, {
            text: textOut,
          });
          return {
            success: true,
            data: { text: textOut, usage, model, toolCalls, proposedAction: null },
          };
        }

        // Execute read-only tools and feed results back.
        messages.push({ role: "assistant", content: response.content });
        const results: ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          toolCalls.push({ name: tu.name, input: tu.input });
          const execute = toolMap.get(tu.name)?.execute;
          if (!execute) {
            // Unknown / non-executable tool — report back so the model recovers.
            results.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: `Unknown tool: ${tu.name}`,
              is_error: true,
            });
            continue;
          }
          try {
            const out = await execute(tu.input);
            results.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: JSON.stringify(out ?? null),
            });
          } catch {
            results.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: "Tool execution failed.",
              is_error: true,
            });
          }
        }
        messages.push({ role: "user", content: results });
      }

      // Exhausted iterations without a clean end.
      const usage: AiUsage = {
        inputTokens,
        outputTokens,
        executionMs: Date.now() - startedAt,
      };
      await this.audit(options, model, usage, "failed", "Max tool iterations reached");
      return {
        success: false,
        error: {
          code: "provider_error",
          message: "The assistant could not complete the request. Please rephrase.",
        },
      };
    } catch (err) {
      return this.failure(options, model, startedAt, err);
    }
  }

  // ── shared completion / failure handling ────────────────────────

  private async finish<S extends z.ZodType>(
    options: BaseCallOptions,
    model: string,
    startedAt: number,
    message: ParsedMessage<z.infer<S>>
  ): Promise<AiResult<AiStructuredResult<z.infer<S>>>> {
    const usage: AiUsage = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      executionMs: Date.now() - startedAt,
    };

    if (message.stop_reason === "refusal") {
      await this.audit(options, model, usage, "refused", "Model declined request");
      return {
        success: false,
        error: {
          code: "refused",
          message: "The AI declined to process this request.",
        },
      };
    }

    const parsed = message.parsed_output;
    if (parsed === null || parsed === undefined) {
      await this.audit(options, model, usage, "failed", "Empty/unparseable output");
      return {
        success: false,
        error: {
          code: "parse_error",
          message: "The AI response could not be parsed. Please try again.",
        },
      };
    }

    await this.audit(options, model, usage, "success", null, parsed);
    return { success: true, data: { data: parsed, usage, model } };
  }

  private async failure(
    options: BaseCallOptions,
    model: string,
    startedAt: number,
    err: unknown
  ): Promise<AiResult<never>> {
    const error = mapError(err);
    await this.audit(
      options,
      model,
      { inputTokens: 0, outputTokens: 0, executionMs: Date.now() - startedAt },
      "failed",
      error.message
    );
    return { success: false, error };
  }

  private async audit(
    options: BaseCallOptions,
    model: string,
    usage: AiUsage,
    status: "success" | "failed" | "refused",
    errorMessage: string | null,
    parsed?: unknown
  ): Promise<void> {
    const confidence =
      parsed &&
      typeof parsed === "object" &&
      "confidence" in parsed &&
      typeof (parsed as { confidence: unknown }).confidence === "number"
        ? (parsed as { confidence: number }).confidence
        : null;

    await this.interactions.record({
      organizationId: options.context.organizationId,
      actorUserId: options.context.userId,
      capability: options.capability,
      model,
      promptSummary: truncate(options.system, 200),
      responseSummary:
        parsed !== undefined ? truncate(JSON.stringify(parsed)) : null,
      confidence,
      usage,
      status,
      errorMessage,
      metadata: {
        ...(options.context.branchId
          ? { branchId: options.context.branchId }
          : {}),
        ...(options.context.metadata ?? {}),
      },
    });
  }
}
