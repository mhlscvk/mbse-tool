# Domain Model — systemodel.com SysML v2 Web Platform

---

## 1. Purpose

This document defines the core domain model for `systemodel.com`.

It covers:
- domain principles governing the model
- all domain entities with typed attributes, relationships, storage location, and phase
- aggregate boundaries (DDD)
- lifecycle workflows
- domain constraints
- artifact persistence summary
- key design decisions
- later-phase extension candidates

This document is the authoritative reference for the data model. The Prisma schema in `packages/storage-layer/prisma/schema.prisma` must match this document. If they diverge, this document takes precedence.

---

## 2. Domain Principles

The following principles govern every design decision in this domain model:

1. **Source text is the authoritative artifact** — the `.sysml` file content is the canonical record. All semantic artifacts are derived from it.
2. **Derived artifacts are never authoritative** — parsed snapshots, validation results, and render view models are computed from source revisions, not the other way around.
3. **Every change is revisioned** — every save creates a new immutable source revision. Nothing is overwritten.
4. **AI changes require human approval** — AI systems may only propose changes. A user must explicitly approve before a new revision is created.
5. **All critical actions are auditable** — model changes, AI tool invocations, patch approvals, and billing events must be traceable.
6. **Billing is separate from model semantics** — entitlement logic must never leak into parsing, validation, or rendering modules.
7. **Each entity has a clear owner and lifecycle** — no entity is modified by more than one aggregate root.

---

## 3. Entity Overview

```
User ──────────────────────────────────────────────────────────────────┐
 ├── has → Session (many)                                               │
 ├── has → ApiToken (many)                                             │
 ├── has → McpToken (many)                                             │
 ├── has → Subscription (one) → Plan                                   │
 │                           └→ Entitlement (many)                     │
 ├── owns → Project (many)                                             │
 │           ├── has → ProjectSettings (one)                            │
 │           ├── has → ProjectMember (many) ←── User                   │
 │           ├── has → Folder (many)                                    │
 │           └── has → ModelFile (many)                                 │
 │                      └── has → SourceRevision (many)                 │
 │                                 ├── has → RevisionAuthor (one)       │
 │                                 └── triggers → ParseJob (one)        │
 │                                                 └── produces →        │
 │                                          ParsedModelSnapshot (one)   │
 │                                           ├── has → ModelElement (many)
 │                                           ├── has → ModelRelationship (many)
 │                                           ├── has → ElementLocation (many)
 │                                           ├── triggers → ValidationRun (one)
 │                                           │               └── has → Diagnostic (many)
 │                                           └── triggers → RenderJob (one)
 │                                                           └── produces → RenderViewModel
 │                                                                           ├── ViewNode (many)
 │                                                                           ├── ViewEdge (many)
 │                                                                           └── ViewWarning (many)
 └── reviews → PatchProposal ──────────────────────────────────────────┘
                 ├── has → PatchOperation (many)
                 ├── has → ProposalValidationResult (one)
                 └── if approved → creates → SourceRevision

McpToken → ToolInvocation (many) → AuditEvent
BillingEvent ← Subscription
```

---

## 4. Domain Entity Groups

---

### 4.1 Identity and Access

---

#### User
Represents an authenticated person who can access the platform.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | string | Unique login identifier |
| `displayName` | string | Human-readable name |
| `passwordHash` | string | bcrypt hash; null if external IdP |
| `externalAuthId` | string | External IdP identifier; null if internal auth |
| `status` | enum | `Active`, `Suspended`, `Deleted` |
| `createdAt` | timestamp | Account creation |
| `updatedAt` | timestamp | Last profile update |
| `lastLoginAt` | timestamp | Last successful login |

**Relationships:** owns many `Project`, has one `Subscription`, has many `Session`, `ApiToken`, `McpToken`, `ProjectMember`

**Storage:** Database | **Phase:** 1

---

#### Role
Represents a named access role that groups permissions.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `key` | string | Machine identifier (`admin`, `standard_user`, `viewer`) |
| `name` | string | Human label |
| `description` | string | Role description |

**Phase 1 roles:** `Admin`, `StandardUser`, `Viewer`

**Relationships:** assigned through `ProjectMember`; mapped to `Permission` set centrally in `auth-core`

**Storage:** Database | **Phase:** 1

---

#### Permission
Represents a named capability that can be granted through a role.

| Attribute | Type | Description |
|---|---|---|
| `key` | string | Machine identifier (e.g. `file.write`, `patch.approve`) |
| `description` | string | Human description |

