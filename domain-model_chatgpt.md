# Domain Model
## systemodel.com SysML v2 Web Platform

This document defines the core domain model for the systemodel SysML v2 web platform.

The purpose of this document is to establish the main business entities, their responsibilities, and their relationships for Phase 1 of the platform.

This domain model is intended to support:

- authenticated multi-user access
- project and file management
- SysML source revisioning
- parser and validation workflows
- graphical view generation
- AI and MCP access foundations
- entitlement-aware product behavior

This document focuses on **Phase 1** and identifies where later-phase extensions are expected.

---

# 1. Domain Model Principles

The domain model must follow these principles:

- source text is the authoritative authored artifact
- parsed semantic artifacts are derived from source revisions
- validation and rendering operate on derived artifacts
- model changes must be revisioned and traceable
- AI changes must be proposed, validated, and approved before commit
- billing and entitlements must be separate from model semantics
- each entity should have a clear ownership and lifecycle

---

# 2. Domain Model Overview

The core Phase 1 domain consists of the following entity groups:

## 2.1 Identity and Access

- User
- Role
- Permission
- Membership
- Session
- ApiToken
- McpToken

## 2.2 Project and Workspace

- Project
- ProjectSettings
- Folder
- ModelFile

## 2.3 Source and Revision Control

- SourceRevision
- RevisionStatus
- RevisionAuthor

## 2.4 Parsing and Semantic Model

- ParseJob
- ParsedModelSnapshot
- ModelElement
- ModelRelationship
- ElementLocation
- ParserVersion

## 2.5 Validation and Diagnostics

- ValidationRun
- Diagnostic
- DiagnosticCategory
- DiagnosticSeverity
- ValidatorVersion

## 2.6 Graphical View Layer

- ViewDefinition
- RenderJob
- RenderViewModel
- ViewNode
- ViewEdge
- ViewWarning

## 2.7 AI and MCP

- PatchProposal
- PatchOperation
- ProposalValidationResult
- ToolInvocation
- AuditEvent

## 2.8 Billing and Entitlements

- Plan
- Subscription
- Entitlement
- BillingEvent

---

# 3. Identity and Access Domain

# 3.1 User

Represents a person who can access the platform.

Attributes:

- id
- email
- displayName
- passwordHash or externalAuthId
- status
- createdAt
- updatedAt
- lastLoginAt

Rules:

- a user may belong to multiple projects
- a user may hold different roles in different projects
- a user may create source revisions, patch proposals, and API tokens

---

# 3.2 Role

Represents a named access role.

Phase 1 roles:

- Admin
- StandardUser
- Viewer

Attributes:

- id
- key
- name
- description

Rules:

- roles define permission groupings
- roles are assigned through Membership

---

# 3.3 Permission

Represents a capability that can be granted through a role.

Examples:

- project.create
- project.delete
- file.read
- file.write
- patch.approve
- billing.manage
- mcp.token.create

Attributes:

- id
- key
- description

Rules:

- permissions are not assigned directly in normal Phase 1 flows
- permissions are mapped to roles centrally

---

# 3.4 Membership

Represents a user’s access to a project.

Attributes:

- id
- userId
- projectId
- roleId
- createdAt
- createdBy

Rules:

- a user can have at most one active membership per project
- membership determines project-scoped permissions
- deleting membership removes project access but does not delete authored artifacts

---

# 3.5 Session

Represents an authenticated login session.

Attributes:

- id
- userId
- issuedAt
- expiresAt
- revokedAt
- clientMetadata

Rules:

- sessions are revocable
- session lifecycle is independent from project membership

---

# 3.6 ApiToken

Represents an API access token for non-MCP integration use.

Attributes:

- id
- userId
- name
- tokenHash
- createdAt
- expiresAt
- revokedAt
- scopes

Rules:

- tokens must be scoped
- plaintext token values must never be stored after creation

---

# 3.7 McpToken

Represents a token used for MCP-based tool access.

Attributes:

- id
- userId
- name
- tokenHash
- createdAt
- expiresAt
- revokedAt
- scopes

