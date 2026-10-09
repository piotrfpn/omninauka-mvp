import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/client-state-cleanup.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

export class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

// Independent module globals per synthetic tab, executing the production helper.
export function createClientStateFixture(localStorage = new MemoryStorage()) {
  const listeners = new Map();
  const window = { localStorage, sessionStorage: new MemoryStorage(),
    location: { search: '' },
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: name => listeners.delete(name),
  };
  const revoked = [];
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, window, crypto: webcrypto,
    URL: { createObjectURL: () => 'blob:test-user-image', revokeObjectURL: url => revoked.push(url) },
  });
  return { ...window, window, listeners, helper: module.exports, revoked };
}
