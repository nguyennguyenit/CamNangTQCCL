import { defineConfig } from "astro/config";

const PRIVATE_ARTIFACT_PATH = /(?:^|\/)(?:pipeline\/lookup(?:-|\/)|data\/sgsdeck(?:\/|$))/iu;

function decodedRequestPath(url = "/") {
  const pathname = new URL(url, "http://localhost").pathname.replaceAll("\\", "/");
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function denyPrivateArtifacts() {
  return {
    name: "deny-private-artifacts",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!PRIVATE_ARTIFACT_PATH.test(decodedRequestPath(request.url))) {
          next();
          return;
        }
        response.statusCode = 404;
        response.end("Not Found");
      });
    },
  };
}

export default defineConfig({
  site: "https://tqccl.com",
  output: "static",
  vite: {
    plugins: [denyPrivateArtifacts()],
  },
});