Rules:

- MCP tokens must be auditable
- MCP tokens should have stricter scope controls than standard API tokens

---

# 4. Project and Workspace Domain

# 4.1 Project

Represents the main container for model work.

Attributes:

- id
- name
- slug
- description
- ownerUserId
- status
- createdAt
- updatedAt

Rules:

- a project contains folders, files, revisions, diagnostics, and view definitions
- project access is controlled through membership
- project-level settings influence parser and validation behavior

---

# 4.2 ProjectSettings

Represents configurable settings for a project.

Attributes:

- id
- projectId
- parserProfile
- validationProfile
- defaultViewType
- featureFlags
- createdAt
- updatedAt

Rules:

- project settings are mutable
- settings must be version-safe and validated
- project settings must not overwrite historical revision behavior

---

# 4.3 Folder

Represents an optional organizational container within a project.

Attributes:

- id
- projectId
- parentFolderId
- name
- path
- createdAt
- updatedAt

Rules:

- folders are organizational only
- folders do not change semantic model behavior
- nested folders are allowed

---

# 4.4 ModelFile

Represents a logical SysML source file tracked by the platform.

Attributes:

- id
- projectId
- folderId
- fileName
- fileType
- currentRevisionId
- createdAt
- updatedAt
- archivedAt

Rules:

- a model file has many revisions
- only one revision is the current revision at a time
- archived files remain auditable

---

# 5. Source and Revision Domain

# 5.1 SourceRevision

Represents an immutable saved revision of a model file’s source text.

Attributes:

- id
- modelFileId
- revisionNumber
- content
- contentHash
- authoredByUserId
- createdAt
- sourceType
- parentRevisionId

Rules:

- source revision is the authoritative authored artifact
- source revisions are immutable after creation
- every save creates a new revision
- accepted AI patches create new source revisions rather than mutating old ones

---

# 5.2 RevisionStatus

Represents the processing state of a source revision.

Suggested states:

- DRAFT
- SAVED
- PARSE_PENDING
- PARSE_RUNNING
- PARSE_SUCCEEDED
- PARSE_FAILED
- SUPERSEDED

Attributes:

- id
- sourceRevisionId
- status
- updatedAt
- reason

Rules:

- status changes are append-only or fully auditable
- newer revisions may supersede older parse states

---

# 5.3 RevisionAuthor

Represents authorship metadata for a revision.

Attributes:

- id
- sourceRevisionId
- actorType
- userId
- toolInvocationId
- createdAt

Rules:

- actorType may be USER or AI_ASSISTED
- AI-assisted changes must still resolve to an approving user

---

# 6. Parsing and Semantic Model Domain

# 6.1 ParseJob

Represents a parsing request for a source revision.

Attributes:

- id
- sourceRevisionId
- parserVersionId
- status
- queuedAt
- startedAt
- completedAt
- failureReason
- supersededByRevisionId

Statuses:

- PENDING
- RUNNING
- COMPLETED
- FAILED
- SUPERSEDED

Rules:

- each parse job targets exactly one source revision
- a newer revision may supersede a still-running parse job
- only the latest successful parse for the current revision should drive rendering

---

# 6.2 ParsedModelSnapshot

Represents the normalized semantic model derived from a source revision.

Attributes:

- id
- sourceRevisionId
- parseJobId
- parserVersionId
- createdAt
- snapshotHash
- rootModelId
- metadata

Rules:

- parsed model snapshots are derived artifacts
- snapshots are immutable after generation
- validation and viewer logic operate on snapshots, not raw source text

---

# 6.3 ModelElement

Represents a semantic element inside a parsed model snapshot.

Attributes:

- id
- snapshotId
- elementKey
- elementType
- name
- qualifiedName
- properties
- parentElementId

Rules:

- model elements exist only within a specific snapshot
- element identifiers should be stable within snapshot scope
- later phases may introduce stronger cross-revision identity mapping

---

# 6.4 ModelRelationship

Represents a semantic relationship between model elements.

Attributes:

