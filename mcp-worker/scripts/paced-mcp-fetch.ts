export function createPacedMcpFetcher(options: {
  fetcher?: typeof fetch;
  minimumIntervalMs: number;
  now?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
}): typeof fetch {
  if (!Number.isInteger(options.minimumIntervalMs) || options.minimumIntervalMs < 1) {
    throw new TypeError("Khoảng pacing MCP không hợp lệ.");
  }
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  let lastStart: number | null = null;
  let tail: Promise<void> = Promise.resolve();

  return (input, init) => {
    const request = new Request(input, init);
    if (new URL(request.url).pathname !== "/mcp") {
      return fetcher(request);
    }
    const run = tail.then(async () => {
      if (lastStart !== null) {
        const delayMs = options.minimumIntervalMs - (now() - lastStart);
        if (delayMs > 0) await sleep(delayMs);
      }
      lastStart = now();
      return fetcher(request);
    });
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
