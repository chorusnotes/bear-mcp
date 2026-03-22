import { describe, expect, it } from 'vitest';

import { validateChorusStructure } from './note-conventions.js';

const validNote = [
  '---',
  'type: question',
  'summary: What is gravity?',
  'tags: [chorus/questions, chorus]',
  '---',
  '# What is gravity?',
  '',
  'Body content here.',
  '',
  '#chorus/questions #chorus',
].join('\n');

describe('validateChorusStructure', () => {
  it('accepts a valid Chorus note (all 4 rules pass)', () => {
    const result = validateChorusStructure(validNote);

    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('rejects note without YAML frontmatter', () => {
    const note = '# Title\n\nSome body text.\n\n#chorus';
    const result = validateChorusStructure(note);

    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(
      expect.objectContaining({ rule: 'missing_yaml' })
    );
  });

  it('rejects note with wrong YAML field order (summary before type)', () => {
    const note = [
      '---',
      'summary: What is gravity?',
      'type: question',
      'tags: [chorus]',
      '---',
      '# What is gravity?',
      '',
      '#chorus',
    ].join('\n');

    const result = validateChorusStructure(note);

    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(
      expect.objectContaining({ rule: 'yaml_field_order' })
    );
  });

  it('rejects note without H1 after YAML', () => {
    const note = [
      '---',
      'type: question',
      'summary: What is gravity?',
      'tags: [chorus]',
      '---',
      'Just a paragraph, no heading.',
      '',
      '#chorus',
    ].join('\n');

    const result = validateChorusStructure(note);

    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(
      expect.objectContaining({ rule: 'missing_h1' })
    );
  });

  it('rejects note where YAML tags do not mirror inline tags', () => {
    const note = [
      '---',
      'type: question',
      'summary: What is gravity?',
      'tags: [chorus/questions, chorus]',
      '---',
      '# What is gravity?',
      '',
      'Body content here.',
      '',
      '#chorus',
    ].join('\n');

    const result = validateChorusStructure(note);

    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(
      expect.objectContaining({ rule: 'tags_not_mirrored' })
    );
  });

  it('accepts multi-word tags with closing hash (#my tag#)', () => {
    const note = [
      '---',
      'type: question',
      'summary: What is gravity?',
      'tags: [my tag, chorus]',
      '---',
      '# What is gravity?',
      '',
      'Body content here.',
      '',
      '#my tag# #chorus',
    ].join('\n');

    const result = validateChorusStructure(note);

    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('collects multiple violations at once', () => {
    const note = 'Just plain text, nothing structured.';
    const result = validateChorusStructure(note);

    expect(result.valid).toBe(false);
    // At minimum, missing_yaml — other rules only fire when YAML is present
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations).toContainEqual(
      expect.objectContaining({ rule: 'missing_yaml' })
    );
  });

  it('collects field order + missing H1 + tag mismatch together', () => {
    const note = [
      '---',
      'summary: What is gravity?',
      'type: question',
      'tags: [chorus/questions, chorus]',
      '---',
      'No heading here.',
      '',
      '#chorus',
    ].join('\n');

    const result = validateChorusStructure(note);

    expect(result.valid).toBe(false);
    const rules = result.violations.map((v) => v.rule);
    expect(rules).toContain('yaml_field_order');
    expect(rules).toContain('missing_h1');
    expect(rules).toContain('tags_not_mirrored');
  });
});
