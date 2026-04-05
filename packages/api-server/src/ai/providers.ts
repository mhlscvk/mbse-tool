import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI, type Content, type Part } from '@google/generative-ai';
import { AI_TOOLS } from './tools.js';

// ─── Common types ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool_result';
  content: string;
  toolCallId?: string;
  toolName?: string;
  /** Present on assistant messages that included tool calls */
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export type StreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_calls'; calls: ToolCall[] }
  | { type: 'done'; stopReason: string; usage?: TokenUsage };

export interface AiProvider {
  streamChat(system: string, messages: ChatMessage[]): AsyncGenerator<StreamEvent>;
}

const VALID_TOOL_NAMES = new Set(AI_TOOLS.map(t => t.name));

// ─── Tool schema conversion (cached — schemas are static) ───────────────────

const ANTHROPIC_TOOLS: Anthropic.Messages.Tool[] = AI_TOOLS.map(t => ({
  name: t.name,
  description: t.description,
  input_schema: { type: 'object' as const, properties: t.parameters.properties, required: t.parameters.required },
}));

const OPENAI_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = AI_TOOLS.map(t => ({
  type: 'function' as const,
  function: { name: t.name, description: t.description, parameters: t.parameters },
}));

const GEMINI_TOOLS = [{
  functionDeclarations: AI_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  })),
}];

// ─── Anthropic ────────────────────────────────────────────────────────────────

class AnthropicProvider implements AiProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 2 });
    this.model = model || 'claude-sonnet-4-20250514';
  }

  async *streamChat(system: string, messages: ChatMessage[]): AsyncGenerator<StreamEvent> {
    // Convert to Anthropic format
    const anthropicMsgs: Anthropic.Messages.MessageParam[] = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role === 'user') {
        anthropicMsgs.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant') {
        // If this assistant message had tool calls, include tool_use blocks
        if (m.toolCalls && m.toolCalls.length > 0) {
          const content: Anthropic.Messages.ContentBlockParam[] = [];
          if (m.content) content.push({ type: 'text', text: m.content });
          for (const tc of m.toolCalls) {
            content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args });
          }
          anthropicMsgs.push({ role: 'assistant', content });
        } else {
          anthropicMsgs.push({ role: 'assistant', content: m.content });
        }
      } else if (m.role === 'tool_result') {
        // Group consecutive tool_results into a single user message
        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
        let j = i;
        while (j < messages.length && messages[j].role === 'tool_result') {
          toolResults.push({ type: 'tool_result', tool_use_id: messages[j].toolCallId!, content: messages[j].content });
          j++;
        }
        anthropicMsgs.push({ role: 'user', content: toolResults });
        i = j - 1; // advance past grouped tool_results
      }
    }

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 4096,
      system,
      tools: ANTHROPIC_TOOLS,
      messages: anthropicMsgs,
    });

    let textBuffer = '';
    const toolCalls: ToolCall[] = [];
    let currentToolId: string | null = null;
    let currentToolName: string | null = null;
    let toolJson = '';

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'text') {
          // text block starting
        } else if (event.content_block.type === 'tool_use') {
          currentToolId = event.content_block.id;
          currentToolName = event.content_block.name;
          toolJson = '';
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          textBuffer += event.delta.text;
          yield { type: 'text_delta', text: event.delta.text };
        } else if (event.delta.type === 'input_json_delta') {
          toolJson += event.delta.partial_json;
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolId && currentToolName) {
          try {
            const args = JSON.parse(toolJson || '{}');
            if (VALID_TOOL_NAMES.has(currentToolName)) {
              toolCalls.push({ id: currentToolId, name: currentToolName, args });
            } else {
              console.warn(`[AI] Anthropic returned unknown tool name: ${currentToolName}`);
            }
          } catch (e) {
            console.warn(`[AI] Malformed tool call JSON from Anthropic: ${(e as Error).message}`);
          }
          currentToolId = null;
          currentToolName = null;
          toolJson = '';
        }
      } else if (event.type === 'message_stop') {
        // done
      }
    }

    const finalMessage = await stream.finalMessage();
    const stopReason = finalMessage.stop_reason ?? 'end_turn';
    const usage: TokenUsage | undefined = finalMessage.usage
      ? { inputTokens: finalMessage.usage.input_tokens, outputTokens: finalMessage.usage.output_tokens }
      : undefined;

    if (toolCalls.length > 0) {
      yield { type: 'tool_calls', calls: toolCalls };
    }
    yield { type: 'done', stopReason, usage };
  }
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