**Phase 1 examples:** `project.create`, `project.delete`, `file.read`, `file.write`, `patch.approve`, `billing.manage`, `mcp.token.create`

**Note:** Permissions are not assigned directly in Phase 1. They are mapped to roles centrally in `auth-core` — not stored as rows per user.

**Storage:** Code constants (not a DB table in Phase 1) | **Phase:** 1

---

#### ProjectMember
Represents a user's membership and role within a specific project.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `projectId` | UUID | FK → Project |
| `userId` | UUID | FK → User |
| `roleId` | UUID | FK → Role |
| `addedAt` | timestamp | When membership was granted |
| `addedByUserId` | UUID | FK → User who granted access |

**Rules:** a user can have at most one active membership per project; removing membership does not delete authored artifacts.

**Storage:** Database | **Phase:** 1

---

#### Session
Represents an authenticated login session.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `userId` | UUID | FK → User |
| `issuedAt` | timestamp | Token issue time |
| `expiresAt` | timestamp | Token expiry |
| `revokedAt` | timestamp | Null if active |
| `clientMetadata` | JSON | Browser/device info |

**Rules:** sessions are revocable; lifecycle is independent from project membership.

**Storage:** Database | **Phase:** 1

---

#### ApiToken
Represents an API access token for non-MCP integration use.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `userId` | UUID | FK → User |
| `name` | string | Human label |
| `tokenHash` | string | bcrypt hash — raw token never stored |
| `scopes` | string[] | Permitted operations |
| `createdAt` | timestamp | Creation time |
| `expiresAt` | timestamp | Expiry time |
| `revokedAt` | timestamp | Null if active |
| `lastUsedAt` | timestamp | Last successful use |

**Storage:** Database | **Phase:** 1

---

#### McpToken
Represents a token used specifically for MCP-based AI tool access.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `userId` | UUID | FK → User (token owner) |
| `name` | string | Human label (e.g. `My Claude Agent`) |
| `tokenHash` | string | bcrypt hash — raw token never stored |
| `scopes` | string[] | Permitted tool names |
| `createdAt` | timestamp | Creation time |
| `expiresAt` | timestamp | Expiry time |
| `revokedAt` | timestamp | Null if active |
| `lastUsedAt` | timestamp | Last successful use |

**Rules:** MCP tokens must have stricter scope controls than standard API tokens; all invocations are logged via `ToolInvocation`.

**Storage:** Database | **Phase:** 1

---

### 4.2 Project and Workspace

---

#### Project
The main container for model work within the platform.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `ownerUserId` | UUID | FK → User |
| `name` | string | Human-readable name |
| `slug` | string | URL-safe unique identifier |
| `description` | string | Optional description |
| `status` | enum | `Active`, `Archived` |
| `createdAt` | timestamp | Creation time |
| `updatedAt` | timestamp | Last modification |

**Relationships:** has one `ProjectSettings`, many `ProjectMember`, many `Folder`, many `ModelFile`

**Storage:** Database | **Phase:** 1

---

#### ProjectSettings
Configurable settings for a project that influence parser and validation behavior.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `projectId` | UUID | FK → Project |
| `parserProfile` | string | Parser configuration profile |
| `validationProfile` | string | Validation rule set profile |
| `defaultViewType` | string | Default graphical view type |
| `featureFlags` | JSON | Per-project feature toggles |
| `createdAt` | timestamp | Creation time |
| `updatedAt` | timestamp | Last update |

**Rules:** settings are mutable but must not retroactively change historical revision behavior.

**Storage:** Database | **Phase:** 1

---

#### Folder
An optional organizational container within a project for grouping model files.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `projectId` | UUID | FK → Project |
| `parentFolderId` | UUID | FK → Folder (null for root) |
| `name` | string | Folder name |
| `path` | string | Full path (e.g. `/systems/propulsion`) |
| `createdAt` | timestamp | Creation time |
| `updatedAt` | timestamp | Last modification |

**Rules:** folders are organizational only; they do not affect semantic model behavior; nesting is allowed.

**Storage:** Database | **Phase:** 1

---

#### ModelFile
Represents a logical SysML source file tracked within a project. Metadata only — content lives in `SourceRevision`.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `projectId` | UUID | FK → Project |
| `folderId` | UUID | FK → Folder (null if at project root) |
| `fileName` | string | File name (e.g. `system.sysml`) |
| `fileType` | string | Always `sysml` in Phase 1 |
| `currentRevisionId` | UUID | FK → SourceRevision (latest head) |
| `createdAt` | timestamp | First upload/creation |
| `updatedAt` | timestamp | Last revision time |
| `archivedAt` | timestamp | Null if active |

