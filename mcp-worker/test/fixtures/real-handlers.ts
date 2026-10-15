import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import { createResearchHandlers, type ResearchHandlers } from "../../src/research/research-handlers.js";
import { repositoryDataRoot } from "./publication-sources.js";

let shared: ResearchHandlers | undefined;

/** Handlers trên raw checkout của repo: snapshot v3 thật (publication read model). */
export function realHandlers(): ResearchHandlers {
  shared ??= createResearchHandlers({ dataSource: new FilesystemDataSource({ dataRoot: repositoryDataRoot }) });
  return shared;
}

let publication: Promise<NonNullable<Awaited<ReturnType<FilesystemDataSource["load"]>>["publication"]>> | undefined;

/** Read model của raw checkout, nạp một lần cho cả file test. */
export function realPublication() {
  publication ??= new FilesystemDataSource({ dataRoot: repositoryDataRoot }).load().then((snapshot) => snapshot.publication!);
  return publication;
}
