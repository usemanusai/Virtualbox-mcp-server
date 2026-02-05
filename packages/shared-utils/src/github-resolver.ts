import { Octokit } from "@octokit/rest";

export interface ResolvedAsset {
    url: string;
    name: string;
    size: number;
    download_url: string;
}

/**
 * Resolves GitHub release assets dynamically based on patterns.
 * Useful for downloading tools like Vagrant, VirtualBox installers from GitHub Releases.
 */
export class GitHubAssetResolver {
    private octokit: Octokit;

    constructor(token?: string) {
        this.octokit = new Octokit({ auth: token || process.env.GITHUB_TOKEN });
    }

    /**
     * Gets assets from a specific release or the latest release.
     * @param owner - Repository owner
     * @param repo - Repository name
     * @param tag - Specific tag or 'latest' for the latest release
     * @returns Array of release assets
     */
    async getAssets(owner: string, repo: string, tag: string = "latest"): Promise<ResolvedAsset[]> {
        try {
            let release;
            if (tag === "latest") {
                const res = await this.octokit.repos.getLatestRelease({ owner, repo });
                release = res.data;
            } else {
                const res = await this.octokit.repos.getReleaseByTag({ owner, repo, tag });
                release = res.data;
            }

            return release.assets.map((asset: any) => ({
                url: asset.url,
                name: asset.name,
                size: asset.size,
                download_url: asset.browser_download_url
            }));
        } catch (error: any) {
            console.error(`Failed to get assets from ${owner}/${repo}@${tag}:`, error.message);
            return [];
        }
    }

    /**
     * Finds a specific asset by pattern matching its name.
     * @param owner - Repository owner
     * @param repo - Repository name
     * @param pattern - Regex pattern or string to match asset name
     * @param tag - Specific tag or 'latest'
     * @returns The matched asset or undefined
     */
    async findAsset(
        owner: string,
        repo: string,
        pattern: string | RegExp,
        tag: string = "latest"
    ): Promise<ResolvedAsset | undefined> {
        const assets = await this.getAssets(owner, repo, tag);
        const regex = typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;

        return assets.find((a) => regex.test(a.name));
    }

    /**
     * Gets the download URL for a specific asset.
     * @param owner - Repository owner
     * @param repo - Repository name
     * @param pattern - Regex pattern or string to match asset name
     * @param tag - Specific tag or 'latest'
     * @returns The download URL or undefined
     */
    async getDownloadUrl(
        owner: string,
        repo: string,
        pattern: string | RegExp,
        tag: string = "latest"
    ): Promise<string | undefined> {
        const asset = await this.findAsset(owner, repo, pattern, tag);
        return asset?.download_url;
    }
}
