import { Octokit } from "@octokit/rest";
import { logger } from "./logger.js";

export interface GitHubAssetInfo {
    name: string;
    url: string;
    size: number;
    downloadCount: number;
    createdAt: string;
    contentType: string;
}

export class GitHubAssetResolver {
    private octokit: Octokit;

    constructor(auth?: string) {
        this.octokit = new Octokit({
            auth: auth || process.env.GITHUB_TOKEN
        });
    }

    /**
     * Resolves a valid download URL for a file in a GitHub release.
     * @param owner - Repository owner (e.g., "KOWX712")
     * @param repo - Repository name (e.g., "PlayIntegrityFix")
     * @param pattern - Regex or glob-style pattern to match the asset filename
     * @param tag - Release tag (default: "latest")
     */
    async resolveAsset(
        owner: string,
        repo: string,
        pattern: string,
        tag: string = "latest"
    ): Promise<GitHubAssetInfo | null> {
        try {
            logger.info(`Resolving asset for ${owner}/${repo} (Tag: ${tag}, Pattern: ${pattern})`);

            let release;
            if (tag === "latest") {
                const response = await this.octokit.rest.repos.getLatestRelease({
                    owner,
                    repo
                });
                release = response.data;
            } else {
                const response = await this.octokit.rest.repos.getReleaseByTag({
                    owner,
                    repo,
                    tag
                });
                release = response.data;
            }

            if (!release.assets || release.assets.length === 0) {
                logger.warn(`No assets found for ${owner}/${repo} release ${tag}`);
                return null;
            }

            const regex = new RegExp(pattern, "i");
            const asset = release.assets.find(a => regex.test(a.name));

            if (!asset) {
                logger.warn(`No asset matches pattern "${pattern}" in ${owner}/${repo} release ${tag}`);
                return null;
            }

            return {
                name: asset.name,
                url: asset.browser_download_url,
                size: asset.size,
                downloadCount: asset.download_count,
                createdAt: asset.created_at,
                contentType: asset.content_type
            };
        } catch (error: any) {
            logger.error(`GitHub API error resolving asset for ${owner}/${repo}`, error);
            if (error.status === 404) {
                throw new Error(`Repository or Release not found: ${owner}/${repo} (${tag})`);
            }
            throw error;
        }
    }
}
