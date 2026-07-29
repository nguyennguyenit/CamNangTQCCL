import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import type { ReleasePointer } from "../src/data/artifact-contracts.js";
import { stableStringify } from "../src/domain/contracts.js";
import type {
  ActivationLease,
  ImmutableReleaseStore,
  PointerStore,
} from "./publish-data-release.js";

const RELEASE_KEY_PATTERN =
  /^releases\/[a-f0-9]{64}\/(?:teams|team-tier|coexist|heroes-dict|tactics|books-dict|manifest)\.json$/u;

export interface S3CommandSender {
  send(command: GetObjectCommand | PutObjectCommand): Promise<unknown>;
}

function responseRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function statusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const metadata = responseRecord(
    (error as Record<string, unknown>)["$metadata"],
  );
  return typeof metadata.httpStatusCode === "number"
    ? metadata.httpStatusCode
    : undefined;
}

async function responseBytes(value: unknown): Promise<Uint8Array> {
  const body = responseRecord(value).Body;
  if (
    typeof body !== "object" ||
    body === null ||
    !("transformToByteArray" in body) ||
    typeof body.transformToByteArray !== "function"
  ) {
    throw new Error("R2 object không có body hợp lệ.");
  }
  return new Uint8Array(await body.transformToByteArray());
}

function requireBucket(bucket: string): string {
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u.test(bucket)) {
    throw new Error("Tên R2 bucket không hợp lệ.");
  }
  return bucket;
}

export class S3ImmutableReleaseStore implements ImmutableReleaseStore {
  readonly #sender: S3CommandSender;
  readonly #bucket: string;

  constructor(sender: S3CommandSender, bucket: string) {
    this.#sender = sender;
    this.#bucket = requireBucket(bucket);
  }

  async putIfAbsent(key: string, bytes: Uint8Array) {
    if (!RELEASE_KEY_PATTERN.test(key)) {
      throw new Error("Release key không hợp lệ.");
    }
    try {
      await this.#sender.send(
        new PutObjectCommand({
          Bucket: this.#bucket,
          Key: key,
          Body: bytes,
          IfNoneMatch: "*",
          ContentType: "application/json",
        }),
      );
      return { created: true };
    } catch (error) {
      if (statusCode(error) === 412) return { created: false };
      throw error;
    }
  }

  async read(key: string) {
    if (!RELEASE_KEY_PATTERN.test(key)) {
      throw new Error("Release key không hợp lệ.");
    }
    try {
      const response = await this.#sender.send(
        new GetObjectCommand({
          Bucket: this.#bucket,
          Key: key,
        }),
      );
      return { bytes: await responseBytes(response) };
    } catch (error) {
      if (statusCode(error) === 404) return null;
      throw error;
    }
  }
}

function parsePointer(bytes: Uint8Array): ReleasePointer {
  const value: unknown = JSON.parse(
    new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: false,
    }).decode(bytes),
  );
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Pointer không hợp lệ.");
  }
  const pointer = value as Record<string, unknown>;
  if (
    pointer.schemaVersion !== 1 ||
    typeof pointer.releaseId !== "string" ||
    !/^sha256:[a-f0-9]{64}$/u.test(pointer.releaseId) ||
    pointer.manifestKey !==
      `releases/${pointer.releaseId.slice("sha256:".length)}/manifest.json`
  ) {
    throw new Error("Pointer không hợp lệ.");
  }
  return {
    schemaVersion: 1,
    releaseId: pointer.releaseId as ReleasePointer["releaseId"],
    manifestKey: pointer.manifestKey,
  };
}

export class S3PointerStore implements PointerStore {
  readonly #sender: S3CommandSender;
  readonly #bucket: string;

  constructor(sender: S3CommandSender, bucket: string) {
    this.#sender = sender;
    this.#bucket = requireBucket(bucket);
  }

  async readCurrent() {
    try {
      const response = await this.#sender.send(
        new GetObjectCommand({
          Bucket: this.#bucket,
          Key: "current.json",
        }),
      );
      const record = responseRecord(response);
      if (typeof record.ETag !== "string" || record.ETag === "") {
        throw new Error("Pointer không có ETag.");
      }
      return {
        etag: record.ETag,
        value: parsePointer(await responseBytes(response)),
      };
    } catch (error) {
      if (statusCode(error) === 404) return null;
      throw error;
    }
  }

  async compareAndSwapCurrent(
    expectedEtag: string,
    value: ReleasePointer,
  ) {
    try {
      const response = responseRecord(
        await this.#sender.send(
          new PutObjectCommand({
            Bucket: this.#bucket,
            Key: "current.json",
            Body: new TextEncoder().encode(`${stableStringify(value)}\n`),
            IfMatch: expectedEtag,
            ContentType: "application/json",
          }),
        ),
      );
      if (typeof response.ETag !== "string" || response.ETag === "") {
        throw new Error("Pointer CAS không trả ETag.");
      }
      return { etag: response.ETag };
    } catch (error) {
      if (statusCode(error) === 412) return null;
      throw error;
    }
  }
}

interface ActivationLockRecord {
  schemaVersion: 1;
  state: "held" | "released";
  holderId: string;
  updatedAt: string;
}

