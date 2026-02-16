import { linearClient } from "../../client.js";
import { rateLimited } from "../../rate-limiter.js";
import { formatError, toolResult } from "../../utils/errors.js";
import { getTeams, getWorkflowStates } from "../../utils/resolvers.js";

export async function handleGetUser() {
  try {
    const user = await rateLimited(() => linearClient.viewer);
    return toolResult(JSON.stringify({
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      email: user.email,
      admin: user.admin,
      active: user.active,
    }, null, 2));
  } catch (error) {
    return toolResult(formatError(error), true);
  }
}

// Cache for workspace metadata (5-min TTL)
let metadataCache: { data: string; expires: number } | null = null;

export async function handleWorkspaceMetadata() {
  try {
    if (metadataCache && metadataCache.expires > Date.now()) {
      return toolResult(metadataCache.data);
    }

    const [teams, projects, labels] = await Promise.all([
      getTeams(),
      rateLimited(() => linearClient.projects()),
      rateLimited(() => linearClient.issueLabels()),
    ]);

    // Get workflow states per team
    const teamsWithStates = await Promise.all(
      teams.map(async (team) => {
        const states = await getWorkflowStates(team.id);
        return {
          id: team.id,
          name: team.name,
          key: team.key,
          states: states
            .filter((s) => s.teamId === team.id)
            .map((s) => ({ id: s.id, name: s.name, type: s.type })),
        };
      })
    );

    // Map projects to their teams
    const projectList = await Promise.all(
      projects.nodes.map(async (p) => {
        const pTeams = await p.teams();
        return {
          id: p.id,
          name: p.name,
          state: p.state,
          teamIds: pTeams.nodes.map((t) => t.id),
        };
      })
    );

    const result = JSON.stringify({
      teams: teamsWithStates.map((team) => ({
        ...team,
        projects: projectList.filter((p) => p.teamIds.includes(team.id)),
      })),
      labels: labels.nodes.map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color,
      })),
    }, null, 2);

    metadataCache = { data: result, expires: Date.now() + 5 * 60 * 1000 };
    return toolResult(result);
  } catch (error) {
    return toolResult(formatError(error), true);
  }
}
