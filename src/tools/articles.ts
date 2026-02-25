import { z } from "zod";
import { HuduClient } from "../hudu-client.js";
import { ok, err } from "./base.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const articleTools = [
  {
    name: "hudu_list_articles",
    description:
      "List KB articles from Hudu. Supports pagination and optional filtering by name or keyword search. Returns id, name, slug, folder_id, and URL for each article.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page: {
          type: "number",
          description: "Page number (default: 1)",
        },
        page_size: {
          type: "number",
          description: "Results per page, max 100 (default: 25)",
        },
        name: {
          type: "string",
          description: "Filter articles whose name contains this string",
        },
        search: {
          type: "string",
          description: "Full-text search query across article content",
        },
      },
    },
  },
  {
    name: "hudu_get_article",
    description:
      "Retrieve a specific KB article by its numeric ID. Returns the full article including content (HTML), name, slug, folder_id, and metadata.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: {
          type: "number",
          description: "Numeric article ID (use hudu_list_articles or hudu_search_articles to find IDs)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "hudu_search_articles",
    description:
      "Search KB articles by keyword. Also useful for finding an article by its URL slug (the part after /kba/ in the Hudu URL). Returns id, name, slug, folder_id, and URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: {
          type: "string",
          description: "Search keyword or URL slug to match against",
        },
        page_size: {
          type: "number",
          description: "Max results to return (default: 25, max: 100)",
        },
      },
      required: ["search"],
    },
  },
  {
    name: "hudu_create_article",
    description:
      "Create a new KB article in Hudu. Content should be HTML. Optionally assign it to a folder (use hudu_list_article_folders to get folder IDs). Returns the created article with its ID and URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Title of the KB article",
        },
        content: {
          type: "string",
          description: "Article body content in HTML format",
        },
        folder_id: {
          type: "number",
          description: "Optional folder ID to place the article in (use hudu_list_article_folders to get IDs)",
        },
      },
      required: ["name", "content"],
    },
  },
  {
    name: "hudu_update_article",
    description:
      "Edit an existing KB article. You can update the title, content, and/or move it to a different folder. Only the fields you provide will be changed. Returns the updated article.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: {
          type: "number",
          description: "Numeric article ID to update",
        },
        name: {
          type: "string",
          description: "New article title (leave out to keep existing)",
        },
        content: {
          type: "string",
          description: "New article content in HTML (leave out to keep existing)",
        },
        folder_id: {
          type: "number",
          description: "New folder ID to move the article to (use hudu_list_article_folders to get IDs)",
        },
      },
      required: ["id"],
    },
  },
] as const;

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ListSchema = z.object({
  page: z.number().optional(),
  page_size: z.number().min(1).max(100).optional(),
  name: z.string().optional(),
  search: z.string().optional(),
});

const GetSchema = z.object({ id: z.number() });

const SearchSchema = z.object({
  search: z.string(),
  page_size: z.number().min(1).max(100).optional(),
});

const CreateSchema = z.object({
  name: z.string().min(1),
  content: z.string().min(1),
  folder_id: z.number().optional(),
});

const UpdateSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  content: z.string().optional(),
  folder_id: z.number().optional(),
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

function summarizeArticle(a: { id: number; name: string; slug: string; folder_id: number | null; url: string }) {
  return { id: a.id, name: a.name, slug: a.slug, folder_id: a.folder_id, url: a.url };
}

export async function handleArticleTool(
  name: string,
  args: Record<string, unknown>,
  client: HuduClient
): Promise<CallToolResult> {
  try {
    switch (name) {
      case "hudu_list_articles": {
        const p = ListSchema.parse(args);
        const articles = await client.listArticles({
          page: p.page,
          page_size: p.page_size,
          name: p.name,
          search: p.search,
        });
        return ok(articles.map(summarizeArticle));
      }

      case "hudu_get_article": {
        const { id } = GetSchema.parse(args);
        const article = await client.getArticle(id);
        return ok(article);
      }

      case "hudu_search_articles": {
        const { search, page_size } = SearchSchema.parse(args);
        const articles = await client.listArticles({ search, page_size: page_size ?? 25 });
        // Also try matching by slug if results are empty
        if (articles.length === 0) {
          const bySlug = await client.listArticles({ name: search, page_size: page_size ?? 25 });
          return ok(bySlug.map(summarizeArticle));
        }
        return ok(articles.map(summarizeArticle));
      }

      case "hudu_create_article": {
        const p = CreateSchema.parse(args);
        const article = await client.createArticle(p);
        return ok(article);
      }

      case "hudu_update_article": {
        const { id, ...updates } = UpdateSchema.parse(args);
        const article = await client.updateArticle(id, updates);
        return ok(article);
      }

      default:
        return err(`Unknown article tool: ${name}`);
    }
  } catch (e) {
    return err(client.formatError(e));
  }
}