- id
- snapshotId
- relationshipType
- sourceElementId
- targetElementId
- properties

Rules:

- relationships are snapshot-scoped
- relationships must reference elements within the same snapshot

---

# 6.5 ElementLocation

Represents the mapping from semantic elements back to source text.

Attributes:

- id
- snapshotId
- elementId
- fileId
- revisionId
- startLine
- startColumn
- endLine
- endColumn

Rules:

- element location supports diagnostics and editor synchronization
- locations must point to the exact source revision that produced the snapshot

---

# 6.6 ParserVersion

Represents the parser/runtime version used for a parse.

Attributes:

- id
- version
- compatibilityProfile
- releaseDate
- notes

Rules:

- parser version must be recorded for every parse job and snapshot
- this enables reproducibility and controlled upgrades

---

# 7. Validation and Diagnostics Domain

# 7.1 ValidationRun

Represents a deterministic validation execution against a parsed model snapshot.

Attributes:

- id
- snapshotId
- validatorVersionId
- startedAt
- completedAt
- resultSummary

Rules:

- validation runs are immutable after completion
- multiple validation runs may exist for a single snapshot if rule sets evolve

---

# 7.2 Diagnostic

Represents a validation or parse issue.

Attributes:

- id
- validationRunId or parseJobId
- code
- category
- severity
- message
- relatedElementId
- locationId
- metadata

Rules:

- diagnostics must be structured and reproducible
- diagnostics should support stable codes for filtering and UX grouping

---

# 7.3 DiagnosticCategory

Represents the type of issue.

Phase 1 examples:

- Syntax
- Semantic
- Relationship
- ViewSupport
- ValidationRule

Attributes:

- key
- label
- description

---

# 7.4 DiagnosticSeverity

Represents issue severity.

Phase 1 values:

- ERROR
- WARNING
- INFO

Rules:

- severity influences UI behavior but does not change source truth

---

# 7.5 ValidatorVersion

Represents the rule engine or rule-pack version.

Attributes:

- id
- version
- rulePackName
- releaseDate
- notes

Rules:

- validator version must be recorded for reproducibility

---

# 8. Graphical View Domain

# 8.1 ViewDefinition

Represents a user- or system-defined view request.

Attributes:

- id
- projectId
- modelFileId
- sourceRevisionId
- snapshotId
- viewType
- options
- createdByUserId
- createdAt

Rules:

- a view definition references a specific artifact context
- Phase 1 views are read-only and generated from parsed snapshots

---

# 8.2 RenderJob

Represents a request to generate a graphical view model.

Attributes:

- id
- viewDefinitionId
- status
- startedAt
- completedAt
- failureReason

Statuses:

- PENDING
- RUNNING
- COMPLETED
- FAILED

Rules:

- render jobs operate on parsed snapshots
- render jobs must not parse source directly

---

# 8.3 RenderViewModel

Represents the derived graph structure used by the frontend viewer.

Attributes:

- id
- renderJobId
- snapshotId
- createdAt
- layoutMetadata
- warningSummary

Rules:

- render view models are derived artifacts
- they may be cached but are not authoritative

---

# 8.4 ViewNode

Represents a node in a render view model.

Attributes:

- id
- renderViewModelId
- sourceElementId
- nodeType
- label
- position
- size
- style

Rules:

- view nodes must reference semantic elements when possible

---

# 8.5 ViewEdge

Represents an edge in a render view model.

Attributes:

- id
- renderViewModelId
- sourceRelationshipId
- edgeType
- sourceNodeId
- targetNodeId
- label
- routingMetadata

Rules:

- view edges must reference semantic relationships when possible

---

# 8.6 ViewWarning

Represents warnings related to view generation.

Examples:

- unsupported construct omitted
- layout fallback applied
- partial rendering only

Attributes:

- id
- renderViewModelId
- code
- message
- relatedElementId

Rules:

- view warnings are part of the user-visible transparency model

---

# 9. AI and MCP Domain

# 9.1 PatchProposal

Represents a proposed set of source changes generated by a user workflow or AI tool.

