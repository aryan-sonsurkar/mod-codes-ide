import { describe, expect, it } from "vitest";
import {
  detectRepository,
  summarizeRepository,
} from "./git";

function makeFileHandle(text) {
  return {
    getFile: async () => ({
      size: text.length,
      text: async () => text,
    }),
  };
}

function makeDirHandle(children) {
  return {
    async getDirectoryHandle(name, { create }) {
      if (create || !children[name]) {
        throw new Error("not found");
      }
      return children[name];
    },
    async getFileHandle(name, { create }) {
      if (create) {
        throw new Error("not found");
      }
      const dir = children;
      if (!dir || typeof dir[name] === "undefined") {
        throw new Error("not found");
      }
      return dir[name];
    },
  };
}

function repositoryFixture({ head, refs = {} }) {
  const files = {
    HEAD: makeFileHandle(head),
  };
  const heads = {};
  for (const [ref, hash] of Object.entries(refs)) {
    heads[ref] = makeFileHandle(`${hash}\n`);
  }
  const refsDir = makeDirHandle({ heads: makeDirHandle(heads) });
  return makeDirHandle({ ".git": makeDirHandle({ ...files, refs: refsDir }) });
}

describe("detectRepository", () => {
  it("detects a repository", async () => {
    const root = repositoryFixture({ head: "ref: refs/heads/main\n" });
    expect(await detectRepository(root)).toEqual({
      unsupported: false,
      repository: true,
    });
  });

  it("detects a missing .git", async () => {
    expect(await detectRepository(makeDirHandle({}))).toEqual({
      unsupported: false,
      repository: false,
    });
  });

  it("is unsupported without a handle", async () => {
    expect(await detectRepository(null)).toMatchObject({ unsupported: true });
  });
});

describe("summarizeRepository", () => {
  it("reads branch and HEAD commit", async () => {
    const root = repositoryFixture({
      head: "ref: refs/heads/main\n",
      refs: { main: "0123456789abcdef0123456789abcdef01234567" },
    });

    const summary = await summarizeRepository(root);
    expect(summary.repository).toBe(true);
    expect(summary.branch).toBe("main");
    expect(summary.shortCommit).toBe("0123456");
  });

  it("keeps the ref path when HEAD is detached", async () => {
    const root = repositoryFixture({
      head: "abcdef0123456789abcdef0123456789abcdef01",
    });

    const summary = await summarizeRepository(root);
    expect(summary.repository).toBe(true);
    expect(summary.branch).toBeNull();
    expect(summary.shortCommit).toBe("abcdef0");
  });

  it("reports non-repository", async () => {
    const summary = await summarizeRepository(makeDirHandle({}));
    expect(summary.repository).toBe(false);
    expect(summary.branch).toBeNull();
    expect(summary.shortCommit).toBeNull();
  });
});