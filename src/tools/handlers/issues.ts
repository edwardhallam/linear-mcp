import type { z } from "zod";
import { linearClient } from "../../client.js";
import { rateLimited } from "../../rate-limiter.js";
import { formatError, toolResult } from "../../utils/errors.js";
import {
  resolveTeamId,
  resolveProjectId,
  resolveStateId,
  resolveIssueId,
} from "../../utils/resolvers.js";
import type {
  CreateIssueSchema,
  GetIssueSchema,
  UpdateIssueSchema,
  SearchIssuesSchema,
  ListIssuesSchema,
  CreateCommentSchema,
} from "../definitions/issues.js";

// Shared issue formatter
async function formatIssue(issue: {
  id: string;
  identifier: string;
  title: string;
  description?: string | null;
  priority: number;
  url: string;
  createdAt: Date;
  updatedAt: Date;
  state: Promise<{ id: string; name: string; type: string }>;
  assignee: Promise<{ id: string; name: string } | null> | null;
  team: Promise<{ id: string; name: string; key: string }>;
  project: Promise<{ id: string; name: string } | null> | null;
  labels: () => Promise<{ nodes: Array<{ id: string; name: string }> }>;
}) {
  const [state, assignee, team, project, labels] = await Promise.all([
    issue.state,
    issue.assignee,
    issue.team,
    issue.project,
    issue.labels(),
  ]);

  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description ?? undefined,
    priority: issue.priority,
    state: { id: state.id, name: state.name, type: state.type },
    team: { id: team.id, name: team.name, key: team.key },
    assignee: assignee ? { id: assignee.id, name: assignee.name } : null,
    project: project ? { id: project.id, name: project.name } : null,
    labels: labels.nodes.map((l) => ({ id: l.id, name: l.name })),
    url: issue.url,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
  };
}

export async function handleCreateIssue(params: z.infer<typeof CreateIssueSchema>) {
  try {
    const teamId = await resolveTeamId(params.teamId, params.teamName);
    if (!teamId) throw new Error("Either teamId or teamName is required to create an issue.");

    const projectId = await resolveProjectId(params.projectId, params.projectName);
    const stateId = await resolveStateId(params.stateId, params.stateName, teamId);

    const payload = await rateLimited(() =>
      linearClient.createIssue({
        title: params.title,
        description: params.description,
        teamId,
        ...(projectId && { projectId }),
        ...(stateId && { stateId }),
        ...(params.priority !== undefined && { priority: params.priority }),
        ...(params.labelIds && { labelIds: params.labelIds }),
        ...(params.assigneeId && { assigneeId: params.assigneeId }),
      })
    );

    if (!payload.success) {
      return toolResult("Error: Failed to create issue. The API returned an unsuccessful response.", true);
    }

    const issue = await payload.issue;
    if (!issue) {
      return toolResult("Error: Issue was created but could not be retrieved.", true);
    }

    const formatted = await formatIssue(issue as Parameters<typeof formatIssue>[0]);
    return toolResult(JSON.stringify(formatted, null, 2));
  } catch (error) {
    return toolResult(formatError(error), true);
  }
}

export async function handleGetIssue(params: z.infer<typeof GetIssueSchema>) {
  try {
    const issueId = await resolveIssueId(params.identifier);
    const issue = await rateLimited(() => linearClient.issue(issueId));
    const formatted = await formatIssue(issue as Parameters<typeof formatIssue>[0]);
    return toolResult(JSON.stringify(formatted, null, 2));
  } catch (error) {
    return toolResult(formatError(error), true);
  }
}

