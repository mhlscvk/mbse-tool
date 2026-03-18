import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { prisma } from '../db.js';

/** SysML v2 syntax quick reference — injected as a static resource */
const SYSML_REFERENCE = `# SysML v2 Syntax Reference

## Definitions (types)
\`\`\`sysml
package MyPackage {
  // Part definitions (structural)
  part def Vehicle {
    part engine : Engine;
    part wheels : Wheel[4];
    attribute mass : Real = 1500;
    port fuelIn : FuelPort;
  }

  // Attribute definitions (value types)
  attribute def Mass {
    attribute value : Real;
    attribute unit : String = "kg";
  }

  // Port definitions (interaction points)
  port def FuelPort {
    in attribute flow : Fuel;
    out attribute pressure : Real;
  }

  // Connection definitions
  connection def FuelLine {
    end source : FuelPort;
    end target : FuelPort;
  }

  // Action definitions (behavior)
  action def Drive {
    in item fuel : Fuel;
    out item exhaust : Exhaust;
    action accelerate;
    action brake;
    first start then accelerate then brake then done;
  }

  // State definitions
  state def VehicleStates {
    state parked;
    state moving;
    transition parked_to_moving
      first parked then moving;
  }

  // Item definitions (flow items)
  item def Fuel;
  item def Exhaust;

  // Enumerations
  enum def Color { red; green; blue; }

  // Requirement definitions
  requirement def MaxWeight {
    doc /* Vehicle shall not exceed 2000 kg */
    attribute maxMass : Real = 2000;
  }
}
\`\`\`

## Usages (instances inside definitions)
- \`part engine : Engine;\` — typed usage
- \`part engine;\` — untyped usage
- \`attribute mass : Real = 42;\` — attribute with default
- \`port fuelIn : FuelPort;\` — port usage

## Multiplicity
- \`[1]\` — exactly one
- \`[0..*]\` — zero or more
- \`[1..*]\` — one or more
- \`[4]\` — exactly four

## Relationships
- \`specializes Base\` or \`:> Base\` — generalization/subsetting
- \`:>> Base\` — redefinition
- \`::> Base\` — reference subsetting

## Connections & Flows
- \`connect engine::fuelIn to fuelSupply::fuelOut;\`
- \`flow of Fuel from tank::out to engine::in;\`

## Visibility
- \`public\` or \`+\` — visible everywhere
- \`private\` or \`-\` — visible only in owner
- \`protected\` or \`#\` — visible in owner and specializations

## Comments
- \`// single line\`
- \`/* block comment */\`
- \`doc /* documentation comment */\`

## Standard Library Imports
- \`import ScalarValues::*;\` — Real, Integer, String, Boolean, Natural
- \`import SI::*;\` — m, kg, s, N, Pa, J, W, etc.
- \`import ISQ::*;\` — derived quantities (Area, Velocity, Force, etc.)
`;

/**
 * Register MCP resources — static reference docs and dynamic file access.
 */
export function registerResources(server: McpServer, userId: string): void {

  // ─── Static SysML v2 syntax reference ───────────────────────────────────────
  server.resource(
    'sysml-reference',
    'sysml://reference/syntax',
    { description: 'SysML v2 syntax quick reference — definitions, usages, relationships, standard library' },
    async () => ({
      contents: [{
        uri: 'sysml://reference/syntax',
        mimeType: 'text/markdown',
        text: SYSML_REFERENCE,
      }],
    }),
  );

  // ─── Dynamic file resource (subscribable) ──────────────────────────────────
  server.resource(
    'sysml-file',
    new ResourceTemplate('sysml://files/{fileId}', { list: undefined }),
    {
      description: 'SysML file content — subscribable for real-time updates when the file changes',
    },
    async (uri, { fileId }) => {
      const fid = Array.isArray(fileId) ? fileId[0] : fileId;
      const file = await prisma.sysMLFile.findUnique({
        where: { id: fid },
        include: { project: { select: { ownerId: true } } },
      });
      if (!file || file.project.ownerId !== userId) {
        return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'Error: File not found or access denied' }] };
      }

      const numbered = file.content.split('\n')
        .map((line, i) => `${String(i + 1).padStart(4, ' ')} | ${line}`)
        .join('\n');

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'text/plain',
          text: `File: ${file.name} (${file.content.split('\n').length} lines)\n\n${numbered}`,
        }],
      };
    },
  );

  // ─── Dynamic project file list resource ────────────────────────────────────
  server.resource(
    'project-files',
    new ResourceTemplate('sysml://projects/{projectId}/files', { list: undefined }),
    {
      description: 'List of files in a project — subscribable for updates when files are added or removed',
    },
    async (uri, { projectId }) => {
      const pid = Array.isArray(projectId) ? projectId[0] : projectId;
      const project = await prisma.project.findFirst({
        where: { id: pid, ownerId: userId },
      });
      if (!project) {
        return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'Error: Project not found or access denied' }] };
      }

      const files = await prisma.sysMLFile.findMany({
        where: { projectId: pid },
        select: { id: true, name: true, size: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      });

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(files.map(f => ({
            id: f.id,
            name: f.name,
            size: f.size,
            resourceUri: `sysml://files/${f.id}`,
            updatedAt: f.updatedAt.toISOString(),
          })), null, 2),
        }],
      };
    },
  );
}
