export const WORKER_VERSION_HEADER = "TQCCL-MCP-Worker-Version";

export function isWorkerVersionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(
      value,
    )
  );
}