**Relationships:** belongs to one `Project`, has many `SourceRevision`

**Storage:** Database (metadata only) | **Phase:** 1

---

### 4.3 Source and Revision Control

---

#### SourceRevision
An immutable snapshot of a model file's source text at a point in time. Every save creates a new revision.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `modelFileId` | UUID | FK → ModelFile |
| `revisionNumber` | integer | Monotonically increasing per file |
| `storageKey` | string | Object storage key for `.sysml` content |
| `contentHash` | string | SHA-256 hash of content |
| `sizeBytes` | integer | File size in bytes |
| `grammarVersion` | string | SysML v2 grammar version |
| `sourceType` | enum | `UserEdit`, `Upload`, `AIPatchApproved` |
| `parentRevisionId` | UUID | FK → SourceRevision (null for first) |
| `createdAt` | timestamp | Save timestamp |

**Rules:** immutable after creation; never deleted; every save produces a new revision.

**Relationships:** has one `RevisionAuthor`, triggers one `ParseJob`

**Storage:** Database (metadata) + Object Storage / Cloudflare R2 (content) | **Phase:** 1

---

#### RevisionAuthor
Authorship and actor metadata for a source revision.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `sourceRevisionId` | UUID | FK → SourceRevision |
| `actorType` | enum | `User`, `AiAssisted` |
| `userId` | UUID | FK → User (always set — AI changes require an approving user) |
| `toolInvocationId` | UUID | FK → ToolInvocation (null for direct user edits) |
| `createdAt` | timestamp | Authorship record creation |

**Rules:** AI-assisted revisions must still resolve to an approving user; `actorType` = `AiAssisted` requires a non-null `toolInvocationId`.

**Storage:** Database | **Phase:** 1

---

### 4.4 Parsing and Semantic Model

---

#### ParseJob
Tracks the lifecycle of a parse operation for a specific source revision.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `sourceRevisionId` | UUID | FK → SourceRevision |
| `parserVersionId` | UUID | FK → ParserVersion |
| `status` | enum | `Pending`, `Running`, `Completed`, `Failed`, `Superseded` |
| `queuedAt` | timestamp | Job creation time |
| `startedAt` | timestamp | Processing start time |
| `completedAt` | timestamp | Finish time |
| `failureReason` | string | Populated on `Failed` |
| `supersededByRevisionId` | UUID | FK → SourceRevision that caused supersession |

**Status transitions:**
```
Pending → Running → Completed
                 → Failed
       → Superseded  (newer revision saved before job starts)
Running → Superseded (newer revision saved while job runs)
```

**Storage:** Database | **Phase:** 1

---

#### ParsedModelSnapshot
The normalized internal model representation produced by a completed parse job.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `sourceRevisionId` | UUID | FK → SourceRevision |
| `parseJobId` | UUID | FK → ParseJob |
| `parserVersionId` | UUID | FK → ParserVersion |
| `storageKey` | string | Object storage key for serialized model JSON |
| `snapshotHash` | string | Hash for integrity verification |
| `elementCount` | integer | Number of top-level model elements |
| `createdAt` | timestamp | Generation timestamp |

**Rules:** immutable after generation; validation and rendering operate on snapshots, not raw source.

**Storage:** Database (metadata) + Object Storage (serialized model JSON) | **Phase:** 1

---

#### ModelElement
A semantic element within a parsed model snapshot.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `snapshotId` | UUID | FK → ParsedModelSnapshot |
| `elementKey` | string | Stable key within snapshot scope |
| `elementType` | string | SysML element type (e.g. `Block`, `Port`, `Package`) |
| `name` | string | Element name |
| `qualifiedName` | string | Fully qualified name |
| `properties` | JSON | Type-specific properties |
| `parentElementId` | UUID | FK → ModelElement (null for root) |

**Rules:** elements exist only within a specific snapshot scope.

**Storage:** Database | **Phase:** 1

---

#### ModelRelationship
A semantic relationship between two model elements within the same snapshot.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `snapshotId` | UUID | FK → ParsedModelSnapshot |
| `relationshipType` | string | SysML relationship type (e.g. `Association`, `Generalization`) |
| `sourceElementId` | UUID | FK → ModelElement |
| `targetElementId` | UUID | FK → ModelElement |
| `properties` | JSON | Type-specific properties |

**Rules:** both source and target elements must belong to the same snapshot.

**Storage:** Database | **Phase:** 1

---

