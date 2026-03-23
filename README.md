# bear-mcp

A hardened [MCP server](https://modelcontextprotocol.io/) for [Bear Notes](https://bear.app) with write verification, structural conventions, and tag management. Part of [Chorus Notes](https://github.com/chorusnotes).

Fork of [vasylenko/claude-desktop-extension-bear-notes](https://github.com/vasylenko/claude-desktop-extension-bear-notes).

## What this fork changes

The upstream MCP server reports success on every write regardless of outcome. This fork verifies writes by reading back from Bear's database after each operation and checking for common failure modes: unchanged text, doubled content, and lost tags. When something goes wrong, it says so.

**Write safety:**
- Post-write read-back checks on all mutating operations
- Tag preservation across full-body replacements
- H1 section replace via splice (fixes upstream's append-instead-of-replace bug)
- Sub-section preservation on parent header replacement
- Ambiguity refusal on title-based lookups (multiple matches → error, not silent pick)

**Structural conventions (optional):**
- Chorus conventions toggle enforces YAML frontmatter → H1 title → body → trailing tags
- Validation on create and upsert-replace rejects malformed notes before writing
- Can be disabled for general Bear use without Chorus structure

**Additional tools:**
- `bear-upsert-note` — create or replace by ID or unique title match
- `bear-trash-note` — move to trash with database verification
- `bear-get-tags` — lightweight tag list without loading full note body
- `bear-find-untagged-notes` — find notes missing tags


## Requirements

- macOS (Bear is Apple-only)
- [Bear](https://bear.app) installed
- Node.js 18+
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

- Bear's x-callback-url API has no write confirmation mechanism. Verification uses post-write database polling, which catches most failures but cannot guarantee exact intended post-state. The response language reflects this — "write confirmed" means "checked and no obvious problems found," not "mathematically proven correct."
- Archived notes cannot be trashed directly (Bear's internal filter, not a fork bug).
- Attachment rendering after trailing tags is Bear's formatting, not fork-controlled.
- The Bear database path is hardcoded to the default iCloud location.

## Status

v3.1.0 — actively developed. See the [Chorus Notes org](https://github.com/chorusnotes) for project context.

## License

MIT. See [LICENSE.md](LICENSE.md).

Original work by [Serhii Vasylenko](https://github.com/vasylenko). Fork maintained by [N8K](https://github.com/heyn8k).
