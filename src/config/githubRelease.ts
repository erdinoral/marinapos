/** GitHub Releases — electron-builder publish ve app-update.yml ile ayni olmali */
export const GITHUB_RELEASE_OWNER = "erdinoral";
export const GITHUB_RELEASE_REPO = "marinapos";

export function githubReleasesPageUrl(): string {
  return `https://github.com/${GITHUB_RELEASE_OWNER}/${GITHUB_RELEASE_REPO}/releases`;
}
