import { telefuncAction } from "@/server/telefunc-action";
import { requireAdmin } from "@/server/telefunc-context";

const REPOSITORY_API_URL = "https://api.github.com/repos/mobaiit/catshop/contents/package.json?ref=main";
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

async function internalOnCheckRepositoryVersion() {
  const { runtime } = requireAdmin();
  const token = typeof runtime.GITHUB_TOKEN === "string" ? runtime.GITHUB_TOKEN.trim() : "";
  if (!token) throw new Error("github_token_unavailable");

  const response = await fetch(REPOSITORY_API_URL, {
    headers: {
      Accept: "application/vnd.github.raw+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "Catshop-Update-Checker",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "error",
  });
  if (!response.ok) throw new Error(`github_repository_unavailable:${response.status}`);

  const packageInfo = await response.json() as { version?: unknown };
  if (typeof packageInfo.version !== "string" || !VERSION_PATTERN.test(packageInfo.version)) throw new Error("github_version_invalid");
  return { version: packageInfo.version, repositoryUrl: "https://github.com/mobaiit/catshop" };
}

export const onCheckRepositoryVersion = telefuncAction(internalOnCheckRepositoryVersion);