export async function handleUpdateIssue(params: z.infer<typeof UpdateIssueSchema>) {
  try {
    const issueId = await resolveIssueId(params.issueId);

    // If a teamId is needed for state resolution, get it from the issue
    let teamId: string | undefined;
    if (params.stateName) {
      const issue = await rateLimited(() => linearClient.issue(issueId));
      const team = await issue.team;
      if (team) teamId = team.id;
    }

    const stateId = await resolveStateId(params.stateId, params.stateName, teamId);

    const update: Record<string, unknown> = {};
    if (params.title !== undefined) update.title = params.title;
    if (params.description !== undefined) update.description = params.description;
    if (stateId) update.stateId = stateId;
    if (params.priority !== undefined) update.priority = params.priority;
    if (params.assigneeId !== undefined) {
      update.assigneeId = params.assigneeId === "" ? null : params.assigneeId;
    }
    if (params.labelIds !== undefined) update.labelIds = params.labelIds;

    const payload = await rateLimited(() => linearClient.updateIssue(issueId, update));
    if (!payload.success) {
      return toolResult("Error: Failed to update issue.", true);
    }

    const issue = await payload.issue;
    if (!issue) {
      return toolResult("Error: Issue was updated but could not be retrieved.", true);
    }

    const formatted = await formatIssue(issue as Parameters<typeof formatIssue>[0]);
    return toolResult(JSON.stringify(formatted, null, 2));
  } catch (error) {
    return toolResult(formatError(error), true);
  }
}

export async function handleSearchIssues(params: z.infer<typeof SearchIssuesSchema>) {
  try {
    const teamId = await resolveTeamId(params.teamId, params.teamName);
    const projectId = await resolveProjectId(params.projectId, params.projectName);

    // Build filter
    const filter: Record<string, unknown> = {};
    if (teamId) filter.team = { id: { eq: teamId } };
    if (projectId) filter.project = { id: { eq: projectId } };
    if (params.assigneeId) filter.assignee = { id: { eq: params.assigneeId } };
    if (params.stateName) {
      // Find state ID(s) matching the name
      const states = await import("../../utils/resolvers.js").then((m) => m.getWorkflowStates(teamId));
      const matching = states.filter((s) => s.name.toLowerCase() === params.stateName!.toLowerCase());
      if (matching.length > 0) {
        filter.state = { id: { in: matching.map((s) => s.id) } };
      }
    }

    const hasFilter = Object.keys(filter).length > 0;
    const result = await rateLimited(() =>
      linearClient.issueSearch({
        query: params.query,
        first: params.limit,
        ...(hasFilter && { filter }),
      })
    );

    const issues = await Promise.all(
      result.nodes.map((issue) => formatIssue(issue as Parameters<typeof formatIssue>[0]))
    );

    return toolResult(JSON.stringify({
      total: issues.length,
      issues,
    }, null, 2));
  } catch (error) {
    return toolResult(formatError(error), true);
  }
}

export async function handleListIssues(params: z.infer<typeof ListIssuesSchema>) {
  try {
    const teamId = await resolveTeamId(params.teamId, params.teamName);
    const projectId = await resolveProjectId(params.projectId, params.projectName);
    const stateId = await resolveStateId(params.stateId, params.stateName, teamId);

    const filter: Record<string, unknown> = {};
    if (teamId) filter.team = { id: { eq: teamId } };
    if (projectId) filter.project = { id: { eq: projectId } };
    if (stateId) filter.state = { id: { eq: stateId } };
    if (params.assigneeId) filter.assignee = { id: { eq: params.assigneeId } };

    const hasFilter = Object.keys(filter).length > 0;
    const result = await rateLimited(() =>
      linearClient.issues({
        first: params.limit,
        ...(hasFilter && { filter }),
        ...(params.cursor && { after: params.cursor }),
      })
    );

    const issues = await Promise.all(
      result.nodes.map((issue) => formatIssue(issue as Parameters<typeof formatIssue>[0]))
    );

    return toolResult(JSON.stringify({
      issues,
      pageInfo: {
        hasNextPage: result.pageInfo.hasNextPage,
        endCursor: result.pageInfo.endCursor ?? null,
      },
    }, null, 2));
  } catch (error) {
    return toolResult(formatError(error), true);
  }
}

export async function handleCreateComment(params: z.infer<typeof CreateCommentSchema>) {
  try {
    const issueId = await resolveIssueId(params.issueId);

    const payload = await rateLimited(() =>
      linearClient.createComment({ issueId, body: params.body })
    );

    if (!payload.success) {
      return toolResult("Error: Failed to create comment.", true);
    }

    const comment = await payload.comment;
    if (!comment) {
      return toolResult("Error: Comment was created but could not be retrieved.", true);
    }

    const user = await comment.user;
    return toolResult(JSON.stringify({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      user: user ? { id: user.id, name: user.name } : null,
      issueId,
    }, null, 2));
  } catch (error) {
    return toolResult(formatError(error), true);
  }
}
