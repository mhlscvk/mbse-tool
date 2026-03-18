import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Register reusable prompt templates for SysML editing workflows.
 */
export function registerPrompts(server: McpServer): void {

  // ─── review-sysml ───────────────────────────────────────────────────────────
  server.prompt(
    'review-sysml',
    'Review a SysML file for errors, warnings, and improvement suggestions',
    { fileContent: z.string().describe('The SysML file content to review') },
    ({ fileContent }) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Review the following SysML v2 file for:
1. Syntax errors and typos
2. Missing or incorrect types
3. Multiplicity issues
4. Naming convention violations (PascalCase for definitions, camelCase for usages)
5. Missing documentation on public definitions
6. Potential structural improvements

File content:
\`\`\`sysml
${fileContent}
\`\`\`

For each issue found, explain the problem and suggest a fix. If the file looks correct, confirm that and suggest any optional improvements.`,
        },
      }],
    }),
  );

  // ─── explain-element ────────────────────────────────────────────────────────
  server.prompt(
    'explain-element',
    'Explain what a SysML element or block of code does',
    {
      element: z.string().describe('The SysML code element or block to explain'),
      context: z.string().optional().describe('Optional: surrounding file content for context'),
    },
    ({ element, context }) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Explain the following SysML v2 element in plain language. Cover:
- What it defines or declares
- Its relationships to other elements
- Its attributes and ports (if any)
- How it fits into a system model

Element:
\`\`\`sysml
${element}
\`\`\`
${context ? `\nSurrounding context:\n\`\`\`sysml\n${context}\n\`\`\`` : ''}`,
        },
      }],
    }),
  );

  // ─── generate-sysml ─────────────────────────────────────────────────────────
  server.prompt(
    'generate-sysml',
    'Generate SysML v2 code from a natural language system description',
    {
      description: z.string().describe('Natural language description of the system to model'),
    },
    ({ description }) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Generate valid SysML v2 code for the following system description. Follow these rules:
- Use \`part def\` for structural components
- Use \`attribute def\` for value types
- Use \`port def\` for interaction points
- Use \`connection def\` for relationships between ports
- Use proper multiplicity where applicable
- Add \`doc /* ... */\` comments for important definitions
- Use PascalCase for definitions, camelCase for usages
- Import standard library types when needed (ScalarValues, SI, ISQ)

System description:
${description}

Generate clean, well-structured SysML v2 code wrapped in a package.`,
        },
      }],
    }),
  );
}
