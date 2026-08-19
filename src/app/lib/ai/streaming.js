export async function* readLineStream(response) {
  if (!response || !response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          yield line;
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore lock release errors
    }
  }

  if (buffer.trim()) {
    yield buffer.trim();
  }
}

export async function* parseJsonLines(response) {
  for await (const line of readLineStream(response)) {
    try {
      yield JSON.parse(line);
    } catch {
      // skip malformed lines
    }
  }
}

export async function collectStreamText(stream) {
  let text = "";

  for await (const chunk of stream) {
    if (chunk && chunk.type === "text" && typeof chunk.text === "string") {
      text += chunk.text;
    } else if (chunk && chunk.type === "error") {
      throw chunk.error;
    }
  }

  return text;
}