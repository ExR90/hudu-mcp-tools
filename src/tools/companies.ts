import { z } from "zod";
import { HuduClient } from "../hudu-client.js";
import { ok, err } from "./base.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const companyTools = [
  {
    name: "hudu_list_companies",
    description:
      "List companies (clients) in Hudu. Use this to look up a company_id by name before creating or listing company-space KB articles. Returns id, name, and slug for each company.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Filter companies whose name contains this string (case-insensitive)",
        },
        page_size: {
          type: "number",
          description: "Max results to return (default: 100)",
        },
      },
    },
  },
] as const;

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ListSchema = z.object({
  name: z.string().optional(),
  page_size: z.number().min(1).max(100).optional(),
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleCompanyTool(
  name: string,
  args: Record<string, unknown>,
  client: HuduClient
): Promise<CallToolResult> {
  try {
    switch (name) {
      case "hudu_list_companies": {
        const p = ListSchema.parse(args);
        const companies = await client.listCompanies({ name: p.name, page_size: p.page_size });
        return ok(
          companies.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            city: c.city,
            state: c.state,
          }))
        );
      }

      default:
        return err(`Unknown company tool: ${name}`);
    }
  } catch (e) {
    return err(client.formatError(e));
  }
}
