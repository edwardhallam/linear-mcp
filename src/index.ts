#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Config validates LINEAR_API_KEY on import (exits if missing)
import "./config.js";

// Tool definitions (Zod schemas)
import {
  CreateIssueSchema,
  GetIssueSchema,
  UpdateIssueSchema,
  SearchIssuesSchema,
  ListIssuesSchema,
  CreateCommentSchema,
} from "./tools/definitions/issues.js";
import {
  ListTeamsSchema,
  ListProjectsSchema,
  ListIssueStatusesSchema,
  ListLabelsSchema,
} from "./tools/definitions/projects.js";
import {
  GetUserSchema,
  WorkspaceMetadataSchema,
} from "./tools/definitions/workspace.js";

// Tool handlers
import {
  handleCreateIssue,
  handleGetIssue,
  handleUpdateIssue,
  handleSearchIssues,
  handleListIssues,
  handleCreateComment,
} from "./tools/handlers/issues.js";
import {
  handleListTeams,
  handleListProjects,
  handleListIssueStatuses,
  handleListLabels,
} from "./tools/handlers/projects.js";
import {
  handleGetUser,
  handleWorkspaceMetadata,
} from "./tools/handlers/workspace.js";

const server = new McpServer({
  name: "linear-mcp-server",
  version: "1.0.0",
});

// === Issue lifecycle tools ===

server.registerTool(
  "linear_create_issue",
  {
    title: "Create Linear Issue",
    description:
      "Create a new issue in Linear. Requires a team (by ID or name) and title. " +
      "Optionally set project, state, priority (0=None, 1=Urgent, 2=High, 3=Medium, 4=Low), labels, and assignee. " +
      "Accepts both names and IDs for team, project, and state — names are resolved internally.",
    inputSchema: CreateIssueSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async (params) => handleCreateIssue(params)
);

server.registerTool(
  "linear_get_issue",
  {
    title: "Get Linear Issue",
    description:
      'Get a single issue by its identifier (e.g., "GEN-123") or UUID. ' +
      "Returns full issue details including state, assignee, project, labels, and URL.",
    inputSchema: GetIssueSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => handleGetIssue(params)
);

server.registerTool(
  "linear_update_issue",
  {
    title: "Update Linear Issue",
    description:
      "Update an existing issue's fields. Provide the issue ID or identifier plus any fields to change. " +
      "Accepts state name (e.g., 'Done') which is resolved to the correct workflow state ID. " +
      "Set assigneeId to empty string to unassign.",
    inputSchema: UpdateIssueSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => handleUpdateIssue(params)
);

server.registerTool(
  "linear_search_issues",
  {
    title: "Search Linear Issues",
    description:
      "Full-text search across issues. Optionally filter by team, project, assignee, or state name. " +
      "Returns up to `limit` results (default 20, max 50).",
    inputSchema: SearchIssuesSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => handleSearchIssues(params)
);

server.registerTool(
  "linear_list_issues",
  {
    title: "List Linear Issues",
    description:
      "List issues with optional filters for team, project, state, and assignee. " +
      "Supports cursor-based pagination. Returns issues and pageInfo with endCursor for next page.",
    inputSchema: ListIssuesSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => handleListIssues(params)
);

server.registerTool(
  "linear_create_comment",
  {
    title: "Create Linear Comment",
    description:
      'Add a comment to an issue. Provide the issue ID or identifier (e.g., "GEN-123") and comment body (Markdown supported).',
    inputSchema: CreateCommentSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async (params) => handleCreateComment(params)
);

// === Supporting query tools ===

server.registerTool(
  "linear_list_teams",
  {
    title: "List Linear Teams",
    description: "List all teams in the workspace. Returns team ID, name, and key for each.",
    inputSchema: ListTeamsSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async () => handleListTeams()
);

server.registerTool(
  "linear_list_projects",
  {
    title: "List Linear Projects",
    description:
      "List projects, optionally filtered by team (ID or name). " +
      "Returns project ID, name, state, and associated teams.",
    inputSchema: ListProjectsSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => handleListProjects(params)
);

server.registerTool(
  "linear_list_issue_statuses",
  {
    title: "List Linear Issue Statuses",
    description:
      "List workflow states (e.g., Todo, In Progress, Done) for a team. " +
      "Provide team by ID or name. If omitted, returns states for all teams.",
    inputSchema: ListIssueStatusesSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => handleListIssueStatuses(params)
);

server.registerTool(
  "linear_list_labels",
  {
    title: "List Linear Labels",
    description:
      "List issue labels, optionally filtered by team. " +
      "Includes both team-specific and workspace-level labels.",
    inputSchema: ListLabelsSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => handleListLabels(params)
);

server.registerTool(
  "linear_get_user",
  {
    title: "Get Linear User",
    description: "Get the authenticated user's profile information (name, email, admin status).",
    inputSchema: GetUserSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async () => handleGetUser()
);

server.registerTool(
  "linear_workspace_metadata",
  {
    title: "Linear Workspace Metadata",
    description:
      "Get comprehensive workspace metadata in a single call: all teams with their projects, " +
      "workflow states, and labels. Cached for 5 minutes. Use this first to discover IDs needed " +
      "for issue creation instead of calling list_teams + list_projects + list_statuses separately.",
    inputSchema: WorkspaceMetadataSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async () => handleWorkspaceMetadata()
);

// === Start server ===

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Linear MCP server running via stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