class OpenAIProvider implements AiProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({ apiKey, maxRetries: 2 });
    this.model = model || 'gpt-4o';
  }

  async *streamChat(system: string, messages: ChatMessage[]): AsyncGenerator<StreamEvent> {
    const openaiMsgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
    ];
    for (const m of messages) {
      if (m.role === 'user') {
        openaiMsgs.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant') {
        if (m.toolCalls && m.toolCalls.length > 0) {
          // Include tool_calls so subsequent tool messages match
          openaiMsgs.push({
            role: 'assistant',
            content: m.content || null,
            tool_calls: m.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: JSON.stringify(tc.args) },
            })),
          });
        } else {
          openaiMsgs.push({ role: 'assistant', content: m.content });
        }
      } else if (m.role === 'tool_result') {
        openaiMsgs.push({ role: 'tool', tool_call_id: m.toolCallId!, content: m.content });
      }
    }

    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 4096,
      tools: OPENAI_TOOLS,
      messages: openaiMsgs,
      stream: true,
      stream_options: { include_usage: true },
    });

    const toolCallMap = new Map<number, { id: string; name: string; argsJson: string }>();
    let usage: TokenUsage | undefined;

    for await (const chunk of stream) {
      // Usage comes in the final chunk with null choices
      if (chunk.usage) {
        usage = { inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens };
      }
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        yield { type: 'text_delta', text: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCallMap.has(idx)) {
            toolCallMap.set(idx, { id: tc.id ?? `call_${idx}`, name: tc.function?.name ?? '', argsJson: '' });
          }
          const entry = toolCallMap.get(idx)!;
          if (tc.function?.name) entry.name = tc.function.name;
          if (tc.function?.arguments) entry.argsJson += tc.function.arguments;
        }
      }

      const finishReason = chunk.choices?.[0]?.finish_reason;
      if (finishReason) {
        if (toolCallMap.size > 0) {
          const calls: ToolCall[] = [];
          for (const [, entry] of toolCallMap) {
            try {
              if (!VALID_TOOL_NAMES.has(entry.name)) {
                console.warn(`[AI] OpenAI returned unknown tool name: ${entry.name}`);
                continue;
              }
              calls.push({ id: entry.id, name: entry.name, args: JSON.parse(entry.argsJson || '{}') });
            } catch (e) {
              console.warn(`[AI] Malformed tool call JSON from OpenAI: ${(e as Error).message}`);
            }
          }
          if (calls.length > 0) yield { type: 'tool_calls', calls };
        }
        yield { type: 'done', stopReason: finishReason, usage };
      }
    }
  }
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

class GeminiProvider implements AiProvider {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model || 'gemini-2.0-flash';
  }

  async *streamChat(system: string, messages: ChatMessage[]): AsyncGenerator<StreamEvent> {
    const contents: Content[] = [];
    for (const m of messages) {
      if (m.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: m.content }] });
      } else if (m.role === 'assistant') {
        if (m.toolCalls && m.toolCalls.length > 0) {
          const parts: Part[] = [];
          if (m.content) parts.push({ text: m.content });
          for (const tc of m.toolCalls) {
            parts.push({ functionCall: { name: tc.name, args: tc.args } } as Part);
          }
          contents.push({ role: 'model', parts });
        } else {
          contents.push({ role: 'model', parts: [{ text: m.content }] });
        }
      } else if (m.role === 'tool_result') {
        contents.push({
          role: 'function' as Content['role'],
          parts: [{ functionResponse: { name: m.toolName!, response: { result: m.content } } } as Part],
        });
      }
    }

    const genModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: system,
      tools: GEMINI_TOOLS as never,
    });

    const result = await genModel.generateContentStream({ contents });

    const toolCalls: ToolCall[] = [];
    let callIdx = 0;

    for await (const chunk of result.stream) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;

      for (const part of parts) {
        if (part.text) {
          yield { type: 'text_delta', text: part.text };
        }
        if (part.functionCall) {
          if (VALID_TOOL_NAMES.has(part.functionCall.name)) {
            toolCalls.push({
              id: `gemini_call_${callIdx++}`,
              name: part.functionCall.name,
              args: (part.functionCall.args ?? {}) as Record<string, unknown>,
            });
          } else {
            console.warn(`[AI] Gemini returned unknown tool name: ${part.functionCall.name}`);
          }
        }
      }
    }

    // Gemini usage metadata
    let usage: TokenUsage | undefined;
    try {
      const resp = await result.response;
      const meta = resp.usageMetadata;
      if (meta) {
        usage = { inputTokens: meta.promptTokenCount ?? 0, outputTokens: meta.candidatesTokenCount ?? 0 };
      }
    } catch { /* usage not available */ }

    if (toolCalls.length > 0) {
      yield { type: 'tool_calls', calls: toolCalls };
    }
    yield { type: 'done', stopReason: toolCalls.length > 0 ? 'tool_use' : 'end', usage };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createProvider(provider: string, apiKey: string, model?: string): AiProvider {
  switch (provider) {
    case 'anthropic': return new AnthropicProvider(apiKey, model);
    case 'openai':    return new OpenAIProvider(apiKey, model);
    case 'gemini':    return new GeminiProvider(apiKey, model);
    default: throw new Error(`Unsupported provider: ${provider}`);
  }
}