#### ElementLocation
Maps a semantic model element back to its position in the source text.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `snapshotId` | UUID | FK → ParsedModelSnapshot |
| `elementId` | UUID | FK → ModelElement |
| `revisionId` | UUID | FK → SourceRevision |
| `startLine` | integer | Source start line |
| `startColumn` | integer | Source start column |
| `endLine` | integer | Source end line |
| `endColumn` | integer | Source end column |

**Rules:** location must point to the exact source revision that produced the snapshot; supports editor diagnostics and source-to-view navigation.

**Storage:** Database | **Phase:** 1

---

#### ParserVersion
Records the parser/runtime version used for a parse job.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `version` | string | Semantic version string |
| `grammarVersion` | string | SysML v2 grammar version |
| `compatibilityProfile` | string | Supported language subset profile |
| `releaseDate` | timestamp | Release date |
| `notes` | string | Release notes |

**Rules:** version must be recorded for every parse job and snapshot to enable reproducibility and controlled upgrades.

**Storage:** Database | **Phase:** 1

---

### 4.5 Validation and Diagnostics

---

#### ValidationRun
A deterministic validation execution against a parsed model snapshot.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `snapshotId` | UUID | FK → ParsedModelSnapshot |
| `validatorVersionId` | UUID | FK → ValidatorVersion |
| `issueCount` | integer | Total issues found |
| `errorCount` | integer | Error-severity issues |
| `warningCount` | integer | Warning-severity issues |
| `infoCount` | integer | Info-severity issues |
| `startedAt` | timestamp | Run start time |
| `completedAt` | timestamp | Run completion time |

**Rules:** immutable after completion; multiple runs may exist per snapshot if rule sets evolve.

**Storage:** Database | **Phase:** 1

---

#### Diagnostic
A single issue produced by a parse job or validation run.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `validationRunId` | UUID | FK → ValidationRun (null if from parser) |
| `parseJobId` | UUID | FK → ParseJob (null if from validator) |
| `code` | string | Stable machine-readable rule identifier |
| `category` | enum | `Syntax`, `Semantic`, `Relationship`, `ViewSupport`, `ValidationRule` |
| `severity` | enum | `Error`, `Warning`, `Info` |
| `message` | string | Human-readable description |
| `startLine` | integer | Source location start line |
| `startColumn` | integer | Source location start column |
| `endLine` | integer | Source location end line |
| `endColumn` | integer | Source location end column |
| `relatedElementId` | UUID | FK → ModelElement (if applicable) |
| `locationId` | UUID | FK → ElementLocation (if applicable) |

**Rules:** diagnostics must be structured, reproducible, and support stable codes for UI grouping.

**Storage:** Database | **Phase:** 1

---

#### ValidatorVersion
Records the rule engine or rule-pack version used for a validation run.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `version` | string | Semantic version string |
| `rulePackName` | string | Name of the rule pack |
| `releaseDate` | timestamp | Release date |
| `notes` | string | Release notes |

**Rules:** version must be recorded for every validation run to enable reproducibility.

**Storage:** Database | **Phase:** 1

---

### 4.6 Graphical View Layer

---

#### ViewDefinition
Represents a user- or system-defined request for a graphical view of a model.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `projectId` | UUID | FK → Project |
| `modelFileId` | UUID | FK → ModelFile |
| `snapshotId` | UUID | FK → ParsedModelSnapshot |
| `viewType` | string | View type (e.g. `BDD`, `IBD`) |
| `options` | JSON | View-specific configuration |
| `createdByUserId` | UUID | FK → User |
| `createdAt` | timestamp | Request creation time |

**Rules:** Phase 1 views are read-only and generated from parsed snapshots only.

**Storage:** Database | **Phase:** 1

---

#### RenderJob
Tracks the lifecycle of a graphical view generation request.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `viewDefinitionId` | UUID | FK → ViewDefinition |
| `status` | enum | `Pending`, `Running`, `Completed`, `Failed` |
| `startedAt` | timestamp | Processing start |
| `completedAt` | timestamp | Finish time |
| `failureReason` | string | Populated on `Failed` |

**Rules:** render jobs operate only on parsed snapshots — never on raw source text directly.

**Storage:** Database | **Phase:** 1

---

#### RenderViewModel
The derived graph structure used by the frontend viewer.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `renderJobId` | UUID | FK → RenderJob |
| `snapshotId` | UUID | FK → ParsedModelSnapshot |
| `layoutMetadata` | JSON | Auto-layout positions and sizes |
| `warningSummary` | JSON | Summary of unsupported constructs |
| `createdAt` | timestamp | Generation timestamp |

**Rules:** derived and non-authoritative; may be cached but never treated as source of truth; regenerated when needed.