export class ActivationLeaseError extends Error {
  constructor(
    readonly code:
      | "LEASE_BUSY"
      | "LEASE_INVALID"
      | "LEASE_ACQUIRE_FAILED"
      | "LEASE_RELEASE_FAILED",
    options?: { cause: unknown },
  ) {
    super("Không thể quản lý activation lease.");
    this.name = "ActivationLeaseError";
    if (options !== undefined) this.cause = options.cause;
  }
}

function parseActivationLock(bytes: Uint8Array): ActivationLockRecord {
  try {
    const value: unknown = JSON.parse(
      new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: false,
      }).decode(bytes),
    );
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("invalid");
    }
    const record = value as Record<string, unknown>;
    const updatedAt = new Date(String(record.updatedAt));
    if (
      record.schemaVersion !== 1 ||
      (record.state !== "held" && record.state !== "released") ||
      typeof record.holderId !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(
        record.holderId,
      ) ||
      typeof record.updatedAt !== "string" ||
      !Number.isFinite(updatedAt.getTime())
    ) {
      throw new Error("invalid");
    }
    return {
      schemaVersion: 1,
      state: record.state,
      holderId: record.holderId,
      updatedAt: updatedAt.toISOString(),
    };
  } catch {
    throw new ActivationLeaseError("LEASE_INVALID");
  }
}

export class S3ActivationLease implements ActivationLease {
  readonly #sender: S3CommandSender;
  readonly #bucket: string;
  readonly holderId: string;
  readonly #now: () => Date;
  readonly #key = "control/activation-lock.json";

  constructor(
    sender: S3CommandSender,
    bucket: string,
    options: {
      holderId: string;
      now?: () => Date;
    },
  ) {
    const holderId = options.holderId;
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(
        holderId,
      )
    ) {
      throw new ActivationLeaseError("LEASE_INVALID");
    }
    this.#sender = sender;
    this.#bucket = requireBucket(bucket);
    this.holderId = holderId;
    this.#now = options.now ?? (() => new Date());
  }

  #record(state: ActivationLockRecord["state"]): ActivationLockRecord {
    const now = this.#now();
    if (!Number.isFinite(now.getTime())) {
      throw new ActivationLeaseError("LEASE_INVALID");
    }
    return {
      schemaVersion: 1,
      state,
      holderId: this.holderId,
      updatedAt: now.toISOString(),
    };
  }

  async #put(
    record: ActivationLockRecord,
    condition: { ifMatch: string } | { ifNoneMatch: "*" },
  ): Promise<string | null> {
    try {
      const response = responseRecord(
        await this.#sender.send(
          new PutObjectCommand({
            Bucket: this.#bucket,
            Key: this.#key,
            Body: new TextEncoder().encode(`${stableStringify(record)}\n`),
            ...("ifMatch" in condition
              ? { IfMatch: condition.ifMatch }
              : { IfNoneMatch: condition.ifNoneMatch }),
            ContentType: "application/json",
          }),
        ),
      );
      return typeof response.ETag === "string" && response.ETag !== ""
        ? response.ETag
        : null;
    } catch (error) {
      if (statusCode(error) === 412) return null;
      throw error;
    }
  }

  async #read(): Promise<{
    etag: string;
    value: ActivationLockRecord;
  } | null> {
    try {
      const response = await this.#sender.send(
        new GetObjectCommand({
          Bucket: this.#bucket,
          Key: this.#key,
        }),
      );
      const record = responseRecord(response);
      if (typeof record.ETag !== "string" || record.ETag === "") {
        throw new ActivationLeaseError("LEASE_INVALID");
      }
      return {
        etag: record.ETag,
        value: parseActivationLock(await responseBytes(response)),
      };
    } catch (error) {
      if (statusCode(error) === 404) return null;
      throw error;
    }
  }

  async #acquire(): Promise<string> {
    try {
      const current = await this.#read();
      if (current?.value.state === "held") {
        throw new ActivationLeaseError("LEASE_BUSY");
      }
      const etag =
        current === null
          ? await this.#put(this.#record("held"), { ifNoneMatch: "*" })
          : await this.#put(this.#record("held"), {
              ifMatch: current.etag,
            });
      if (etag === null) throw new ActivationLeaseError("LEASE_BUSY");
      return etag;
    } catch (error) {
      if (error instanceof ActivationLeaseError) throw error;
      throw new ActivationLeaseError("LEASE_ACQUIRE_FAILED");
    }
  }

  async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const heldEtag = await this.#acquire();
    let operationFailed = false;
    let operationError: unknown;
    try {
      return await operation();
    } catch (error) {
      operationFailed = true;
      operationError = error;
      throw error;
    } finally {
      try {
        const released = await this.#put(this.#record("released"), {
          ifMatch: heldEtag,
        });
        if (released === null) {
          throw new Error("lost ownership");
        }
      } catch {
        throw new ActivationLeaseError(
          "LEASE_RELEASE_FAILED",
          operationFailed ? { cause: operationError } : undefined,
        );
      }
    }
  }
}

export function createR2S3Client(options: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}): S3Client {
  if (
    !/^[a-f0-9]{32}$/u.test(options.accountId) ||
    options.accessKeyId === "" ||
    options.secretAccessKey === ""
  ) {
    throw new Error("Cấu hình R2 credential không hợp lệ.");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${options.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
  });
}
