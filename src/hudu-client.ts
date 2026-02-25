import axios, { AxiosInstance, AxiosError } from "axios";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HuduArticle {
  id: number;
  name: string;
  content: string;
  slug: string;
  folder_id: number | null;
  company_id: number | null;
  article_type: number;  // 0 = regular article, 1 = template
  draft: boolean;
  enable_sharing: boolean;
  created_at: string;
  updated_at: string;
  url: string;
}

export interface HuduFolder {
  id: number;
  name: string;
  description: string | null;
  parent_folder_id: number | null;
  company_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ListArticlesParams {
  page?: number;
  page_size?: number;
  name?: string;
  search?: string;
  slug?: string;
  article_type?: number;
}

export interface CreateArticleParams {
  name: string;
  content: string;
  folder_id?: number;
}

export interface UpdateArticleParams {
  name?: string;
  content?: string;
  folder_id?: number | null;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class HuduClient {
  private readonly http: AxiosInstance;

  constructor() {
    const baseUrl = process.env.HUDU_BASE_URL;
    const apiKey = process.env.HUDU_API_KEY;

    if (!baseUrl) {
      throw new Error(
        "HUDU_BASE_URL environment variable is required. " +
        "Set it to your Hudu instance URL, e.g. https://yourcompany.huducloud.com"
      );
    }
    if (!apiKey) {
      throw new Error(
        "HUDU_API_KEY environment variable is required. " +
        "Generate one in Hudu: Admin > API Keys > Create New API Key"
      );
    }

    this.http = axios.create({
      baseURL: `${baseUrl.replace(/\/$/, "")}/api/v1`,
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });
  }

  // ─── Articles ────────────────────────────────────────────────────────────────

  async listArticles(params: ListArticlesParams = {}): Promise<HuduArticle[]> {
    const response = await this.http.get<{ articles: HuduArticle[] }>("/articles", {
      params: {
        page: params.page ?? 1,
        page_size: params.page_size ?? 25,
        ...(params.name && { name: params.name }),
        ...(params.search && { search: params.search }),
        ...(params.article_type !== undefined && { article_type: params.article_type }),
      },
    });
    return response.data.articles ?? [];
  }

  async getArticle(id: number): Promise<HuduArticle> {
    const response = await this.http.get<{ article: HuduArticle }>(`/articles/${id}`);
    return response.data.article;
  }

  async createArticle(params: CreateArticleParams): Promise<HuduArticle> {
    const response = await this.http.post<{ article: HuduArticle }>("/articles", {
      article: {
        name: params.name,
        content: params.content,
        ...(params.folder_id !== undefined && { folder_id: params.folder_id }),
      },
    });
    return response.data.article;
  }

  async updateArticle(id: number, params: UpdateArticleParams): Promise<HuduArticle> {
    const response = await this.http.put<{ article: HuduArticle }>(`/articles/${id}`, {
      article: {
        ...(params.name !== undefined && { name: params.name }),
        ...(params.content !== undefined && { content: params.content }),
        ...(params.folder_id !== undefined && { folder_id: params.folder_id }),
      },
    });
    return response.data.article;
  }

  // ─── Templates ───────────────────────────────────────────────────────────────
  // In Hudu, templates are articles with article_type = 1

  async listTemplates(): Promise<HuduArticle[]> {
    return this.listArticles({ article_type: 1, page_size: 100 });
  }

  // ─── Folders ─────────────────────────────────────────────────────────────────

  async listFolders(): Promise<HuduFolder[]> {
    const response = await this.http.get<{ article_folders: HuduFolder[] }>("/article_folders", {
      params: { page_size: 100 },
    });
    return response.data.article_folders ?? [];
  }

  // ─── Error helper ─────────────────────────────────────────────────────────────

  formatError(error: unknown): string {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const message = error.response?.data?.message ?? error.response?.data ?? error.message;
      if (status === 401) return "Authentication failed. Check your HUDU_API_KEY.";
      if (status === 403) return "Access denied. Your API key may lack the required permissions.";
      if (status === 404) return `Not found (HTTP 404). ${message}`;
      if (status === 422) return `Validation error: ${JSON.stringify(message)}`;
      return `Hudu API error (HTTP ${status}): ${JSON.stringify(message)}`;
    }
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