**Storage:** Cache only (not persisted to DB or object storage) | **Phase:** 1

---

#### ViewNode
A node in a render view model representing a rendered model element.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `renderViewModelId` | UUID | FK → RenderViewModel |
| `sourceElementId` | UUID | FK → ModelElement |
| `nodeType` | string | Visual node type |
| `label` | string | Display label |
| `position` | JSON | `{x, y}` coordinates |
| `size` | JSON | `{width, height}` |
| `style` | JSON | Visual styling metadata |

**Storage:** In-memory / cache only | **Phase:** 1

---

#### ViewEdge
An edge in a render view model representing a rendered model relationship.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `renderViewModelId` | UUID | FK → RenderViewModel |
| `sourceRelationshipId` | UUID | FK → ModelRelationship |
| `edgeType` | string | Visual edge type |
| `sourceNodeId` | UUID | FK → ViewNode |
| `targetNodeId` | UUID | FK → ViewNode |
| `label` | string | Display label |
| `routingMetadata` | JSON | Edge routing points |

**Storage:** In-memory / cache only | **Phase:** 1

---

#### ViewWarning
A warning produced during view generation for unsupported or partial constructs.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `renderViewModelId` | UUID | FK → RenderViewModel |
| `code` | string | Warning code |
| `message` | string | Human-readable description |
| `relatedElementId` | UUID | FK → ModelElement (if applicable) |

**Examples:** unsupported construct omitted, layout fallback applied, partial rendering only.

**Storage:** In-memory / cache only | **Phase:** 1

---

### 4.7 AI and MCP

---

#### PatchProposal
A proposed set of source changes generated by an AI tool, requiring user approval before committing.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `projectId` | UUID | FK → Project |
| `modelFileId` | UUID | FK → ModelFile |
| `baseRevisionId` | UUID | FK → SourceRevision being patched |
| `proposedByActorType` | enum | `User`, `AI` |
| `proposedByUserId` | UUID | FK → User (null if AI-only) |
| `toolInvocationId` | UUID | FK → ToolInvocation (null if user-proposed) |
| `summary` | string | Short description of change |
| `rationale` | text | Explanation of why the change is proposed |
| `status` | enum | `PendingReview`, `Validated`, `Approved`, `Rejected`, `Expired`, `Superseded` |
| `reviewedByUserId` | UUID | FK → User (null until reviewed) |
| `reviewedAt` | timestamp | Null until reviewed |
| `resultingRevisionId` | UUID | FK → SourceRevision (null until approved) |
| `createdAt` | timestamp | Proposal creation |

**Rules:** a patch proposal never mutates source directly; approved proposals create a new `SourceRevision`; rejected proposals remain auditable.

**Storage:** Database | **Phase:** 1 (structure); Phase 3 (full AI workflow)

---

#### PatchOperation
An atomic change within a patch proposal.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `patchProposalId` | UUID | FK → PatchProposal |
| `operationType` | enum | `Insert`, `Delete`, `Replace` |
| `targetRange` | JSON | `{startLine, startColumn, endLine, endColumn}` |
| `beforeText` | text | Original text being replaced (null for insert) |
| `afterText` | text | Replacement text (null for delete) |
| `orderIndex` | integer | Execution order |

**Rules:** operations must be deterministic and replayable in order.

**Storage:** Database | **Phase:** 1

---

#### ProposalValidationResult
The validation result of applying a proposed patch — run before the user approves.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `patchProposalId` | UUID | FK → PatchProposal |
| `temporarySnapshotId` | UUID | FK → ParsedModelSnapshot (temporary, proposal-scope) |
| `validationRunId` | UUID | FK → ValidationRun |
| `summary` | JSON | Error/warning/info counts |
| `createdAt` | timestamp | Validation run time |

**Rules:** proposal validation is separate from committed revision validation; exists to support safe user review before approval.

**Storage:** Database | **Phase:** 1

---

#### ToolInvocation
An audit record of every MCP tool call made by an AI client.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `actorType` | enum | `User`, `AI` |
| `userId` | UUID | FK → User (token owner) |
| `tokenId` | UUID | FK → McpToken |
| `toolName` | string | Name of tool invoked |
| `projectId` | UUID | FK → Project (if applicable) |
| `fileId` | UUID | FK → ModelFile (if applicable) |
| `inputSummary` | JSON | Sanitized input (no secrets) |
| `responseStatus` | enum | `Success`, `Unauthorized`, `NotFound`, `Error` |
| `startedAt` | timestamp | Invocation start |
| `completedAt` | timestamp | Invocation end |
| `durationMs` | integer | Processing time in milliseconds |

