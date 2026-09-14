import { GoogleGenAI } from '@google/genai';

/**
 * Prioritized Model Hierarchy for J.A.R.V.I.S.
 * 
 * 1. Primary Higher-Tier Model: gemini-3.1-pro-preview (Deep reasoning, complex coding, and structured intelligence)
 * 2. High-Performance Tier: gemini-3.8-flash (General high-speed reasoning and multimodal analysis)
 * 3. High-Throughput Lite Tier: gemini-3.1-flash-lite (Cost-effective, rapid execution)
 * 4. Resilient Flash Tier: gemini-flash-latest (Modern stable fallback)
 * 5. Final Safeguard: gemini-1.5-flash (Guaranteed baseline service resilience, ensuring uninterrupted operation)
 */
export const DEFAULT_MODEL_TIERS: readonly string[] = [
  'gemini-3.1-pro-preview', // Tier 1: Primary Higher-Tier Model
  'gemini-3.8-flash',        // Tier 2: High Performance Alternative Tier
  'gemini-3.1-flash-lite',   // Tier 3: High-throughput Flash Lite Tier
  'gemini-flash-latest',     // Tier 4: Resilient Flash Tier
  'gemini-1.5-flash',        // Tier 5: Final Safeguard (Ensures uninterrupted service)
];

/**
 * Prioritized Audio / Vocalization Tiers
 */
export const TTS_MODEL_TIERS: readonly string[] = [
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts',
  'gemini-flash-latest'
];

export interface FailoverRequestOptions {
  /**
   * Optional custom primary model. If provided and not in the tier list, it will be tried first.
   */
  model?: string;
  /**
   * Prompts, message history, or multi-part content
   */
  contents: any;
  /**
   * Configuration options passed to generateContent (systemInstruction, tools, responseMimeType, etc.)
   */
  config?: any;
  /**
   * Explicit override for prioritized tiers
   */
  prioritizedTiers?: readonly string[] | string[];
  /**
   * Gemini API Key override (falls back to process.env.API_KEY)
   */
  apiKey?: string;
  /**
   * Diagnostic logger callback
   */
  onLog?: (message: string) => void;
  /**
   * Event hook when a model tier fails and fails over to an alternative
   */
  onTierChange?: (fromModel: string, toModel: string, reason: string, tierIndex: number) => void;
}

export interface ModelAttempt {
  model: string;
  success: boolean;
  error?: string;
  statusCode?: number;
  durationMs: number;
}

export interface FailoverResponse {
  response: any;
  text: string;
  modelUsed: string;
  tierIndex: number;
  totalTiers: number;
  attempts: ModelAttempt[];
  isFallback: boolean;
}

// Global telemetry for model failover statistics
export interface FailoverTelemetry {
  totalRequests: number;
  primarySuccessCount: number;
  fallbackCount: number;
  finalSafeguardCount: number;
  activeModel: string;
  lastFailoverTime?: Date;
  lastFailoverDetails?: string;
  recentAttempts: ModelAttempt[];
}

const telemetry: FailoverTelemetry = {
  totalRequests: 0,
  primarySuccessCount: 0,
  fallbackCount: 0,
  finalSafeguardCount: 0,
  activeModel: DEFAULT_MODEL_TIERS[0],
  recentAttempts: [],
};

export function getFailoverTelemetry(): FailoverTelemetry {
  return { ...telemetry };
}

/**
 * Executes a Gemini API request with resilient tiered failover.
 * 
 * Attempts to use our primary higher-tier model first.
 * If it encounters rate limits (429, RESOURCE_EXHAUSTED), temporary overload (503/500),
 * or model-specific errors, it cycles through a prioritized list of alternative tiers,
 * before falling back to Gemini 1.5 Flash as a final safeguard to guarantee uninterrupted service.
 */
