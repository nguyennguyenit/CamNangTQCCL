import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import { ARTIFACT_NAMES } from "../../src/data/artifact-contracts.js";
import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import {
  MAX_MANIFEST_BYTES,
  StaticAssetsDataSource,
  type AssetFetcher,
} from "../../src/data/static-assets-data-source.js";

const fixtureRoot = new URL("../fixtures/release-snapshot/", import.meta.url);
const assetNames = [
  "manifest.json",
  ...ARTIFACT_NAMES.map((name) => `${name}.json`),
];

async function fixtureAssets(): Promise<Map<string, Uint8Array>> {
  return new Map(
    await Promise.all(
      assetNames.map(async (name) => [
        `/${name}`,
        new Uint8Array(await readFile(new URL(name, fixtureRoot))),
      ] as const),
    ),
  );
}

function mapFetcher(
  assets: ReadonlyMap<string, Uint8Array>,
  paths: string[] = [],
): AssetFetcher {
  return {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      paths.push(path);
      const bytes = assets.get(path);
      return bytes === undefined
        ? new Response(null, { status: 404 })
        : new Response(bytes.slice(), {
            status: 200,
            headers: { "Content-Length": String(bytes.byteLength) },
          });
    },
  };
}

describe("StaticAssetsDataSource", () => {
  it("đạt parity với filesystem và chỉ fetch bảy fixed path một lần", async () => {
    const paths: string[] = [];
    const source = new StaticAssetsDataSource({
      fetcher: mapFetcher(await fixtureAssets(), paths),
    });
    const filesystem = await new FilesystemDataSource({
      dataRoot: new URL("../fixtures/release-snapshot", import.meta.url).pathname,
    }).load();

    const first = await source.load();
    const second = await source.load();

    expect(first).toEqual(filesystem);
    expect(second).toBe(first);
    expect(paths).toEqual(assetNames.map((name) => `/${name}`));
  });

  it("fail closed khi asset thiếu, redirect, JSON sai hoặc content-length quá lớn", async () => {
    const valid = await fixtureAssets();
    const cases: AssetFetcher[] = [
      mapFetcher(new Map([...valid].filter(([path]) => path !== "/teams.json"))),
      {
        fetch: async () =>
          new Response(null, {
            status: 302,
            headers: { Location: "https://private.example/asset" },
          }),
      },
      mapFetcher(
        new Map(valid).set(
          "/manifest.json",
          new TextEncoder().encode("{bad json"),
        ),
      ),
      {
        fetch: async () =>
          new Response("[]", {
            headers: {
              "Content-Length": String(MAX_MANIFEST_BYTES + 1),
            },
          }),
      },
    ];

    for (const fetcher of cases) {
      await expect(
        new StaticAssetsDataSource({ fetcher }).load(),
      ).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });
    }
  });

  it("cancel stream ngay khi body chunked vượt hard cap", async () => {
    const cancel = vi.fn(async () => undefined);
    const fetcher: AssetFetcher = {
      async fetch() {
        let sent = false;
        return new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              if (sent) return;
              sent = true;
              controller.enqueue(new Uint8Array(MAX_MANIFEST_BYTES + 1));
            },
            cancel,
          }),
          { status: 200 },
        );
      },
    };

    await expect(
      new StaticAssetsDataSource({ fetcher }).load(),
    ).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("không chấp nhận manifest key ngoài allowlist dù fetcher có dữ liệu", async () => {
    const assets = await fixtureAssets();
    const manifest = JSON.parse(
      new TextDecoder().decode(assets.get("/manifest.json")!),
    );
    manifest.artifacts[0].key = "../teams.json";
    assets.set(
      "/manifest.json",
      new TextEncoder().encode(JSON.stringify(manifest)),
    );
    const paths: string[] = [];

    await expect(
      new StaticAssetsDataSource({ fetcher: mapFetcher(assets, paths) }).load(),
    ).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });
    expect(paths).toEqual(["/manifest.json"]);
  });

  it("fail closed với UTF-8, digest, count, content-length, followed redirect và stream error", async () => {
    const invalidUtf8 = await fixtureAssets();
    invalidUtf8.set("/manifest.json", new Uint8Array([0xff]));

    const digestMismatch = await fixtureAssets();
    digestMismatch.set("/teams.json", new TextEncoder().encode("[]"));

    const countMismatch = await fixtureAssets();
    const countManifest = JSON.parse(
      new TextDecoder().decode(countMismatch.get("/manifest.json")!),
    );
    countManifest.artifacts[0].count += 1;
    countMismatch.set(
      "/manifest.json",
      new TextEncoder().encode(JSON.stringify(countManifest)),
    );

    const redirected = new Response("{}", { status: 200 });
    Object.defineProperty(redirected, "redirected", { value: true });

    const cases: AssetFetcher[] = [
      mapFetcher(invalidUtf8),
      mapFetcher(digestMismatch),
      mapFetcher(countMismatch),
      {
        fetch: async () =>
          new Response("{}", {
            status: 200,
            headers: { "Content-Length": "01" },
          }),
      },
      { fetch: async () => redirected },
      {
        fetch: async () =>
          new Response(
            new ReadableStream<Uint8Array>({
              pull(controller) {
                controller.error(new Error("stream failed"));
              },
            }),
            { status: 200 },
          ),
      },
    ];

    for (const fetcher of cases) {
      await expect(
        new StaticAssetsDataSource({ fetcher }).load(),
      ).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });
    }
  });
});
