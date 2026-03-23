# bear-mcp

A hardened [MCP server](https://modelcontextprotocol.io/) for [Bear Notes](https://bear.app) with write verification, structural conventions, and tag management. Part of [Chorus Notes](https://github.com/chorusnotes).

## Why this exists

Bear's x-callback-url API has no write confirmation. You send a command, Bear says nothing back. Every MCP server built on this API — including the one this project grew from — reports success whether the write landed or not. That means silent failures: doubled content, lost tags, appended-instead-of-replaced text, all reported as "success."

bear-mcp reads back from Bear's database after every mutating operation and checks for common failure modes. When something goes wrong, it says so.

## What it does

**Write verification:**
- Post-write read-back checks on all mutating operations
- Tag preservation across full-body replacements
- Section replace via splice (prevents append-instead-of-replace failures)
- Sub-section preservation on parent header replacement
- Ambiguity refusal on title-based lookups (multiple matches → error, not silent pick)

**Structural conventions (optional):**
- Chorus conventions toggle enforces YAML frontmatter → H1 title → body → trailing tags
- Validation on create and upsert-replace rejects malformed notes before writing
- Can be disabled for general Bear use without Chorus structure

**Tools:**
- `bear-open-note` — read full content including OCR from attachments
- `bear-create-note` — create with optional title, content, and tags
- `bear-search-notes` — find by text, tags, or date ranges
- `bear-add-text` — insert at beginning, end, or within a section
- `bear-replace-text` — replace full body or a specific section
- `bear-upsert-note` — create or replace by ID or unique title match
- `bear-add-file` — attach files via base64
- `bear-add-tag` — add tags with deduplication
- `bear-get-tags` — lightweight tag list without loading full body
- `bear-find-untagged-notes` — find notes missing tags
- `bear-list-tags` — hierarchical tag tree
- `bear-rename-tag` / `bear-delete-tag` — tag management
- `bear-archive-note` / `bear-trash-note` — with database verification


## Requirements

- macOS (Bear is Apple-only)
- [Bear](https://bear.app) installed
- Node.js 24.13.0+
- Claude Desktop or any MCP-compatible client

## Install

```bash
git clone https://github.com/chorusnotes/bear-mcp.git
cd bear-mcp
npm install
npm run build
```

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "bear-notes": {
      "command": "node",
      "args": ["/path/to/bear-mcp/dist/main.js"]
    }
  }
}
```

## Known limitations

- Verification uses post-write database polling, which catches most failures but cannot guarantee exact intended post-state. Response language reflects this — "write confirmed" means "checked and no obvious problems found," not "mathematically proven correct."
- Archived notes cannot be trashed directly (Bear's internal filter).
- Attachment rendering after trailing tags is Bear's formatting.
- The Bear database path is hardcoded to the default iCloud location.

## Status

`26.03.23` — actively developed. See the [Chorus Notes org](https://github.com/chorusnotes) for project context.

## License

MIT. See [LICENSE.md](LICENSE.md).

## Acknowledgments

bear-mcp builds on the original Bear Notes MCP server by [Serhii Vasylenko](https://github.com/vasylenko) ([claude-desktop-extension-bear-notes](https://github.com/vasylenko/claude-desktop-extension-bear-notes)). His work provided the foundation — the x-callback-url integration, database reading, and tool structure that made everything else possible.
