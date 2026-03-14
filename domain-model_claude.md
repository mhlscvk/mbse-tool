# Domain Model — systemodel.com SysML v2 Web Platform

---

## 1. Purpose

This document defines the core domain entities for `systemodel.com`.

It covers:
- what each entity is and what it represents
- its key attributes
- its relationships to other entities
- which phase it is introduced in
- storage location (database vs object storage)

This document is the authoritative reference for the data model. The Prisma schema in `packages/storage-layer/prisma/schema.prisma` must match this document. If they diverge, this document takes precedence and the schema must be updated.

---

## 2. Entity Overview

```
User
 └── owns → Project (many)
              └── contains → File (many)
                              └── has → SourceRevision (many)
                                         └── produces → ParseJob (one)
                                                         └── produces → ParsedModelSnapshot (one)
                                                                         └── produces → ValidationResultSet (one)
                                                                         └── produces → RenderViewModel (cached)

User
 └── has → Subscription (one)
             └── defines → Entitlement (one)

User
 └── has → McpApiKey (many)

Project
 └── has → ProjectMember (many) → User

AIPatchProposal
 └── linked to → SourceRevision
 └── proposed by → McpApiKey or User
 └── approved/rejected by → User
 └── if approved → creates → SourceRevision
```

---

## 3. Entities

---

### 3.1 User

Represents an authenticated person using the platform.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | string | Unique, used for login |
| `passwordHash` | string | bcrypt hash; null if using external IdP |
| `role` | enum | `Admin`, `StandardUser`, `Viewer` |
| `createdAt` | timestamp | Account creation time |
| `updatedAt` | timestamp | Last profile update |
| `lastLoginAt` | timestamp | Last successful login |
| `isActive` | boolean | False if account is suspended |

**Relationships:**
- owns many `Project`
- has one `Subscription`
- has many `McpApiKey`
- has many `ProjectMember` (membership in projects owned by others)

**Storage:** Database

**Phase:** 1

---

### 3.2 Project

A workspace that groups related SysML v2 model files.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `ownerId` | UUID | FK → User |
| `name` | string | Human-readable project name |
| `description` | string | Optional description |
| `createdAt` | timestamp | Creation time |
| `updatedAt` | timestamp | Last modification |
| `isArchived` | boolean | Soft delete flag |

**Relationships:**
- belongs to one `User` (owner)
- has many `File`
- has many `ProjectMember`

**Storage:** Database

**Phase:** 1

---

### 3.3 ProjectMember

Represents a user's membership and role within a specific project.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `projectId` | UUID | FK → Project |
| `userId` | UUID | FK → User |
| `role` | enum | `Admin`, `StandardUser`, `Viewer` (project-scoped) |
| `addedAt` | timestamp | When membership was granted |

**Relationships:**
- belongs to one `Project`
- belongs to one `User`

**Storage:** Database

**Phase:** 1

---

### 3.4 File

A `.sysml` file within a project. Represents the logical file identity — actual content is stored in `SourceRevision`.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `projectId` | UUID | FK → Project |
| `name` | string | File name (e.g. `system.sysml`) |
| `createdAt` | timestamp | Upload/creation time |
| `updatedAt` | timestamp | Last revision time |
| `isDeleted` | boolean | Soft delete flag |
| `latestRevisionId` | UUID | FK → SourceRevision (current head) |

**Relationships:**
- belongs to one `Project`
- has many `SourceRevision`
- has one current `SourceRevision` (via `latestRevisionId`)

**Storage:** Database (metadata); content in object storage via `SourceRevision`

**Phase:** 1

---

### 3.5 SourceRevision

An immutable snapshot of a `.sysml` file's content at a point in time. Every save creates a new revision.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `fileId` | UUID | FK → File |
| `authorId` | UUID | FK → User who saved |
| `revisionNumber` | integer | Monotonically increasing per file |
| `storageKey` | string | Object storage key for the `.sysml` content |
| `sizeBytes` | integer | File size in bytes |
| `grammarVersion` | string | SysML v2 grammar version used |
| `createdAt` | timestamp | Save timestamp |
| `source` | enum | `UserEdit`, `Upload`, `AIPatchApproved` |

**Relationships:**
- belongs to one `File`
- belongs to one `User` (author)
- has one `ParseJob`

**Storage:** Database (metadata); `.sysml` content in object storage (Cloudflare R2)

**Immutability:** Once created, a `SourceRevision` is never modified.

**Phase:** 1

---

### 3.6 ParseJob

Tracks the lifecycle of a parse operation for a specific source revision.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `revisionId` | UUID | FK → SourceRevision |
| `status` | enum | `Pending`, `Running`, `Completed`, `Failed`, `Superseded` |
| `parserVersion` | string | Version of the parser used |
| `queuedAt` | timestamp | When job was created |
| `startedAt` | timestamp | When job began processing |
| `completedAt` | timestamp | When job finished |
| `errorMessage` | string | Populated on `Failed` status |

**Status transitions:**
```
Pending → Running → Completed
                 → Failed
       → Superseded  (when a newer revision is saved before this job starts)
Running → Superseded (when a newer revision is saved while this job runs)
```

