import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools.js';
import { registerResources } from './resources.js';
import { registerPrompts } from './prompts.js';
import { mcpEvents, type FileChangeEvent } from './events.js';

/**
 * Create a new MCP server instance scoped to a specific user.
 * Each authenticated session gets its own server so tools operate
 * in the user's ownership context.
 *
 * Subscribes to the file change event bus so connected clients
 * receive real-time resource update notifications.
 */
export function createMcpServer(userId: string, userRole?: string): McpServer {
  const server = new McpServer({
    name: 'systemodel',
    version: '1.0.0',
  }, {
    capabilities: {
      tools: {},
      resources: { subscribe: true },
      prompts: {},
    },
  });

  registerTools(server, userId, userRole);
  registerResources(server, userId);
  registerPrompts(server);

  // ─── Real-time resource notifications ─────────────────────────────────────
  // Listen for file changes that belong to this user and push
  // notifications to the connected MCP client.

  const handleFileChange = (event: FileChangeEvent) => {
    if (event.userId !== userId) return;

    try {
      server.server.sendResourceUpdated({ uri: `sysml://files/${event.fileId}` });
    } catch {
      // Client might not be subscribed or transport closed — ignore
    }
  };

  mcpEvents.onFileChange(handleFileChange);

  // Chain onto existing onclose handler instead of overwriting
  const prevOnClose = server.server.onclose;
  server.server.onclose = () => {
    mcpEvents.offFileChange(handleFileChange);
    if (typeof prevOnClose === 'function') prevOnClose();
  };

  return server;
}
