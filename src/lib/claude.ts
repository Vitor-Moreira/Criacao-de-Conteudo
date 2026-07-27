import Anthropic from "@anthropic-ai/sdk";

const globalForClaude = globalThis as unknown as {
  anthropic: Anthropic | undefined;
};

export const anthropic =
  globalForClaude.anthropic ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

if (process.env.NODE_ENV !== "production") {
  globalForClaude.anthropic = anthropic;
}

export const CLAUDE_MODEL = "claude-sonnet-4-6";

// Preços aproximados (centavos de USD por milhão de tokens), usados apenas para
// estimar o custo registrado em UsageLog. Ajustar se a tabela de preços mudar.
export const CLAUDE_INPUT_CENTS_PER_MTOK = 300;
export const CLAUDE_OUTPUT_CENTS_PER_MTOK = 1500;
