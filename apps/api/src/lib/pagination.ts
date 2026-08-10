import { paginationQuerySchema } from "@zxt/shared";

export function parsePagination(request: Request) {
  const url = new URL(request.url);
  return paginationQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
}