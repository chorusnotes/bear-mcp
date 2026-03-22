import { CHORUS_YAML_FIELD_ORDER } from './config.js';
import { appendTagsToBody } from './utils.js';
import type {
  ChorusConventionsInput,
  ChorusConventionsOutput,
  ChorusValidationResult,
  ChorusViolation,
} from './types.js';

/** Parsed YAML frontmatter: field names in insertion order mapped to raw string values. */
type ParsedFrontmatter = Map<string, string>;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts YAML fields from a `---`-delimited frontmatter block.
 * Only handles flat key: value pairs — no nesting — which is all Chorus needs.
 */
function parseYamlBlock(text: string): ParsedFrontmatter | null {
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') return null;

  const closingIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (closingIdx === -1) return null;

  const fields: ParsedFrontmatter = new Map();
  for (let i = 1; i < closingIdx; i++) {
    const line = lines[i];
    const colonPos = line.indexOf(':');
    if (colonPos === -1) continue;

    const key = line.slice(0, colonPos).trim();
    const value = line.slice(colonPos + 1).trim();
    if (key) fields.set(key, value);
  }

  return fields;
}

/** Splits a comma-separated tag string into a lowercased, trimmed array. */
function parseCsvTags(csv: string | undefined): string[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/** Parses a YAML inline array like `[chorus/questions, chorus]` into a lowercased string array. */
function parseYamlTagsField(value: string): string[] {
  const inner = value.replace(/^\[/, '').replace(/\]$/, '');
  if (!inner.trim()) return [];
  return inner
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns true when a line consists entirely of Bear inline tags.
 * Rejects markdown headers (`# Title` — hash then space).
 */
function isTagLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Must start with # followed by non-space, non-hash to be a tag
  return trimmed.startsWith('#') && trimmed.length > 1 && trimmed[1] !== ' ' && trimmed[1] !== '#';
}

/**
 * Reads inline Bear tags from the trailing lines of a note body.
 * Two-pass per-line parse: first extract `#multi word tag#` (closed), then `#simple` / `#nested/tag`.
 */
function extractInlineTags(text: string): string[] {
  const lines = text.split('\n');
  const tags: string[] = [];

  // Walk backwards collecting tag-only lines
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed === '') continue;
    if (!isTagLine(trimmed)) break;

    // Pass 1: extract closed multi-word tags like #my tag#
    // Closing # must not be followed by a word char (that would be a new tag start like #chorus)
    let remaining = trimmed;
    const closedTagRe = /#([^#]*\s[^#]*)#(?!\w)/g;
    let match;
    while ((match = closedTagRe.exec(remaining)) !== null) {
      tags.push(match[1].trim().toLowerCase());
    }
    remaining = remaining.replace(closedTagRe, '').trim();

    // Pass 2: extract simple/nested tags from whatever remains
    const simpleTagRe = /#([\w/]+)/g;
    while ((match = simpleTagRe.exec(remaining)) !== null) {
      tags.push(match[1].toLowerCase());
    }
  }

  return tags;
}

// ---------------------------------------------------------------------------
// Exported: validation
// ---------------------------------------------------------------------------

/**
 * Validates a note body against the four Chorus structural rules.
 * Designed for post-hoc auditing — tells callers exactly which rules are broken
 * so they can decide whether to reject or auto-fix.
 */
export function validateChorusStructure(text: string): ChorusValidationResult {
  const violations: ChorusViolation[] = [];

  // Rule 1: must start with YAML frontmatter
  const yaml = parseYamlBlock(text);
  if (!yaml) {
    violations.push({
      rule: 'missing_yaml',
      message: 'Note must start with YAML frontmatter (--- delimited)',
    });
  }

  // Rule 2: YAML fields must appear in canonical order
  if (yaml) {
    const keys = [...yaml.keys()];
    const expected = CHORUS_YAML_FIELD_ORDER.filter((f) => keys.includes(f));
    const actual = keys.filter((k) => (CHORUS_YAML_FIELD_ORDER as readonly string[]).includes(k));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      violations.push({
        rule: 'yaml_field_order',
        message: `YAML fields must appear in order: ${CHORUS_YAML_FIELD_ORDER.join(', ')}`,
      });
    }
  }

  // Rule 3: first element after YAML closing `---` must be an H1
  if (yaml) {
    const lines = text.split('\n');
    const closingIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    if (closingIdx !== -1) {
      // Find first non-empty line after closing ---
      let firstContentLine = '';
      for (let i = closingIdx + 1; i < lines.length; i++) {
        if (lines[i].trim() !== '') {
          firstContentLine = lines[i];
          break;
        }
      }
      if (!firstContentLine.startsWith('# ')) {
        violations.push({
          rule: 'missing_h1',
          message: 'First element after YAML frontmatter must be an H1 heading',
        });
      }
    }
  }

  // Rule 4: YAML tags must mirror inline trailing tags
  if (yaml && yaml.has('tags')) {
    const yamlTags = parseYamlTagsField(yaml.get('tags')!).sort();
    const inlineTags = extractInlineTags(text).sort();

    if (JSON.stringify(yamlTags) !== JSON.stringify(inlineTags)) {
      violations.push({
        rule: 'tags_not_mirrored',
        message: 'YAML tags array must mirror the inline Bear tags at end of body',
      });
    }
  }

  return { valid: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------
// Exported: enforcement
// ---------------------------------------------------------------------------

/**
 * Enforces Chorus structure on note creation.
 * Normalizes YAML field order, ensures an H1 heading exists, merges tags from
 * all sources, and delegates inline tag placement to `appendTagsToBody`.
 */
export function applyChorusConventions(input: ChorusConventionsInput): ChorusConventionsOutput {
  const rawText = input.text ?? '';
  const title = input.title?.trim() || 'Untitled';

  // 1. Parse tags from comma-separated param, lowercase
  const paramTags = parseCsvTags(input.tags);

  // 2. Parse existing YAML if present
  const existingYaml = parseYamlBlock(rawText);

  // 3. Merge tags: YAML tags + param tags, deduped
  const yamlTags = existingYaml?.has('tags') ? parseYamlTagsField(existingYaml.get('tags')!) : [];
  const allTags = [...new Set([...yamlTags, ...paramTags])];

  // 4. Build YAML block with fields in canonical order
  const yamlEntries: string[] = [];
  for (const field of CHORUS_YAML_FIELD_ORDER) {
    let value = '';
    if (field === 'tags' && allTags.length > 0) {
      value = `[${allTags.join(', ')}]`;
    } else if (existingYaml?.has(field)) {
      value = existingYaml.get(field)!;
    }
    yamlEntries.push(`${field}: ${value}`);
  }
  const yamlBlock = `---\n${yamlEntries.join('\n')}\n---`;

  // 5. Determine body content (after YAML, or raw text if no YAML)
  let bodyContent: string;
  if (existingYaml) {
    const lines = rawText.split('\n');
    const closingIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    bodyContent = lines
      .slice(closingIdx + 1)
      .join('\n')
      .trim();
  } else {
    bodyContent = rawText.trim();
  }

  // 6. Ensure H1 is present — synthesize from title if missing
  if (!bodyContent.startsWith('# ')) {
    bodyContent = `# ${title}\n\n${bodyContent}`.trim();
  }

  // 7. Assemble YAML + body
  const assembled = `${yamlBlock}\n${bodyContent}`;

  // 8. Append inline tags via shared utility (handles stripping + Bear syntax)
  const finalText = allTags.length > 0 ? appendTagsToBody(assembled, allTags) : assembled;

  return { text: finalText, tags: undefined };
}