**Rules:** all tool invocations must be auditable; sensitive input must be summarized safely.

**Storage:** Database | **Phase:** 1

---

#### AuditEvent
A general-purpose append-only record of any significant system event.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `eventType` | string | Named event (see observability event taxonomy) |
| `actorType` | enum | `User`, `AI`, `System` |
| `actorUserId` | UUID | FK → User (null for system events) |
| `relatedEntityType` | string | Entity type (e.g. `SourceRevision`, `PatchProposal`) |
| `relatedEntityId` | UUID | FK to related entity |
| `metadata` | JSON | Event-specific data |
| `createdAt` | timestamp | Event timestamp |

**Rules:** append-only; never deleted or modified; supports both operational and compliance needs.

**Storage:** Database | **Phase:** 1

---

### 4.8 Billing and Entitlements

---

#### Plan
Represents a product plan definition with its entitlement envelope.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `key` | string | Machine identifier (`free`, `pro`, `enterprise`) |
| `name` | string | Human label |
| `description` | string | Plan description |
| `featureLimits` | JSON | Default limits (maxProjects, maxFiles, etc.) |
| `isActive` | boolean | Whether plan is currently offered |

**Phase 1 plans:** `Free`, `Pro`, `AdminInternal`

**Storage:** Database | **Phase:** 1

---

#### Subscription
Represents a user's billing relationship with the platform.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `userId` | UUID | FK → User |
| `planId` | UUID | FK → Plan |
| `stripeCustomerId` | string | Stripe customer ID |
| `stripeSubscriptionId` | string | Stripe subscription ID (null for free tier) |
| `status` | enum | `Active`, `PastDue`, `Cancelled`, `Trialing` |
| `currentPeriodStart` | timestamp | Billing period start |
| `currentPeriodEnd` | timestamp | Billing period end |
| `startedAt` | timestamp | First subscription creation |
| `updatedAt` | timestamp | Last Stripe event update |

**Rules:** Stripe is the source of truth for subscription state; `status` is derived from Stripe webhook events.

**Storage:** Database | **Phase:** 1

---

#### Entitlement
A concrete resolved capability enabled for a user based on their active subscription plan.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `userId` | UUID | FK → User |
| `subscriptionId` | UUID | FK → Subscription |
| `key` | string | Entitlement key (e.g. `maxProjects`, `mcpAccessEnabled`) |
| `value` | string | Entitlement value (numeric limit or boolean) |
| `sourcePlanId` | UUID | FK → Plan |
| `effectiveFrom` | timestamp | When entitlement became active |
| `effectiveTo` | timestamp | Null if currently active |

**Rules:** evaluated at runtime for each feature access check; may come from plan defaults or explicit overrides; updated whenever a Stripe webhook is processed.

**Storage:** Database | **Phase:** 1

---

#### BillingEvent
An external provider billing event recorded by the system.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `provider` | string | `Stripe` |
| `providerEventId` | string | Stripe event ID (for idempotency) |
| `eventType` | string | Stripe event type (e.g. `customer.subscription.updated`) |
| `receivedAt` | timestamp | When event arrived |
| `processedAt` | timestamp | When event was handled |
| `status` | enum | `Received`, `Processed`, `Failed`, `Skipped` |
| `payloadSummary` | JSON | Sanitized event data |

**Rules:** processing must be idempotent (use `providerEventId` as deduplication key); all billing events are auditable.

**Storage:** Database | **Phase:** 1

---

## 5. Enumerations

| Enum | Values |
|---|---|
| `UserStatus` | `Active`, `Suspended`, `Deleted` |
| `ParseJobStatus` | `Pending`, `Running`, `Completed`, `Failed`, `Superseded` |
| `RenderJobStatus` | `Pending`, `Running`, `Completed`, `Failed` |
| `SubscriptionStatus` | `Active`, `PastDue`, `Cancelled`, `Trialing` |
| `DiagnosticSeverity` | `Error`, `Warning`, `Info` |
| `DiagnosticCategory` | `Syntax`, `Semantic`, `Relationship`, `ViewSupport`, `ValidationRule` |
| `PatchProposalStatus` | `PendingReview`, `Validated`, `Approved`, `Rejected`, `Expired`, `Superseded` |
| `PatchOperationType` | `Insert`, `Delete`, `Replace` |
| `SourceRevisionSource` | `UserEdit`, `Upload`, `AIPatchApproved` |
| `RevisionActorType` | `User`, `AiAssisted` |
| `ToolResponseStatus` | `Success`, `Unauthorized`, `NotFound`, `Error` |
| `AuditActorType` | `User`, `AI`, `System` |
| `BillingEventStatus` | `Received`, `Processed`, `Failed`, `Skipped` |

