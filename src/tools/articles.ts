import { z } from "zod";
import { HuduClient } from "../hudu-client.js";
import { ok, err } from "./base.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const articleTools = [
  {
    name: "hudu_list_articles",
    description:
      "List KB articles from Hudu. Supports pagination and optional filtering by name, keyword search, or company_id (for company-space articles). Returns id, name, slug, folder_id, company_id, and URL for each article. NOTE: folder_id is NOT a supported filter — to get articles in a specific folder, fetch all articles and filter by folder_id client-side. NOTE: results are paginated (default 25 per page, max 100); to ensure completeness when processing all articles in a folder or KB, increment the page parameter until a page returns fewer results than page_size.",
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
        company_id: {
          type: "number",
          description: "Filter to articles belonging to a specific company space (use hudu_list_companies to find IDs). Omit for central/global KB articles.",
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
      "Create a new KB article in Hudu. Content should be HTML. Optionally assign it to a folder (use hudu_list_article_folders to get folder IDs). To create in a company space instead of the central KB, provide company_id (use hudu_list_companies to find IDs). Returns the created article with its ID and URL.",
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
        company_id: {
          type: "number",
          description: "Optional company ID to create the article in a company-specific KB space instead of the central KB (use hudu_list_companies to find IDs)",
        },
      },
      required: ["name", "content"],
    },
  },
  {
    name: "hudu_update_article",
    description:
      "Edit an existing KB article. You can update the title, content, folder, and/or company association. Only the fields you provide will be changed. To move an article to a company KB, set company_id to the company's numeric ID. To move it back to the central KB, set company_id to null. Returns the updated article.",
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
        company_id: {
          type: ["number", "null"],
          description: "Set to a company ID to move the article into that company's KB, or null to move it to the central KB (use hudu_list_companies to find IDs)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "hudu_migrate_article_to_company",
    description:
      "Move a KB article into a company-specific KB space (or back to central KB). This is an in-place move — history and version logs are fully preserved. Workflow: (1) use hudu_list_companies to find company_id, (2) optionally use hudu_list_article_folders with company_id to find a destination folder_id, (3) call this tool. Use hudu_list_articles with company_id to verify the result.",
    inputSchema: {
      type: "object" as const,
      properties: {
        article_id: {
          type: "number",
          description: "Numeric ID of the article to move",
        },
        company_id: {
          type: ["number", "null"],
          description: "Numeric ID of the destination company space (use hudu_list_companies to find IDs), or null to move to the central KB",
        },
        folder_id: {
          type: "number",
          description: "Optional folder ID within the company space to place the article in. Use hudu_list_article_folders with company_id to find available folder IDs.",
        },
      },
      required: ["article_id", "company_id"],
    },
  },
] as const;

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ListSchema = z.object({
  page: z.number().optional(),
  page_size: z.number().min(1).max(100).optional(),
  name: z.string().optional(),
  search: z.string().optional(),
  company_id: z.number().optional(),
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
  company_id: z.number().optional(),
});

const UpdateSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  content: z.string().optional(),
  folder_id: z.number().nullable().optional(),
  company_id: z.number().nullable().optional(),
});

const MigrateSchema = z.object({
  article_id: z.number(),
  company_id: z.number().nullable(),
  folder_id: z.number().optional(),
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

function summarizeArticle(a: { id: number; name: string; slug: string; folder_id: number | null; company_id: number | null; url: string }) {
  return { id: a.id, name: a.name, slug: a.slug, folder_id: a.folder_id, company_id: a.company_id, url: a.url };
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
          company_id: p.company_id,
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
        // When moving to a company space without specifying a folder, clear any existing
        // central KB folder — Hudu requires folder and article to share the same company.
        if (updates.company_id != null && updates.folder_id === undefined) {
          updates.folder_id = null;
        }
        const article = await client.updateArticle(id, updates);
        return ok(article);
      }

      case "hudu_migrate_article_to_company": {
        const { article_id, company_id, folder_id } = MigrateSchema.parse(args);
        const article = await client.updateArticle(article_id, {
          company_id,
          // Always send folder_id — default null clears any central KB folder.
          // Hudu requires folder and article to share the same company.
          folder_id: folder_id !== undefined ? folder_id : null,
        });
        const destination = company_id === null ? "central KB" : `company ${company_id}`;
        return ok({
          message: `Article "${article.name}" moved to ${destination}. History preserved.`,
          article_id: article.id,
          company_id: article.company_id,
          url: article.url,
        });
      }

      default:
        return err(`Unknown article tool: ${name}`);
    }
  } catch (e) {
    return err(client.formatError(e));
  }
}
