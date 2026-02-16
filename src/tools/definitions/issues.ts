import { z } from "zod";

export const CreateIssueSchema = z.object({
  title: z.string().min(1).describe("Issue title"),
  description: z.string().optional().describe("Issue description (Markdown supported)"),
  teamId: z.string().optional().describe("Team ID (UUID). Provide either teamId or teamName"),
  teamName: z.string().optional().describe("Team name (e.g., 'General'). Resolved to ID internally"),
  projectId: z.string().optional().describe("Project ID (UUID). Provide either projectId or projectName"),
  projectName: z.string().optional().describe("Project name (e.g., 'nexus'). Resolved to ID internally"),
  stateId: z.string().optional().describe("Workflow state ID. Use linear_list_issue_statuses to find valid IDs"),
  stateName: z.string().optional().describe("Workflow state name (e.g., 'Todo', 'In Progress'). Resolved to ID internally"),
  priority: z.number().int().min(0).max(4).optional()
    .describe("Priority: 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low"),
  labelIds: z.array(z.string()).optional().describe("Array of label IDs to apply"),
  assigneeId: z.string().optional().describe("Assignee user ID"),
});

export const GetIssueSchema = z.object({
  identifier: z.string().min(1)
    .describe("Issue identifier (e.g., 'GEN-123') or UUID"),
});

export const UpdateIssueSchema = z.object({
  issueId: z.string().min(1).describe("Issue ID (UUID) or identifier (e.g., 'GEN-123')"),
  title: z.string().optional().describe("New title"),
  description: z.string().optional().describe("New description (Markdown)"),
  stateId: z.string().optional().describe("New workflow state ID"),
  stateName: z.string().optional().describe("New workflow state name (e.g., 'Done'). Resolved to ID internally"),
  priority: z.number().int().min(0).max(4).optional()
    .describe("Priority: 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low"),
  assigneeId: z.string().optional().describe("New assignee user ID. Use empty string to unassign"),
  labelIds: z.array(z.string()).optional().describe("Replace all labels with these IDs"),
});

export const SearchIssuesSchema = z.object({
  query: z.string().min(1).describe("Text search query"),
  teamId: z.string().optional().describe("Filter by team ID"),
  teamName: z.string().optional().describe("Filter by team name"),
  projectId: z.string().optional().describe("Filter by project ID"),
  projectName: z.string().optional().describe("Filter by project name"),
  assigneeId: z.string().optional().describe("Filter by assignee user ID"),
  stateName: z.string().optional().describe("Filter by workflow state name (e.g., 'In Progress')"),
  limit: z.number().int().min(1).max(50).default(20).describe("Max results to return"),
});

export const ListIssuesSchema = z.object({
  teamId: z.string().optional().describe("Filter by team ID"),
  teamName: z.string().optional().describe("Filter by team name"),
  projectId: z.string().optional().describe("Filter by project ID"),
  projectName: z.string().optional().describe("Filter by project name"),
  stateId: z.string().optional().describe("Filter by workflow state ID"),
  stateName: z.string().optional().describe("Filter by workflow state name"),
  assigneeId: z.string().optional().describe("Filter by assignee user ID"),
  limit: z.number().int().min(1).max(50).default(20).describe("Max results to return"),
  cursor: z.string().optional().describe("Pagination cursor from previous response"),
});

export const CreateCommentSchema = z.object({
  issueId: z.string().min(1).describe("Issue ID (UUID) or identifier (e.g., 'GEN-123')"),
  body: z.string().min(1).describe("Comment body (Markdown supported)"),
});
