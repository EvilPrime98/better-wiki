import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const root = new URL('../../', import.meta.url);
const cwd = fileURLToPath(root);
const cliPath = fileURLToPath(new URL('bin/cli.ts', root));

const run = (...args: string[]) =>
  spawnSync(process.execPath, ['--import', 'tsx', cliPath, ...args], { cwd, encoding: 'utf8' });

describe('better-wiki CLI', () => {
  it('prints the package version', () => {
    const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as {
      version: string;
    };
    const res = run('--version');
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe(version);
  });

  it('prints help when no command is given', () => {
    const res = run();
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Usage:');
    expect(res.stdout).toContain('character-appearances');
  });

  it('exits 2 when no --plugin or --url is provided', () => {
    const res = run('page', 'x');
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('Provide --plugin');
  });

  it('exits 2 on an unknown command', () => {
    const res = run('-u', 'https://example.fandom.com', 'nope');
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('Unknown command');
  });

  it('exits 2 on an unknown plugin', () => {
    const res = run('-p', 'nope', 'page', 'x');
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('Unknown plugin');
  });

  it('exits 2 when a plugin command is used without --plugin', () => {
    const res = run('-u', 'https://example.fandom.com', 'comic', 'x');
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('requires --plugin');
  });

  it('rejects --fields for plugins other than dc-fandom', () => {
    const res = run('-p', 'marvel-fandom', 'comic', 'x', '--fields', 'title');
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('--fields is only supported');
  });

  it('rejects a non-numeric page ID', () => {
    const res = run('-u', 'https://example.fandom.com', 'content', 'abc');
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('numeric page ID');
  });
});