**Relationships:**
- belongs to one `SourceRevision`
- has one `ParsedModelSnapshot` (on `Completed`)

**Storage:** Database

**Phase:** 1

---

### 3.7 ParsedModelSnapshot

The normalized internal model representation produced by a completed parse job.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `parseJobId` | UUID | FK → ParseJob |
| `revisionId` | UUID | FK → SourceRevision |
| `parserVersion` | string | Parser version that produced this snapshot |
| `storageKey` | string | Object storage key for the serialized model JSON |
| `elementCount` | integer | Number of top-level model elements |
| `createdAt` | timestamp | Generation timestamp |

**Relationships:**
- belongs to one `ParseJob`
- belongs to one `SourceRevision`
- has one `ValidationResultSet`

**Storage:** Database (metadata); serialized model in object storage

**Phase:** 1

---

### 3.8 ValidationResultSet

The structured set of diagnostics produced by running validation rules against a parsed model snapshot.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `snapshotId` | UUID | FK → ParsedModelSnapshot |
| `validatorVersion` | string | Version of validation rules used |
| `issueCount` | integer | Total number of issues |
| `errorCount` | integer | Issues with severity `Error` |
| `warningCount` | integer | Issues with severity `Warning` |
| `infoCount` | integer | Issues with severity `Info` |
| `createdAt` | timestamp | Generation timestamp |

**Relationships:**
- belongs to one `ParsedModelSnapshot`
- has many `ValidationIssue`

**Storage:** Database

**Phase:** 1

---

### 3.9 ValidationIssue

A single diagnostic issue within a `ValidationResultSet`.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `resultSetId` | UUID | FK → ValidationResultSet |
| `issueCode` | string | Machine-readable rule identifier |
| `severity` | enum | `Error`, `Warning`, `Info` |
| `message` | string | Human-readable description |
| `startLine` | integer | Source location start line |
| `startColumn` | integer | Source location start column |
| `endLine` | integer | Source location end line |
| `endColumn` | integer | Source location end column |
| `category` | string | Issue category (e.g. `Syntax`, `Naming`, `Structure`) |
| `relatedElementId` | string | ID of the offending model element (if applicable) |

**Relationships:**
- belongs to one `ValidationResultSet`

**Storage:** Database

**Phase:** 1

---

### 3.10 Subscription

Represents a user's current billing plan and subscription state.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `userId` | UUID | FK → User |
| `stripeCustomerId` | string | Stripe customer ID |
| `stripeSubscriptionId` | string | Stripe subscription ID (null if free tier) |
| `planId` | string | Plan identifier (e.g. `free`, `pro`, `enterprise`) |
| `status` | enum | `Active`, `PastDue`, `Cancelled`, `Trialing` |
| `currentPeriodStart` | timestamp | Current billing period start |
| `currentPeriodEnd` | timestamp | Current billing period end |
| `createdAt` | timestamp | First subscription creation |
| `updatedAt` | timestamp | Last Stripe event update |

**Relationships:**
- belongs to one `User`
- defines one `Entitlement`

**Storage:** Database

**Phase:** 1

---

### 3.11 Entitlement

The resolved feature access rights for a user based on their active subscription plan.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `subscriptionId` | UUID | FK → Subscription |
| `maxProjects` | integer | Maximum number of projects allowed |
| `maxFilesPerProject` | integer | Maximum files per project |
| `maxFileSizeMb` | integer | Maximum `.sysml` file size |
| `canUseGraphicalViewer` | boolean | Access to graphical viewer |
| `canUseMcp` | boolean | Access to MCP tool API |
| `canInviteMembers` | boolean | Can add members to projects |
| `updatedAt` | timestamp | Last entitlement update |

**Relationships:**
- belongs to one `Subscription`

**Storage:** Database

**Phase:** 1

---

### 3.12 McpApiKey

An API key that grants an AI system access to MCP tool endpoints.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `userId` | UUID | FK → User (key owner) |
| `keyHash` | string | bcrypt hash of the API key |
| `name` | string | Human label (e.g. `My Claude Agent`) |
| `scopes` | string[] | Permitted tool names |
| `lastUsedAt` | timestamp | Last successful use |
| `createdAt` | timestamp | Key creation time |
| `revokedAt` | timestamp | Null if active; set on revocation |
| `isActive` | boolean | False if revoked |

**Relationships:**
- belongs to one `User`
- has many `McpToolInvocation`

**Storage:** Database (never store raw key — hash only)

**Phase:** 1

---

### 3.13 McpToolInvocation

Audit record of every MCP tool call made by an AI client.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `apiKeyId` | UUID | FK → McpApiKey |
| `toolName` | string | Name of the tool invoked |
| `projectId` | UUID | FK → Project (if applicable) |
| `fileId` | UUID | FK → File (if applicable) |
| `requestPayload` | JSON | Sanitized input (no secrets) |
| `responseStatus` | enum | `Success`, `Unauthorized`, `NotFound`, `Error` |
| `invokedAt` | timestamp | Invocation timestamp |
| `durationMs` | integer | Processing time in milliseconds |

