/**
 * Shared utilities for resolving human-readable names to Linear IDs.
 * Accepts both names and IDs — passes IDs through unchanged.
 */

import { linearClient } from "../client.js";
import { rateLimited } from "../rate-limiter.js";

// Simple TTL cache for team/project/state lookups
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.data as T;
  cache.delete(key);
  return undefined;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
}

interface TeamInfo {
  id: string;
  name: string;
  key: string;
}

export async function getTeams(): Promise<TeamInfo[]> {
  const cached = getCached<TeamInfo[]>("teams");
  if (cached) return cached;

  const teams = await rateLimited(() => linearClient.teams());
  const result = teams.nodes.map((t) => ({ id: t.id, name: t.name, key: t.key }));
  setCache("teams", result);
  return result;
}

export async function resolveTeamId(teamId?: string, teamName?: string): Promise<string | undefined> {
  if (teamId) return teamId;
  if (!teamName) return undefined;

  const teams = await getTeams();
  const match = teams.find(
    (t) => t.name.toLowerCase() === teamName.toLowerCase() || t.key.toLowerCase() === teamName.toLowerCase()
  );
  if (!match) throw new Error(`Team not found: "${teamName}". Available teams: ${teams.map((t) => t.name).join(", ")}`);
  return match.id;
}

export async function resolveProjectId(projectId?: string, projectName?: string, teamId?: string): Promise<string | undefined> {
  if (projectId) return projectId;
  if (!projectName) return undefined;

  const cacheKey = `projects:${teamId ?? "all"}`;
  let projects = getCached<Array<{ id: string; name: string }>>(cacheKey);

  if (!projects) {
    const result = await rateLimited(() => linearClient.projects());
    projects = result.nodes.map((p) => ({ id: p.id, name: p.name }));
    setCache(cacheKey, projects);
  }

  const match = projects.find((p) => p.name.toLowerCase() === projectName.toLowerCase());
  if (!match) throw new Error(`Project not found: "${projectName}". Available projects: ${projects.map((p) => p.name).join(", ")}`);
  return match.id;
}

interface StateInfo {
  id: string;
  name: string;
  type: string;
  teamId: string;
}

export async function getWorkflowStates(teamId?: string): Promise<StateInfo[]> {
  const cacheKey = `states:${teamId ?? "all"}`;
  const cached = getCached<StateInfo[]>(cacheKey);
  if (cached) return cached;

  const filter = teamId ? { team: { id: { eq: teamId } } } : undefined;
  const states = await rateLimited(() => linearClient.workflowStates({ filter }));
  const result: StateInfo[] = [];
  for (const s of states.nodes) {
    const team = await s.team;
    if (!team) continue;
    result.push({ id: s.id, name: s.name, type: s.type, teamId: team.id });
  }
  setCache(cacheKey, result);
  return result;
}

export async function resolveStateId(stateId?: string, stateName?: string, teamId?: string): Promise<string | undefined> {
  if (stateId) return stateId;
  if (!stateName) return undefined;

  const states = await getWorkflowStates(teamId);
  const match = states.find((s) => {
    const nameMatch = s.name.toLowerCase() === stateName.toLowerCase();
    const teamMatch = !teamId || s.teamId === teamId;
    return nameMatch && teamMatch;
  });
  if (!match) {
    const available = states
      .filter((s) => !teamId || s.teamId === teamId)
      .map((s) => s.name);
    throw new Error(`State not found: "${stateName}". Available states: ${[...new Set(available)].join(", ")}`);
  }
  return match.id;
}

/**
 * Resolve an issue identifier (e.g., "GEN-123") or UUID to an issue UUID.
 * If it looks like a UUID already, returns it directly.
 */
export async function resolveIssueId(identifier: string): Promise<string> {
  // UUID pattern
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)) {
    return identifier;
  }

  // Team key + number pattern (e.g., GEN-123)
  const result = await rateLimited(() =>
    linearClient.issueSearch({ query: identifier, first: 1 })
  );
  if (result.nodes.length === 0) {
    throw new Error(`Issue not found: "${identifier}". Verify the identifier format (e.g., "GEN-123").`);
  }
  return result.nodes[0]!.id;
}