Attributes:

- id
- projectId
- modelFileId
- baseRevisionId
- proposedByActorType
- proposedByUserId
- toolInvocationId
- summary
- rationale
- status
- createdAt
- reviewedAt
- reviewedByUserId

Statuses:

- PENDING_REVIEW
- VALIDATED
- REJECTED
- APPROVED
- EXPIRED

Rules:

- a patch proposal never mutates source directly
- approved proposals create a new source revision
- rejected proposals remain auditable

---

# 9.2 PatchOperation

Represents an atomic change inside a patch proposal.

Attributes:

- id
- patchProposalId
- operationType
- targetRange
- beforeText
- afterText
- orderIndex

Rules:

- patch operations must be deterministic and replayable
- operations are ordered

---

# 9.3 ProposalValidationResult

Represents the validation result of a proposed patch before approval.

Attributes:

- id
- patchProposalId
- temporarySnapshotId
- validationRunId
- summary
- createdAt

Rules:

- proposal validation is separate from committed revision validation
- it exists to support safe review and approval

---

# 9.4 ToolInvocation

Represents an AI or MCP tool action performed against the system.

Attributes:

- id
- actorType
- userId
- tokenId
- toolName
- inputSummary
- status
- startedAt
- completedAt

Rules:

- all tool invocations must be auditable
- sensitive input should be summarized safely rather than logged verbatim where necessary

---

# 9.5 AuditEvent

Represents an auditable system event.

Examples:

- revision created
- parse started
- parse failed
- patch proposed
- patch approved
- token created
- billing event received

Attributes:

- id
- eventType
- actorType
- actorUserId
- relatedEntityType
- relatedEntityId
- metadata
- createdAt

Rules:

- audit events are append-only
- audit data should support operational and compliance needs

---

# 10. Billing and Entitlements Domain

# 10.1 Plan

Represents a product plan.

Phase 1 examples:

- Free
- Pro
- AdminInternal

Attributes:

- id
- key
- name
- description
- featureLimits
- active

Rules:

- plans define entitlement envelopes
- plan logic must remain separate from model semantics

---

# 10.2 Subscription

Represents a billing relationship for a user or future organization account.

Attributes:

- id
- subscriberType
- subscriberId
- planId
- provider
- providerSubscriptionId
- status
- startedAt
- renewedAt
- endedAt

Rules:

- a subscription controls billing-backed entitlements
- subscription state should be derived from provider events plus internal status rules

---

# 10.3 Entitlement

Represents a concrete capability enabled for an account.

Examples:

- maxProjects
- aiPatchProposalEnabled
- advancedViewAccess
- mcpAccessEnabled

Attributes:

- id
- ownerType
- ownerId
- key
- value
- sourcePlanId
- effectiveFrom
- effectiveTo

Rules:

- entitlements should be evaluated at runtime
- entitlements may come from plan defaults or explicit overrides

---

# 10.4 BillingEvent

Represents an external provider billing event recorded by the system.

Attributes:

- id
- provider
- providerEventId
- eventType
- receivedAt
- processedAt
- status
- payloadSummary

Rules:

- billing events are auditable
- processing must be idempotent

---

# 11. Core Relationships

The most important Phase 1 entity relationships are:

- User has many Memberships
- Project has many Memberships
- Project has many Folders
- Project has many ModelFiles
- ModelFile has many SourceRevisions
- SourceRevision has many ParseJobs
- SourceRevision may have one or more ParsedModelSnapshots
- ParsedModelSnapshot has many ModelElements
- ParsedModelSnapshot has many ModelRelationships
- ParsedModelSnapshot has many ValidationRuns
- ValidationRun has many Diagnostics
- ViewDefinition references one ParsedModelSnapshot
- RenderJob belongs to one ViewDefinition
- RenderViewModel belongs to one RenderJob
- PatchProposal references one base SourceRevision
- Approved PatchProposal creates one new SourceRevision
- Project or User may have one or more Entitlements
- User may have ApiTokens and McpTokens
- ToolInvocation may produce PatchProposal records and AuditEvents

