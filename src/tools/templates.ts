import { z } from "zod";
import { HuduClient } from "../hudu-client.js";
import { ok, err } from "./base.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const templateTools = [
  {
    name: "hudu_list_templates",
    description:
      "List all KB article templates in Hudu. Templates are KB articles flagged for reuse when creating new articles. Returns id, name, slug, and URL for each template.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "hudu_get_template",
    description:
      "Retrieve a specific KB article template by its numeric ID. Returns the full template content (HTML) which can be used as a starting point for a new KB article via hudu_create_article.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: {
          type: "number",
          description: "Numeric template ID (use hudu_list_templates to find IDs)",
        },
      },
      required: ["id"],
    },
  },
] as const;

// ─── Schemas ──────────────────────────────────────────────────────────────────

const GetTemplateSchema = z.object({ id: z.number() });

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleTemplateTool(
  name: string,
  args: Record<string, unknown>,
  client: HuduClient
): Promise<CallToolResult> {
  try {
    switch (name) {
      case "hudu_list_templates": {
        const templates = await client.listTemplates();
        if (templates.length === 0) {
          return ok({
            message:
              "No templates found. In Hudu, mark a KB article as a template via the article editor to use it here.",
            templates: [],
          });
        }
        return ok(
          templates.map((t) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            url: t.url,
          }))
        );
      }

      case "hudu_get_template": {
        const { id } = GetTemplateSchema.parse(args);
        const template = await client.getArticle(id);
        return ok({
          id: template.id,
          name: template.name,
          slug: template.slug,
          content: template.content,
          url: template.url,
          usage_hint:
            "Pass this content (modified as needed) to hudu_create_article to create a new article based on this template.",
        });
      }

      default:
        return err(`Unknown template tool: ${name}`);
    }
  } catch (e) {
    return err(client.formatError(e));
  }
}
