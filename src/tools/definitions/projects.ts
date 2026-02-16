import { z } from "zod";

export const ListTeamsSchema = z.object({});

export const ListProjectsSchema = z.object({
  teamId: z.string().optional().describe("Filter projects by team ID"),
  teamName: z.string().optional().describe("Filter projects by team name"),
});

export const ListIssueStatusesSchema = z.object({
  teamId: z.string().optional().describe("Team ID to list statuses for"),
  teamName: z.string().optional().describe("Team name to list statuses for"),
});

export const ListLabelsSchema = z.object({
  teamId: z.string().optional().describe("Filter labels by team ID"),
  teamName: z.string().optional().describe("Filter labels by team name"),
});
