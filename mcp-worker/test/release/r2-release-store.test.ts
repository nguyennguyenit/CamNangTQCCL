import {
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";

import {
  ActivationLeaseError,
  S3ActivationLease,
  S3ImmutableReleaseStore,
  S3PointerStore,
  type S3CommandSender,
} from "../../scripts/r2-release-store.js";

function body(bytes: Uint8Array) {
  return {
    async transformToByteArray() {
      return bytes;
    },
  };
}

describe("S3ImmutableReleaseStore", () => {
  it("dùng conditional create và chỉ chấp nhận release key", async () => {
    const key =
      "releases/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/manifest.json";
    const commands: unknown[] = [];
    const sender: S3CommandSender = {
      async send(command) {
        commands.push(command);
        if (command instanceof PutObjectCommand) return { ETag: '"created"' };
        return {
          Body: body(new TextEncoder().encode("value")),
          ETag: '"read"',
        };
      },
    };
    const store = new S3ImmutableReleaseStore(sender, "release-bucket");

    await expect(
      store.putIfAbsent(
        key,
        new TextEncoder().encode("value"),
      ),
    ).resolves.toEqual({ created: true });
    await expect(
      store.read(key),
    ).resolves.toMatchObject({ bytes: new TextEncoder().encode("value") });
    expect((commands[0] as PutObjectCommand).input).toMatchObject({
      Bucket: "release-bucket",
      Key: key,
      IfNoneMatch: "*",
    });
    await expect(
      store.putIfAbsent("current.json", new Uint8Array()),
    ).rejects.toThrow();
  });

  it("coi precondition failure là object đã tồn tại", async () => {
    const sender: S3CommandSender = {
      async send() {
        throw Object.assign(new Error("precondition"), {
          $metadata: { httpStatusCode: 412 },
        });
      },
    };
    const store = new S3ImmutableReleaseStore(sender, "release-bucket");
    const key =
      "releases/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/manifest.json";

    await expect(
      store.putIfAbsent(
        key,
        new Uint8Array(),
      ),
    ).resolves.toEqual({ created: false });
  });
});

describe("S3PointerStore", () => {
  it("đọc pointer và CAS đúng current.json bằng If-Match", async () => {
    const commands: unknown[] = [];
    const pointer = {
      schemaVersion: 1 as const,
      releaseId:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const,
      manifestKey:
        "releases/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/manifest.json",
    };
    const sender: S3CommandSender = {
      async send(command) {
        commands.push(command);
        if (command instanceof GetObjectCommand) {
          return {
            Body: body(new TextEncoder().encode(JSON.stringify(pointer))),
            ETag: '"prior"',
          };
        }
        return { ETag: '"next"' };
      },
    };
    const store = new S3PointerStore(sender, "pointer-bucket");

    await expect(store.readCurrent()).resolves.toEqual({
      etag: '"prior"',
      value: pointer,
    });
    await expect(
      store.compareAndSwapCurrent('"prior"', pointer),
    ).resolves.toEqual({ etag: '"next"' });
    expect((commands[1] as PutObjectCommand).input).toMatchObject({
      Bucket: "pointer-bucket",
      Key: "current.json",
      IfMatch: '"prior"',
      ContentType: "application/json",
    });
  });
});

describe("S3ActivationLease", () => {
  it("acquire bằng conditional create, giữ critical section và release bằng ETag CAS", async () => {
    const commands: unknown[] = [];
    let puts = 0;
    const sender: S3CommandSender = {
      async send(command) {
        commands.push(command);
        if (command instanceof GetObjectCommand) {
          throw Object.assign(new Error("missing"), {
            $metadata: { httpStatusCode: 404 },
          });
        }
        puts += 1;
        return { ETag: puts === 1 ? '"held"' : '"released"' };
      },
    };
    const lease = new S3ActivationLease(sender, "pointer-bucket", {
      holderId: "11111111-2222-4333-8444-555555555555",
      now: () => new Date("2026-07-29T01:00:00.000Z"),
    });
    let inside = false;

    await expect(
      lease.runExclusive(async () => {
        inside = true;
        return "done";
      }),
    ).resolves.toBe("done");
    expect(inside).toBe(true);
    expect((commands[1] as PutObjectCommand).input).toMatchObject({
      Bucket: "pointer-bucket",
      Key: "control/activation-lock.json",
      IfNoneMatch: "*",
    });
    expect((commands[2] as PutObjectCommand).input).toMatchObject({
      Bucket: "pointer-bucket",
      Key: "control/activation-lock.json",
      IfMatch: '"held"',
    });
    expect(
      JSON.parse(
        new TextDecoder().decode(
          (commands[2] as PutObjectCommand).input.Body as Uint8Array,
        ),
      ),
    ).toMatchObject({ state: "released" });
  });

  it("từ chối lock đang held và không chạy operation", async () => {
    const sender: S3CommandSender = {
      async send(command) {
        if (command instanceof GetObjectCommand) {
          return {
            ETag: '"other"',
            Body: body(
              new TextEncoder().encode(
                JSON.stringify({
                  schemaVersion: 1,
                  state: "held",
                  holderId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
                  updatedAt: "2026-07-29T00:59:00.000Z",
                }),
              ),
            ),
          };
        }
        throw new Error("unexpected put");
      },
    };
    const lease = new S3ActivationLease(sender, "pointer-bucket", {
      holderId: "11111111-2222-4333-8444-555555555555",
      now: () => new Date("2026-07-29T01:00:00.000Z"),
    });
    let called = false;

    await expect(
      lease.runExclusive(async () => {
        called = true;
      }),
    ).rejects.toMatchObject({
      code: "LEASE_BUSY",
    } satisfies Partial<ActivationLeaseError>);
    expect(called).toBe(false);
  });

  it("CAS-acquire record released và fail closed khi release CAS mất ownership", async () => {
    const commands: unknown[] = [];
    const sender: S3CommandSender = {
      async send(command) {
        commands.push(command);
        if (command instanceof GetObjectCommand) {
          return {
            ETag: '"released-prior"',
            Body: body(
              new TextEncoder().encode(
                JSON.stringify({
                  schemaVersion: 1,
                  state: "released",
                  holderId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
                  updatedAt: "2026-07-29T00:59:00.000Z",
                }),
              ),
            ),
          };
        }
        if (commands.length === 2) return { ETag: '"held-new"' };
        throw Object.assign(new Error("lost ownership"), {
          $metadata: { httpStatusCode: 412 },
        });
      },
    };
    const lease = new S3ActivationLease(sender, "pointer-bucket", {
      holderId: "11111111-2222-4333-8444-555555555555",
      now: () => new Date("2026-07-29T01:00:00.000Z"),
    });

    await expect(
      lease.runExclusive(async () => "mutated"),
    ).rejects.toMatchObject({
      code: "LEASE_RELEASE_FAILED",
    } satisfies Partial<ActivationLeaseError>);
    expect((commands[1] as PutObjectCommand).input).toMatchObject({
      IfMatch: '"released-prior"',
    });
  });

  it("giữ lỗi activation làm cause khi release lock cũng thất bại", async () => {
    const activationError = new Error("activation failed");
    let puts = 0;
    const sender: S3CommandSender = {
      async send(command) {
        if (command instanceof GetObjectCommand) {
          throw Object.assign(new Error("missing"), {
            $metadata: { httpStatusCode: 404 },
          });
        }
        puts += 1;
        if (puts === 1) return { ETag: '"held"' };
        throw Object.assign(new Error("release conflict"), {
          $metadata: { httpStatusCode: 412 },
        });
      },
    };
    const lease = new S3ActivationLease(sender, "pointer-bucket", {
      holderId: "11111111-2222-4333-8444-555555555555",
    });

    await expect(
      lease.runExclusive(async () => {
        throw activationError;
      }),
    ).rejects.toMatchObject({
      code: "LEASE_RELEASE_FAILED",
      cause: activationError,
    });
  });

  it("từ chối malformed lock record và expose holder để correlation", async () => {
    const holderId = "11111111-2222-4333-8444-555555555555";
    const sender: S3CommandSender = {
      async send() {
        return {
          ETag: '"broken"',
          Body: body(new TextEncoder().encode("{}")),
        };
      },
    };
    const lease = new S3ActivationLease(sender, "pointer-bucket", {
      holderId,
    });

    expect(lease.holderId).toBe(holderId);
    await expect(
      lease.runExclusive(async () => undefined),
    ).rejects.toMatchObject({ code: "LEASE_INVALID" });
  });
});