---

# 12. Aggregate Boundaries

Phase 1 should treat the following as the main aggregates.

## 12.1 Project Aggregate

Root:

- Project

Includes:

- ProjectSettings
- Membership
- Folder
- ModelFile

Purpose:

- workspace management and access scoping

---

## 12.2 Model File Aggregate

Root:

- ModelFile

Includes:

- SourceRevision
- RevisionStatus
- ParseJob
- ParsedModelSnapshot
- ValidationRun
- Diagnostic
- ViewDefinition
- RenderJob
- RenderViewModel

Purpose:

- full lifecycle of an authored model file

---

## 12.3 Patch Proposal Aggregate

Root:

- PatchProposal

Includes:

- PatchOperation
- ProposalValidationResult

Purpose:

- safe AI or assisted change review workflow

---

## 12.4 Billing Aggregate

Root:

- Subscription

Includes:

- Plan
- Entitlement
- BillingEvent

Purpose:

- feature access and monetization control

---

# 13. Lifecycle Notes

## 13.1 Model Authoring Lifecycle

1. user creates or opens a model file
2. user saves source text
3. new source revision is created
4. parse job is created
5. parsed model snapshot is generated if successful
6. validation run executes
7. diagnostics are produced
8. view definition may trigger render job
9. render view model is generated

---

## 13.2 AI-Assisted Change Lifecycle

1. AI tool invocation occurs
2. patch proposal is created
3. proposal validation runs
4. user reviews result
5. user approves or rejects
6. if approved, a new source revision is created

---

## 13.3 Billing and Access Lifecycle

1. user account is created
2. default plan or entitlement state is assigned
3. subscription changes update entitlements
4. access checks occur at runtime for protected features

---

# 14. Phase 1 Required Entities

The following entities are required in Phase 1:

- User
- Role
- Membership
- Session
- Project
- ProjectSettings
- Folder
- ModelFile
- SourceRevision
- RevisionStatus
- ParseJob
- ParsedModelSnapshot
- ModelElement
- ModelRelationship
- ElementLocation
- ParserVersion
- ValidationRun
- Diagnostic
- ValidatorVersion
- ViewDefinition
- RenderJob
- RenderViewModel
- ViewNode
- ViewEdge
- ViewWarning
- PatchProposal
- PatchOperation
- ProposalValidationResult
- ToolInvocation
- AuditEvent
- Plan
- Subscription
- Entitlement
- BillingEvent

---

# 15. Later-Phase Extension Candidates

The following entities are likely to be added in later phases:

- Organization
- Team
- Comment
- Review
- CollaborativeEditSession
- DiagramLayoutProfile
- SimulationDefinition
- SimulationRun
- Requirement
- TraceLink
- ModelTemplate
- ImportExportJob
- Notification
- UsageMetric

These are intentionally excluded from Phase 1 to keep the initial system manageable.

---

# 16. Domain Constraints

The domain must enforce these constraints:

- source revisions are immutable
- parsed snapshots are immutable
- diagnostics are tied to exact parse or validation runs
- render view models are derived and non-authoritative
- patch proposals must never directly modify committed source
- all user and AI actions affecting models must be auditable
- project-scoped access must be enforced consistently
- entitlement checks must be centralized

---

# 17. Suggested ID and Timestamp Conventions

Recommended conventions:

- use stable unique IDs for all entities
- use UTC timestamps for all temporal fields
- record createdAt on every persistent entity
- record updatedAt only on mutable entities
- record reviewedAt, completedAt, revokedAt, or processedAt where lifecycle-specific

---

# 18. Summary

This domain model defines the core entities and relationships required for Phase 1 of the systemodel SysML v2 platform.

It establishes a model where:

- source text is authoritative
- semantic and graphical artifacts are derived
- validation is reproducible
- AI changes are controlled and reviewable
- billing is separated from modeling semantics
- all critical workflows are traceable

This domain model should be used as the foundation for:

- database schema design
- API contract design
- service boundary design
- validation strategy
- MCP tool design
- repository implementation planning