**Relationships:**
- belongs to one `McpApiKey`

**Storage:** Database

**Phase:** 1

---

### 3.14 AIPatchProposal

A proposed change to a source revision, submitted by an AI system and requiring user approval before it creates a new revision.

| Attribute | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `fileId` | UUID | FK → File |
| `baseRevisionId` | UUID | FK → SourceRevision (the revision being patched) |
| `proposedByApiKeyId` | UUID | FK → McpApiKey |
| `patchContent` | text | Unified diff of proposed change |
| `rationale` | text | AI-generated explanation of the change |
| `status` | enum | `Pending`, `Approved`, `Rejected`, `Superseded` |
| `validationStatus` | enum | `NotRun`, `Valid`, `Invalid` |
| `reviewedByUserId` | UUID | FK → User (null until reviewed) |
| `reviewedAt` | timestamp | Null until reviewed |
| `resultingRevisionId` | UUID | FK → SourceRevision (null until approved) |
| `createdAt` | timestamp | Proposal creation time |

**Status transitions:**
```
Pending → Approved → creates SourceRevision
        → Rejected
        → Superseded (if base revision is no longer the latest)
```

**Relationships:**
- belongs to one `File`
- references one `SourceRevision` (base)
- belongs to one `McpApiKey` (proposer)
- reviewed by one `User`
- may produce one `SourceRevision` (result)

**Storage:** Database

**Phase:** 1 (structure only; full AI correction workflow in Phase 3)

---

## 4. Enumerations

### UserRole
```
Admin
StandardUser
Viewer
```

### ParseJobStatus
```
Pending
Running
Completed
Failed
Superseded
```

### SubscriptionStatus
```
Active
PastDue
Cancelled
Trialing
```

### SubscriptionPlan
```
Free
Pro
Enterprise
```

### ValidationSeverity
```
Error
Warning
Info
```

### AIPatchProposalStatus
```
Pending
Approved
Rejected
Superseded
```

### SourceRevisionSource
```
UserEdit
Upload
AIPatchApproved
```

### McpToolResponseStatus
```
Success
Unauthorized
NotFound
Error
```

---

## 5. Artifact Persistence Summary

| Artifact | Persisted | Storage | Notes |
|---|---|---|---|
| User | Yes | Database | |
| Project | Yes | Database | |
| ProjectMember | Yes | Database | |
| File | Yes | Database | Metadata only |
| SourceRevision | Yes | Database + Object Storage | Content in R2; immutable |
| ParseJob | Yes | Database | Lifecycle tracking |
| ParsedModelSnapshot | Yes | Database + Object Storage | Serialized model in R2 |
| ValidationResultSet | Yes | Database | |
| ValidationIssue | Yes | Database | |
| Subscription | Yes | Database | Stripe is source of truth |
| Entitlement | Yes | Database | Derived from subscription |
| McpApiKey | Yes | Database | Raw key never stored |
| McpToolInvocation | Yes | Database | Audit log |
| AIPatchProposal | Yes | Database | |
| RenderViewModel | No | Cache only | Regenerated on demand |

---

## 6. Key Design Decisions

**Immutable source revisions** — every save produces a new revision. Revisions are never modified or deleted. This enables full history, rollback, and reproducible parse/validation results.

**ParseJob as a first-class entity** — tracking parse job lifecycle (including `Superseded`) in the database allows the UI to show parse status accurately and prevents stale results from appearing.

**Parsed model snapshot stored in object storage** — normalized model JSON can be large. Storing it in R2 keeps the database lean and allows efficient retrieval only when needed.

**Render view model is never persisted** — it is always derived from the parsed model snapshot on demand and cached in memory or CDN. This avoids stale render artifacts and keeps storage costs low.

**Entitlement is a derived entity** — it is computed from the subscription plan and stored for fast access checks. It is updated whenever a Stripe webhook arrives. The subscription (and Stripe) is the source of truth.

**AI patches are proposals, not commits** — an `AIPatchProposal` is always stored separately from source revisions. It only becomes a `SourceRevision` when explicitly approved by a user. This enforces the human-in-the-loop requirement.

**MCP API keys are hashed** — raw API keys are shown to the user once at creation and never stored. Only the bcrypt hash is persisted, the same pattern as passwords.

---

## 7. Relationships Diagram (Text)

```
User ────────────────────────────────────────────────────────┐
 │                                                            │
 ├── owns ──► Project ──► File ──► SourceRevision            │
 │              │                      │                      │
 │              │                      └──► ParseJob          │
 │              │                               │             │
 │              │                               └──► ParsedModelSnapshot
 │              │                                        │
 │              │                                        └──► ValidationResultSet
 │              │                                                   │
 │              │                                                   └──► ValidationIssue (many)
 │              │
 │              └──► ProjectMember ◄── User
 │
 ├── has ───► Subscription ──► Entitlement
 │
 ├── has ───► McpApiKey ──► McpToolInvocation (many)
 │
 └── reviews ──► AIPatchProposal ──► SourceRevision (if approved)
                      │
                      └── proposed by ──► McpApiKey
```
