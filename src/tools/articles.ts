import { z } from "zod";
import { HuduClient } from "../hudu-client.js";
import { ok, err } from "./base.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const articleTools = [
  {
    name: "hudu_list_articles",
    description:
      "List KB articles from Hudu. Supports pagination and optional filtering by name, keyword search, or company_id (for company-space articles). Returns id, name, slug, folder_id, company_id, and URL for each article.",
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
  {
    name: "hudu_migrate_article_to_company",
    description:
      "Migrate a central KB article into a company-specific KB space. Reads the source article, creates an identical copy in the target company space, and optionally deletes the original. Ideal for bulk migration of client-specific articles from the central KB into company portals. Use hudu_list_companies to find company IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        article_id: {
          type: "number",
          description: "Numeric ID of the source article to migrate",
        },
        company_id: {
          type: "number",
          description: "Numeric ID of the destination company space (use hudu_list_companies to find IDs)",
        },
        delete_original: {
          type: "boolean",
          description: "Whether to delete the original central KB article after copying. Defaults to false. Set to true only when you are sure the migration is complete.",
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
  folder_id: z.number().optional(),
});

const MigrateSchema = z.object({
  article_id: z.number(),
  company_id: z.number(),
  delete_original: z.boolean().optional(),
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
        const article = await client.updateArticle(id, updates);
        return ok(article);
      }

      case "hudu_migrate_article_to_company": {
        const { article_id, company_id, delete_original } = MigrateSchema.parse(args);
        const source = await client.getArticle(article_id);
        const copy = await client.createArticle({
          name: source.name,
          content: source.content,
          company_id,
        });
        const result: Record<string, unknown> = {
          message: `Article "${source.name}" copied to company ${company_id}.`,
          source_id: source.id,
          new_article_id: copy.id,
          new_article_url: copy.url,
          original_deleted: false,
        };
        if (delete_original) {
          await client.deleteArticle(article_id);
          result.original_deleted = true;
          result.message = `Article "${source.name}" migrated to company ${company_id} and original deleted.`;
        }
        return ok(result);
      }

      default:
        return err(`Unknown article tool: ${name}`);
    }
  } catch (e) {
    return err(client.formatError(e));
  }
}