---

## 6. DDD Aggregate Boundaries

### 6.1 Project Aggregate
**Root:** `Project`

**Includes:** `ProjectSettings`, `ProjectMember`, `Folder`, `ModelFile`

**Purpose:** workspace management and access scoping. All project-level access control decisions flow through this aggregate.

---

### 6.2 Model File Aggregate
**Root:** `ModelFile`

**Includes:** `SourceRevision`, `RevisionAuthor`, `ParseJob`, `ParsedModelSnapshot`, `ModelElement`, `ModelRelationship`, `ElementLocation`, `ValidationRun`, `Diagnostic`, `ViewDefinition`, `RenderJob`, `RenderViewModel`, `ViewNode`, `ViewEdge`, `ViewWarning`

**Purpose:** full lifecycle of an authored model file from source text through parsing, validation, and rendering.

---

### 6.3 Patch Proposal Aggregate
**Root:** `PatchProposal`

**Includes:** `PatchOperation`, `ProposalValidationResult`

**Purpose:** safe AI or user-assisted change review workflow. Completely separate from committed source until approved.

---

### 6.4 Billing Aggregate
**Root:** `Subscription`

**Includes:** `Plan`, `Entitlement`, `BillingEvent`

**Purpose:** feature access and monetization control. Isolated from all modeling logic.

---

## 7. Lifecycle Workflows

### 7.1 Model Authoring Lifecycle
1. User opens or creates a `ModelFile`
2. User saves source text → new `SourceRevision` created (immutable)
3. `RevisionAuthor` record created (actorType: `User`)
4. `ParseJob` created (status: `Pending`)
5. Worker picks up job → status: `Running`
6. Parser produces `ParsedModelSnapshot` + `ModelElement` + `ModelRelationship` + `ElementLocation`
7. `ValidationRun` executes → `Diagnostic` records created
8. `ParseJob` status → `Completed`
9. `ViewDefinition` triggers `RenderJob` → `RenderViewModel` generated and cached
10. Frontend displays diagnostics and graphical view

---

### 7.2 AI-Assisted Change Lifecycle
1. AI client invokes MCP tool → `ToolInvocation` recorded
2. `PatchProposal` created (status: `PendingReview`)
3. Proposal validation runs → `ProposalValidationResult` created
4. User reviews proposal and validation result
5. User approves → new `SourceRevision` created (sourceType: `AIPatchApproved`)
6. `RevisionAuthor` created (actorType: `AiAssisted`, linked to `ToolInvocation`)
7. `PatchProposal` status → `Approved`; `resultingRevisionId` set
8. Normal authoring lifecycle resumes from step 4

   **Or:** User rejects → `PatchProposal` status → `Rejected`; no revision created

---

### 7.3 Billing and Access Lifecycle
1. User account created → free-tier `Subscription` and `Entitlement` records created
2. User upgrades → Stripe subscription created; `BillingEvent` recorded
3. Stripe webhook received → `BillingEvent` stored; `Subscription` and `Entitlement` updated
4. Feature access checks at runtime evaluate `Entitlement` records centrally via `billing-core`

---

## 8. Artifact Persistence Summary

| Artifact | Persisted | Storage | Notes |
|---|---|---|---|
| User | Yes | Database | |
| Session | Yes | Database | |
| ApiToken | Yes | Database | Raw token never stored |
| McpToken | Yes | Database | Raw token never stored |
| Project | Yes | Database | |
| ProjectSettings | Yes | Database | |
| ProjectMember | Yes | Database | |
| Folder | Yes | Database | |
| ModelFile | Yes | Database | Metadata only |
| SourceRevision | Yes | DB + Object Storage | Content in R2; immutable |
| RevisionAuthor | Yes | Database | |
| ParseJob | Yes | Database | Lifecycle tracking |
| ParsedModelSnapshot | Yes | DB + Object Storage | Serialized model JSON in R2 |
| ModelElement | Yes | Database | |
| ModelRelationship | Yes | Database | |
| ElementLocation | Yes | Database | |
| ParserVersion | Yes | Database | |
| ValidationRun | Yes | Database | |
| Diagnostic | Yes | Database | |
| ValidatorVersion | Yes | Database | |
| ViewDefinition | Yes | Database | |
| RenderJob | Yes | Database | |
| RenderViewModel | **No** | Cache only | Regenerated on demand |
| ViewNode | **No** | Cache only | Part of RenderViewModel |
| ViewEdge | **No** | Cache only | Part of RenderViewModel |
| ViewWarning | **No** | Cache only | Part of RenderViewModel |
| PatchProposal | Yes | Database | |
| PatchOperation | Yes | Database | |
| ProposalValidationResult | Yes | Database | |
| ToolInvocation | Yes | Database | Audit log |
| AuditEvent | Yes | Database | Append-only |
| Plan | Yes | Database | |
| Subscription | Yes | Database | Stripe is source of truth |
| Entitlement | Yes | Database | Derived from subscription |
| BillingEvent | Yes | Database | Idempotent processing |

