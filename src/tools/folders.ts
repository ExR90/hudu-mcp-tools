import { z } from "zod";
import { HuduClient } from "../hudu-client.js";
import { ok, err } from "./base.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const folderTools = [
  {
    name: "hudu_list_article_folders",
    description:
      "List all KB article folders in Hudu. Use the returned folder IDs when creating a new article (hudu_create_article) or moving an existing one (hudu_move_article_to_folder).",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "hudu_move_article_to_folder",
    description:
      "Move an existing KB article to a different folder. Use hudu_list_article_folders to get the available folder IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        article_id: {
          type: "number",
          description: "Numeric ID of the article to move",
        },
        folder_id: {
          type: "number",
          description: "Numeric ID of the destination folder",
        },
      },
      required: ["article_id", "folder_id"],
    },
  },
] as const;

// ─── Schemas ──────────────────────────────────────────────────────────────────

const MoveSchema = z.object({
  article_id: z.number(),
  folder_id: z.number(),
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleFolderTool(
  name: string,
  args: Record<string, unknown>,
  client: HuduClient
): Promise<CallToolResult> {
  try {
    switch (name) {
      case "hudu_list_article_folders": {
        const folders = await client.listFolders();
        return ok(
          folders.map((f) => ({
            id: f.id,
            name: f.name,
            description: f.description,
            parent_folder_id: f.parent_folder_id,
          }))
        );
      }

      case "hudu_move_article_to_folder": {
        const { article_id, folder_id } = MoveSchema.parse(args);
        const article = await client.updateArticle(article_id, { folder_id });
        return ok({
          message: `Article "${article.name}" moved to folder ${folder_id}.`,
          article_id: article.id,
          folder_id: article.folder_id,
          url: article.url,
        });
      }

      default:
        return err(`Unknown folder tool: ${name}`);
    }
  } catch (e) {
    return err(client.formatError(e));
  }
}
