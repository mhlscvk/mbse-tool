import { Router, type IRouter } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../middleware/auth.js';

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are an expert SysML v2 modeling assistant embedded in a SysML v2 IDE.
You help users write, understand, and fix SysML v2 code.

Key SysML v2 syntax:
  package MyPackage { ... }
  part def Vehicle { part engine : Engine; attribute mass : Real = 1500; }
  attribute def Mass { attribute value : Real; }
  port def FuelPort { in attribute flow : Fuel; }
  connect engine::fuelIn to fuelSupply::fuelOut;
  flow of Fuel from tank::out to engine::in;
  part vehicle : Vehicle specializes Base;   // generalization

Rules:
- Definitions use 'def' keyword (part def, attribute def, port def…)
- Usages are declared inside definitions without 'def'
- Multiplicity: [1], [0..*], [1..*]
- Visibility: public (+), private (-), protected (#)
- Comments: // line, /* block */

When suggesting changes, call propose_edit for each code change with exact 1-based line/column positions.
Explain briefly what you are doing before each edit.
If the file is empty, generate a reasonable SysML v2 starting template.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'propose_edit',
    description: 'Propose a text replacement in the SysML file. Use exact 1-based line/column numbers from the file shown in the context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        description: { type: 'string', description: 'Short description of what this edit does' },
        startLine:   { type: 'number', description: '1-based line where edit starts' },
        startColumn: { type: 'number', description: '1-based column where edit starts' },
        endLine:     { type: 'number', description: '1-based line where edit ends (inclusive)' },
        endColumn:   { type: 'number', description: '1-based column where edit ends (exclusive)' },
        newText:     { type: 'string', description: 'Replacement text (empty string to delete)' },
      },
      required: ['description', 'startLine', 'startColumn', 'endLine', 'endColumn', 'newText'],
    },
  },
];

router.post('/assist', requireAuth, async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: 'AI assistant not configured — add ANTHROPIC_API_KEY to .env' });
    return;
  }

  const { content, instruction, diagnostics = [] } = req.body as {
    content: string;
    instruction: string;
    diagnostics?: Array<{ severity: string; message: string; line: number; column: number }>;
  };

  if (!instruction?.trim()) {
    res.status(400).json({ error: 'instruction is required' });
    return;
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx/proxy buffering
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    // Force flush if available (compression middleware adds this)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (res as any).flush === 'function') (res as any).flush();
  };

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build context message with line numbers for precise edits
    const numberedLines = content.split('\n')
      .map((line, i) => `${String(i + 1).padStart(4, ' ')} | ${line}`)
      .join('\n');

    let userMsg = `Current SysML v2 file (${content.split('\n').length} lines):\n\`\`\`\n${numberedLines}\n\`\`\``;

    if (diagnostics.length > 0) {
      userMsg += '\n\nCurrent errors/warnings:\n' +
        diagnostics.map(d => `  [${d.severity.toUpperCase()}] Line ${d.line}, Col ${d.column}: ${d.message}`).join('\n');
    }

    userMsg += `\n\nUser request: ${instruction}`;

    // Accumulate tool-use block as it streams
    let toolUseId: string | null = null;
    let toolName: string | null = null;
    let toolJson = '';

    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: [{ role: 'user', content: userMsg }],
    });

    // Stream text deltas in real-time
    stream.on('text', (text) => {
      send('text', { chunk: text });
    });

    // Track tool use blocks via raw stream events
    stream.on('streamEvent', (event) => {
      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        toolUseId  = event.content_block.id;
        toolName   = event.content_block.name;
        toolJson   = '';
      } else if (event.type === 'content_block_delta' && event.delta.type === 'input_json_delta') {
        toolJson += event.delta.partial_json;
      } else if (event.type === 'content_block_stop' && toolUseId) {
        if (toolName === 'propose_edit') {
          try {
            const input = JSON.parse(toolJson);
            send('edit', input);
          } catch { /* malformed — skip */ }
        }
        toolUseId = null;
        toolName  = null;
        toolJson  = '';
      }
    });

    await stream.finalMessage();
    send('done', {});
  } catch (err) {
    // Surface Anthropic API errors clearly
    let msg = 'AI request failed';
    if (err instanceof Error) {
      msg = err.message;
      // Anthropic SDK wraps HTTP errors — extract status if present
      const e = err as Error & { status?: number; error?: { error?: { message?: string } } };
      if (e.status === 401) msg = 'Invalid Anthropic API key — check ANTHROPIC_API_KEY in .env';
      else if (e.status === 429) msg = 'Anthropic rate limit exceeded — try again shortly';
      else if (e.status === 500) msg = 'Anthropic server error — try again';
      else if (e.error?.error?.message) msg = e.error.error.message;
    }
    console.error('[AI]', msg, err);
    send('error', { message: msg });
  } finally {
    res.end();
  }
});

export default router;