export async function executeTieredGeminiRequest(
  options: FailoverRequestOptions
): Promise<FailoverResponse> {
  const apiKey = options.apiKey || process.env.API_KEY || '';
  const ai = new GoogleGenAI({ apiKey });

  // Build ordered list of models: custom primary -> prioritized list
  const baseTiers = options.prioritizedTiers && options.prioritizedTiers.length > 0
    ? Array.from(options.prioritizedTiers)
    : Array.from(DEFAULT_MODEL_TIERS);

  const candidateModels: string[] = [];
  if (options.model && !candidateModels.includes(options.model)) {
    candidateModels.push(options.model);
  }
  for (const m of baseTiers) {
    if (!candidateModels.includes(m)) {
      candidateModels.push(m);
    }
  }

  // Ensure Gemini 1.5 Flash is always the terminal safeguard if not already in list
  if (!candidateModels.includes('gemini-1.5-flash')) {
    candidateModels.push('gemini-1.5-flash');
  }

  const attempts: ModelAttempt[] = [];
  let lastError: any = null;

  telemetry.totalRequests++;

  for (let index = 0; index < candidateModels.length; index++) {
    const currentModel = candidateModels[index];
    const isPrimary = index === 0;
    const isFinalSafeguard = currentModel === 'gemini-1.5-flash' || index === candidateModels.length - 1;
    const startTime = performance.now();

    try {
      if (index > 0 && options.onLog) {
        options.onLog(
          `[FAILOVER TIER ${index + 1}/${candidateModels.length}] Activating alternative model: ${currentModel}...`
        );
      }

      // Execute request with current tier
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: options.contents,
        config: options.config,
      });

      const durationMs = Math.round(performance.now() - startTime);
      attempts.push({
        model: currentModel,
        success: true,
        durationMs,
      });

      // Update telemetry
      telemetry.activeModel = currentModel;
      if (isPrimary) {
        telemetry.primarySuccessCount++;
      } else {
        telemetry.fallbackCount++;
        if (isFinalSafeguard) {
          telemetry.finalSafeguardCount++;
        }
      }
      telemetry.recentAttempts = [...attempts, ...telemetry.recentAttempts].slice(0, 20);

      const text = response.text || '';

      if (index > 0 && options.onLog) {
        options.onLog(
          `✓ Service maintained seamlessly via fallback tier: ${currentModel} (${durationMs}ms)`
        );
      }

      return {
        response,
        text,
        modelUsed: currentModel,
        tierIndex: index,
        totalTiers: candidateModels.length,
        attempts,
        isFallback: index > 0,
      };
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      const errorMessage = err?.message || String(err);
      lastError = err;

      attempts.push({
        model: currentModel,
        success: false,
        error: errorMessage,
        statusCode: err?.status || err?.statusCode,
        durationMs,
      });

      const isRateLimit =
        errorMessage.includes('429') ||
        errorMessage.includes('RESOURCE_EXHAUSTED') ||
        errorMessage.toLowerCase().includes('quota') ||
        errorMessage.toLowerCase().includes('rate limit');

      const isServerOverload =
        errorMessage.includes('503') ||
        errorMessage.includes('500') ||
        errorMessage.toLowerCase().includes('overloaded') ||
        errorMessage.toLowerCase().includes('temporarily unavailable');

      const reasonStr = isRateLimit
        ? 'Rate Limit (429/Quota Exhausted)'
        : isServerOverload
        ? 'Service Overload (503/500)'
        : `Execution Error (${errorMessage.slice(0, 80)})`;

      const nextModel = candidateModels[index + 1];

      if (nextModel) {
        telemetry.lastFailoverTime = new Date();
        telemetry.lastFailoverDetails = `${currentModel} -> ${nextModel} due to ${reasonStr}`;

        if (options.onTierChange) {
          options.onTierChange(currentModel, nextModel, reasonStr, index + 1);
        }

        if (options.onLog) {
          options.onLog(
            `⚠ Warning: Model '${currentModel}' encountered ${reasonStr}. Automatically cycling to Tier ${index + 2}: '${nextModel}' to prevent service disruption.`
          );
        }
      }
    }
  }

  // If all candidate tiers failed
  const errorDetails = attempts.map(a => `${a.model}: ${a.error}`).join(' | ');
  const failureMessage = `All ${candidateModels.length} model tiers exhausted without recovery. Breakdown: ${errorDetails}`;
  
  if (options.onLog) {
    options.onLog(`[CRITICAL] ${failureMessage}`);
  }

  throw new Error(lastError?.message ? `${failureMessage} (${lastError.message})` : failureMessage);
}
