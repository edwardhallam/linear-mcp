/**
 * Cursor-based pagination helper for Linear SDK connections.
 * Fetches up to maxPages of results, accumulating nodes.
 */

interface LinearConnection<T> {
  nodes: T[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string | null;
  };
}

type FetchFn<T> = (cursor?: string) => Promise<LinearConnection<T>>;

export async function fetchAllPages<T>(
  fetchFn: FetchFn<T>,
  maxPages = 5
): Promise<T[]> {
  const allNodes: T[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const connection = await fetchFn(cursor);
    allNodes.push(...connection.nodes);

    if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) {
      break;
    }
    cursor = connection.pageInfo.endCursor;
  }

  return allNodes;
}
