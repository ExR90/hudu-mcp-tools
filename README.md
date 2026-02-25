# Hudu KB MCP — Claude Desktop Plugin

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets Claude Desktop create, retrieve, edit, and organise Knowledge Base articles in your [Hudu](https://www.hudu.com) instance.

Built for MSPs. Works with cloud-hosted and self-hosted Hudu.

---

## What it does

Once installed, Claude can:

- **List and search** all KB articles in your Hudu instance
- **Retrieve** any article by ID or URL slug
- **Create** new KB articles (with optional folder assignment)
- **Edit** existing articles and save them back
- **Use KB templates** — list templates, pull one as a starting point, create a new article from it
- **Browse folders** and assign or move articles between them

---

## Prerequisites

- [Node.js](https://nodejs.org) 18 or later (`node --version` to check)
- [Claude Desktop](https://claude.ai/download) installed
- A Hudu instance (cloud or self-hosted)
- A Hudu API key (see below)

---

## Installation

### 1. Clone and build

```bash
git clone https://github.com/YOUR_USERNAME/hudu-plugin-claude.git
cd hudu-plugin-claude
npm install
npm run build
```

Note the **absolute path** to the project directory — you'll need it in the next step.

### 2. Generate a Hudu API key

1. Log in to your Hudu instance
2. Go to **Admin → API Keys**
3. Click **Create New API Key**
4. Copy the key — you'll only see it once

### 3. Configure Claude Desktop

Open Claude Desktop's config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the following inside the `mcpServers` object (create the file if it doesn't exist):

```json
{
  "mcpServers": {
    "hudu-kb": {
      "command": "node",
      "args": ["/absolute/path/to/hudu-plugin-claude/dist/index.js"],
      "env": {
        "HUDU_BASE_URL": "https://yourcompany.huducloud.com",
        "HUDU_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Replace:
- `/absolute/path/to/hudu-plugin-claude` with the actual path on your machine
- `https://yourcompany.huducloud.com` with your Hudu instance URL (no trailing slash)
- `your-api-key-here` with the API key from step 2

### 4. Restart Claude Desktop

Fully quit Claude Desktop (don't just close the window) and reopen it.

### 5. Verify

In a new Claude conversation, you should see the Hudu tools available. You can test with:

> "List my Hudu KB articles"

---

## Available tools

| Tool | Description |
|---|---|
| `hudu_list_articles` | List KB articles with optional pagination and name/search filter |
| `hudu_get_article` | Get a specific article by numeric ID |
| `hudu_search_articles` | Search articles by keyword or URL slug |
| `hudu_create_article` | Create a new KB article |
| `hudu_update_article` | Edit an existing article's title, content, or folder |
| `hudu_list_templates` | List all KB article templates |
| `hudu_get_template` | Get a template's content to use as a basis for a new article |
| `hudu_list_article_folders` | List all KB article folders |
| `hudu_move_article_to_folder` | Move an article to a different folder |

---

## Finding an article by URL

Hudu KB article URLs look like:

```
https://yourcompany.huducloud.com/kba/c3f1529e3bc6
```

The part after `/kba/` is the article's **slug**. Use `hudu_search_articles` with the slug as the search term to find the article and get its numeric ID.

---

## Example prompts

```
List my Hudu KB article templates.

Use the "Server Setup" template to create a new article called "Windows Server 2025 Setup" with our standard configuration steps.

Find the KB article at /kba/c3f1529e3bc6 and update its content to include a troubleshooting section.

Move the article "VPN Configuration" to the "Networking" folder.
```

---

## Configuration reference

| Environment variable | Required | Description |
|---|---|---|
| `HUDU_BASE_URL` | Yes | Your Hudu instance URL, e.g. `https://yourcompany.huducloud.com` |
| `HUDU_API_KEY` | Yes | API key from Hudu Admin → API Keys |

---

## Development

```bash
# Run in watch mode (no build step needed)
npm run dev

# Type-check without building
npm run type-check

# Test tools interactively with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

When using MCP Inspector, set `HUDU_BASE_URL` and `HUDU_API_KEY` as environment variables in your shell before running.

---

## Troubleshooting

**Tools don't appear in Claude Desktop**
- Make sure you fully quit and restarted Claude Desktop
- Check the config file for JSON syntax errors
- Confirm the path in `args` is the absolute path and the file exists (`dist/index.js`)

**Authentication failed**
- Verify your `HUDU_API_KEY` is correct and has not been revoked
- Check in Hudu Admin → API Keys

**No templates found**
- In Hudu, open a KB article, click the three-dot menu, and select "Set as Template"

**Article type filter returns no templates**
- The Hudu `article_type` field value for templates may differ between Hudu versions. If `hudu_list_templates` returns empty but you have templates in Hudu, open an issue and include your Hudu version.

---

## License

MIT
