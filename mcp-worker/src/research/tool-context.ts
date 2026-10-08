import { ZodError, type ZodType } from "zod";

import type { DataSnapshot } from "../data/artifact-contracts.js";
import type { PublicationReadModel } from "../data/publication-projection.js";
import type { SnapshotIndex } from "../data/snapshot-index.js";
import type { WorkflowVersion } from "../domain/contracts.js";
import { PUBLIC_ERRORS, ResearchHandlerError } from "./handler-error.js";
import { invalidRequestFields, withFieldNames } from "./validation-fields.js";

/** Giới hạn cứng mỗi kết quả: 42 KiB bytes và dưới 40.000 ký tự (giới hạn Dewee). */
export const MAX_RESULT_BYTES = 42 * 1024;
export const MAX_STRUCTURED_CHARS = 40_000;

export interface ProvenanceEntry {
  artifact: string;
  recordId?: string;
  source?: string;
  updatedAt?: string;
  trust?: "untrusted";
}

export interface CommonResultFields {
  releaseId: string;
  dataVersion: string;
  workflowVersion: string;
  provenance: ProvenanceEntry[];
  warnings: string[];
  truncated: boolean;
}

/**
 * Ngữ cảnh một lần gọi tool. Handler không tự load dữ liệu: dispatcher đã dựng
 * snapshot public view (đã loại dữ liệu ẩn) + index và tính workflowVersion.
 */
export interface ToolContext {
  /** Public view của snapshot; `snapshot.publication` chỉ có ở manifest v3. */
  readonly snapshot: DataSnapshot;
  readonly index: SnapshotIndex;
  readonly releaseId: string;
  readonly dataVersion: string;
  readonly workflowVersion: WorkflowVersion;
  /** Read model publication, hoặc ném `CAPABILITY_UNAVAILABLE` (v1/v2 — không bao giờ trả mảng rỗng). */
  publication(): PublicationReadModel;
  /** Phần envelope chung (`releaseId`, `dataVersion`, `workflowVersion`, `provenance`, `warnings`, `truncated:false`). */
  commonResult(provenance?: readonly ProvenanceEntry[]): CommonResultFields;
  /** Nếu client gửi `expectedWorkflowVersion` mà lệch → `WORKFLOW_VERSION_CHANGED` (retryable). */
  ensureExpectedWorkflow(expected: string | undefined): void;
  /** Ép buộc `expectedWorkflowVersion` khi có cursor/confirmationBinding. */
  requireExpectedWorkflow(expected: string | undefined): void;
}

export function createToolContext(snapshot: DataSnapshot, index: SnapshotIndex, workflowVersion: WorkflowVersion): ToolContext {
  const ensure = (expected: string | undefined) => {
    if (expected !== undefined && expected !== workflowVersion) {
      throw new ResearchHandlerError("WORKFLOW_VERSION_CHANGED", PUBLIC_ERRORS.WORKFLOW_VERSION_CHANGED.message, true);
    }
  };
  return {
    snapshot,
    index,
    releaseId: snapshot.releaseId,
    dataVersion: snapshot.dataVersion,
    workflowVersion,
    publication() {
      if (snapshot.publication === undefined) {
        throw new ResearchHandlerError("CAPABILITY_UNAVAILABLE", PUBLIC_ERRORS.CAPABILITY_UNAVAILABLE.message);
      }
      return snapshot.publication;
    },
    commonResult(provenance = []) {
      return {
        releaseId: snapshot.releaseId,
        dataVersion: snapshot.dataVersion,
        workflowVersion,
        provenance: provenance.map((entry) => ({ ...entry })),
        warnings: [...snapshot.warnings],
        truncated: false,
      };
    },
    ensureExpectedWorkflow: ensure,
    requireExpectedWorkflow(expected) {
      if (expected === undefined) {
        throw new ResearchHandlerError(
          "INVALID_REQUEST",
          withFieldNames(PUBLIC_ERRORS.INVALID_REQUEST.message, ["expectedWorkflowVersion"]),
          false,
          ["expectedWorkflowVersion"],
        );
      }
      ensure(expected);
    },
  };
}

/** Parse input bằng schema của tool; lỗi → `INVALID_REQUEST` chỉ kèm tên field. */
export function parseToolInput<T>(schema: ZodType<T>, raw: unknown): T {
  try {
    return schema.parse(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      const fields = invalidRequestFields(error);
      throw new ResearchHandlerError(
        "INVALID_REQUEST",
        withFieldNames(PUBLIC_ERRORS.INVALID_REQUEST.message, fields),
        false,
        fields,
      );
    }
    throw error;
  }
}

const encoder = new TextEncoder();

export function utf8Length(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).byteLength;
}

/** Kết quả hợp lệ phải vừa 42 KiB và dưới 40.000 ký tự; không cắt âm thầm. */
export function enforceResultSize(value: unknown): void {
  const text = JSON.stringify(value);
  if (encoder.encode(text).byteLength > MAX_RESULT_BYTES || text.length >= MAX_STRUCTURED_CHARS) {
    throw new ResearchHandlerError("RESULT_TOO_LARGE", PUBLIC_ERRORS.RESULT_TOO_LARGE.message);
  }
}
