import {
  replaceAllInText,
  replaceOccurrence,
} from "../filesystem/filesystem";

export async function readDocumentContent({ tab, read, path }) {
  if (tab) {
    return { content: tab.content, savedContent: tab.savedContent };
  }

  const result = await read(path);
  if (!result.ok) {
    return null;
  }

  return { content: result.content, savedContent: result.content };
}

export async function replaceSingleMatch({
  getDocument,
  read,
  setContent,
  match,
  replacement,
}) {
  const tab = getDocument(match.path);
  const doc = await readDocumentContent({ tab, read, path: match.path });

  if (!doc) {
    return false;
  }

  const next = replaceOccurrence(doc.content, match, replacement);
  if (next === doc.content) {
    return false;
  }

  setContent(match.path, match.name, next, doc.savedContent);
  return true;
}

export async function applyWorkspaceReplaceCore({
  files,
  getDocument,
  read,
  setContent,
  query,
  replacement,
  options,
}) {
  let applied = 0;

  for (const file of files) {
    const tab = getDocument(file.path);
    const doc = await readDocumentContent({ tab, read, path: file.path });

    if (!doc) {
      continue;
    }

    const result = replaceAllInText(doc.content, query, replacement, options);

    if (result.text !== doc.content) {
      setContent(file.path, file.name, result.text, doc.savedContent);
      applied += 1;
    }
  }

  return applied;
}