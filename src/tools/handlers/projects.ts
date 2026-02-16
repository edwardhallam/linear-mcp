import { linearClient } from "../../client.js";
import { rateLimited } from "../../rate-limiter.js";
import { formatError, toolResult } from "../../utils/errors.js";
import { getTeams, resolveTeamId, getWorkflowStates } from "../../utils/resolvers.js";

export async function handleListTeams() {
  try {
    const teams = await getTeams();
    return toolResult(JSON.stringify(teams, null, 2));
  } catch (error) {
    return toolResult(formatError(error), true);
  }
}

export async function handleListProjects(params: { teamId?: string; teamName?: string }) {
  try {
    const teamId = await resolveTeamId(params.teamId, params.teamName);
    const projects = await rateLimited(() => linearClient.projects());

    let result = await Promise.all(
      projects.nodes.map(async (p) => {
        const teams = await p.teams();
        return {
          id: p.id,
          name: p.name,
          state: p.state,
          teamIds: teams.nodes.map((t) => t.id),
          teamNames: teams.nodes.map((t) => t.name),
        };
      })
    );

    if (teamId) {
      result = result.filter((p) => p.teamIds.includes(teamId));
    }

    return toolResult(JSON.stringify(result, null, 2));
  } catch (error) {
    return toolResult(formatError(error), true);
  }
}

export async function handleListIssueStatuses(params: { teamId?: string; teamName?: string }) {
  try {
    const teamId = await resolveTeamId(params.teamId, params.teamName);
    const states = await getWorkflowStates(teamId);

    const filtered = teamId ? states.filter((s) => s.teamId === teamId) : states;
    return toolResult(JSON.stringify(filtered, null, 2));
  } catch (error) {
    return toolResult(formatError(error), true);
  }
}

export async function handleListLabels(params: { teamId?: string; teamName?: string }) {
  try {
    const teamId = await resolveTeamId(params.teamId, params.teamName);

    const filter = teamId ? { team: { id: { eq: teamId } } } : undefined;
    const labels = await rateLimited(() => linearClient.issueLabels({ filter }));

    // Also include workspace-level labels (no team filter)
    const workspaceLabels = teamId
      ? await rateLimited(() => linearClient.issueLabels({ filter: { team: { null: true } } }))
      : { nodes: [] };

    const allLabels = [...labels.nodes, ...workspaceLabels.nodes];
    const uniqueLabels = Array.from(new Map(allLabels.map((l) => [l.id, l])).values());

    const result = uniqueLabels.map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
    }));

    return toolResult(JSON.stringify(result, null, 2));
  } catch (error) {
    return toolResult(formatError(error), true);
  }
}
