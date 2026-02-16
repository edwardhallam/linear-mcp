# linear-mcp-server

A custom MCP (Model Context Protocol) server for [Linear](https://linear.app) using stdio transport. Built for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) to replace the unreliable SSE-based Linear MCP endpoint that times out every ~5 minutes.

## Why

Linear's hosted MCP endpoint (`https://mcp.linear.app/mcp`) uses SSE (Server-Sent Events) transport, which drops connections after periods of inactivity. This server uses stdio transport instead — it runs as a local child process with no network connection to drop.

## Features

- **12 tools** covering the full issue lifecycle: create, get, update, search, list, comment
- **Name-based resolution**: Use `teamName: "Engineering"` instead of looking up UUIDs
- **Workspace metadata**: Single call returns all teams, projects, states, and labels (5-min cache)
- **Rate limiter**: Queue-based, 80 req/min (Linear allows 5,000/hr)
- **LLM-friendly errors**: Recovery hints guide the model toward correct usage

## Installation

```bash
git clone https://github.com/edwardhallam/linear-mcp.git
cd linear-mcp
pnpm install
pnpm build
```

## Configuration

1. Generate a Personal API Key at **Linear Settings > Account > API > Personal API Keys** (starts with `lin_api_`)

2. Add to your Claude Code config (`~/.claude.json`):

```json
{
  "mcpServers": {
    "linear": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/linear-mcp/dist/index.js"],
      "env": {
        "LINEAR_API_KEY": "lin_api_your_key_here"
      }
    }
  }
}
```

3. Restart Claude Code and run `/mcp` to verify the server appears.

## Tools

### Issue Lifecycle

| Tool | Description |
|------|-------------|
| `linear_create_issue` | Create issue with team, project, state, priority, labels |
| `linear_get_issue` | Get by identifier (e.g., "ENG-123") or UUID |
| `linear_update_issue` | Update any field, including state transitions |
| `linear_search_issues` | Full-text search with filters |
| `linear_list_issues` | Paginated list with filters |
| `linear_create_comment` | Add Markdown comment to an issue |

### Supporting Queries

| Tool | Description |
|------|-------------|
| `linear_list_teams` | All workspace teams |
| `linear_list_projects` | Projects, optionally filtered by team |
| `linear_list_issue_statuses` | Workflow states (Todo, In Progress, Done...) |
| `linear_list_labels` | Team + workspace labels |
| `linear_get_user` | Authenticated user info |
| `linear_workspace_metadata` | Everything above in a single cached call |

## Architecture

```
src/
├── index.ts              # McpServer + StdioServerTransport + tool registration
├── config.ts             # API key validation
├── client.ts             # LinearClient singleton
├── rate-limiter.ts       # Queue-based rate limiter
├── tools/
│   ├── definitions/      # Zod schemas (source of truth for tool inputs)
│   └── handlers/         # Implementation logic
└── utils/
    ├── errors.ts         # LLM-friendly error formatting
    ├── pagination.ts     # Cursor-based pagination helper
    └── resolvers.ts      # Name-to-ID resolution with TTL cache
```

## Acknowledgments

Architecture patterns drawn from community Linear MCP servers:

- [tacticlaunch/mcp-linear](https://github.com/tacticlaunch/mcp-linear) — separate definitions/handlers pattern
- [iceener/linear-streamable-mcp-server](https://github.com/iceener/linear-streamable-mcp-server) — workspace metadata discovery tool, LLM-friendly errors
- [jerhadf/linear-mcp-server](https://github.com/jerhadf/linear-mcp-server) — queue-based rate limiter

## License

MIT