---

## 9. Domain Constraints

The domain must enforce these constraints at all times:

1. `SourceRevision` records are immutable after creation — never modified or deleted
2. `ParsedModelSnapshot` records are immutable after generation
3. `Diagnostic` records are tied to exact parse jobs or validation runs — never reassigned
4. `RenderViewModel` and its children are derived and non-authoritative — never stored as DB records
5. `PatchProposal` records must never directly modify committed source — only approved proposals create a new `SourceRevision`
6. All user and AI actions that affect models must produce an `AuditEvent`
7. Project-scoped access must be enforced via `ProjectMember` and `auth-core` — never bypassed
8. Entitlement checks must be centralized in `billing-core` — no feature gating logic in other modules
9. Raw token values for `ApiToken` and `McpToken` must never be stored — hash only
10. `BillingEvent` processing must be idempotent using `providerEventId`

---

## 10. Key Design Decisions

**Immutable source revisions** — every save produces a new revision. Revisions are never modified or deleted. This enables full history, rollback, reproducible parse/validation results, and safe AI patch proposals.

**ParseJob as a first-class entity** — tracking parse job lifecycle in the database allows the UI to show parse status accurately, prevents stale results from appearing, and handles the rapid-save supersession scenario cleanly.

**Parsed model snapshot stored in object storage** — normalized model JSON can be large. Storing it in R2 keeps the database lean and allows efficient retrieval only when needed.

**Render view model is never persisted** — it is always derived from the parsed model snapshot on demand and cached. This avoids stale render artifacts and keeps storage costs low.

**Entitlement as derived records** — computed from the subscription plan and stored for fast access checks. Updated on every Stripe webhook. Stripe is the source of truth, not the local DB.

**AI patches are proposals, not commits** — a `PatchProposal` is always stored separately. It only becomes a `SourceRevision` when explicitly approved by a user. This enforces human-in-the-loop.

**PatchOperation as atomic operations** — breaking a patch into atomic, ordered, replayable operations (Insert/Delete/Replace) is safer and more auditable than storing a raw unified diff string.

**RevisionAuthor separates authorship from content** — decoupling who authored a revision from the revision content allows clean AI-assisted revision tracking without polluting the `SourceRevision` schema.

**AuditEvent as a general append-only log** — a single audit table for all significant system events (not just MCP invocations) simplifies compliance reporting and operational debugging.

---

## 11. ID and Timestamp Conventions

- All entity IDs use **UUID v4**
- All timestamps are stored in **UTC**
- Every persistent entity has `createdAt`
- Mutable entities also have `updatedAt`
- Lifecycle-specific timestamps are explicit fields: `reviewedAt`, `completedAt`, `revokedAt`, `processedAt`, `archivedAt`
- Soft deletes use `archivedAt` or `revokedAt` — never physical row deletion for auditable entities

---

## 12. Later-Phase Extension Candidates

The following entities are intentionally excluded from Phase 1 and planned for later phases:

| Entity | Phase | Purpose |
|---|---|---|
| `Organization` | Phase 4 | Multi-user organizational accounts |
| `Team` | Phase 4 | Sub-groups within organizations |
| `Comment` | Phase 4 | Inline model comments |
| `CollaborativeEditSession` | Phase 4 | Real-time multi-user editing |
| `DiagramLayoutProfile` | Phase 2 | Saved custom diagram layouts |
| `SimulationDefinition` | Phase 5 | Simulation configuration |
| `SimulationRun` | Phase 5 | Simulation execution record |
| `TraceLink` | Phase 3 | Requirement-to-model traceability |
| `Requirement` | Phase 3 | System requirement entity |
| `ModelTemplate` | Phase 2 | Reusable model structure templates |
| `ImportExportJob` | Phase 2 | Bulk import/export operations |
| `Notification` | Phase 4 | User notification records |
| `UsageMetric` | Phase 3 | Per-user usage tracking for billing |
| `RulePackVersion` | Phase 2 | Versioned external validation rule packs |
