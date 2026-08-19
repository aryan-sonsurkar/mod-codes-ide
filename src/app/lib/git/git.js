export const GIT_CAPABILITIES = {
  metadata: {
    available: true,
    label: "Repository metadata",
    detail: "Detect .git and read branch + HEAD commit from .git metadata.",
  },
  status: {
    available: false,
    label: "File status",
    detail: "Staged/modified/untracked status requires a native git binary.",
  },
  diff: {
    available: false,
    label: "Diffs",
    detail: "Viewing diffs requires a native git binary.",
  },
  staging: {
    available: false,
    label: "Staging & commits",
    detail: "Staging, committing, and history require a native git binary.",
  },
};

const HEAD_PREFIX = "ref: ";
const BRANCH_PREFIX = "refs/heads/";

function normalizeRef(ref) {
  let path = ref
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");

  if (path.startsWith(BRANCH_PREFIX)) {
    path = path.slice(BRANCH_PREFIX.length);
  }

  return path;
}

function parseHead(content) {
  const text = (content || "").trim();
  if (text.startsWith(HEAD_PREFIX)) {
    return { branch: normalizeRef(text.slice(HEAD_PREFIX.length)) };
  }
  if (/^[0-9a-f]{40}$/i.test(text)) {
    return { branch: null, detached: text.slice(0, 7) };
  }
  return { branch: null };
}

async function readFileFromDir(directoryHandle, segments) {
  let current = directoryHandle;
  for (let i = 0; i < segments.length - 1; i += 1) {
    current = await current.getDirectoryHandle(segments[i], { create: false });
  }
  const fileHandle = await current.getFileHandle(
    segments[segments.length - 1],
    { create: false }
  );
  const file = await fileHandle.getFile();
  if (file.size > 64 * 1024) {
    return null;
  }
  return await file.text();
}

async function readEntryText(directoryHandle, gitPath) {
  if (!directoryHandle || typeof gitPath !== "string") {
    return null;
  }

  const segments = gitPath.split("/").filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  try {
    return await readFileFromDir(directoryHandle, segments);
  } catch {
    return null;
  }
}

export async function detectRepository(rootHandle) {
  if (!rootHandle) {
    return { unsupported: true, repository: false };
  }

  try {
    await rootHandle.getDirectoryHandle(".git", { create: false });
    return { unsupported: false, repository: true };
  } catch {
    return { unsupported: false, repository: false };
  }
}

export async function summarizeRepository(rootHandle) {
  const detection = await detectRepository(rootHandle);
  if (detection.unsupported || !detection.repository) {
    return {
      unsupported: detection.unsupported,
      repository: false,
      branch: null,
      shortCommit: null,
    };
  }

  const head = await readEntryText(rootHandle, ".git/HEAD");
  const parsed = parseHead(head);
  let shortCommit = null;

  if (parsed.branch) {
    const refContent = await readEntryText(rootHandle, `.git/refs/heads/${parsed.branch}`);
    if (refContent && /^[0-9a-f]{40}$/i.test(refContent.trim())) {
      shortCommit = refContent.trim().slice(0, 7);
    }
  }

  return {
    unsupported: false,
    repository: true,
    branch: parsed.branch,
    shortCommit: parsed.detached || shortCommit,
  };
}