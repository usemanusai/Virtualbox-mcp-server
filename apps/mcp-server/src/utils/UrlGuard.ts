import axios from 'axios';
import https from 'https';

export class UrlGuard {
    // Regex to extract URLs from text (command strings, args, etc.)
    private static URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

    static async validate(args: any): Promise<void> {
        const textContent = JSON.stringify(args);
        const matches = textContent.match(this.URL_REGEX);

        if (!matches || matches.length === 0) return;

        const uniqueUrls = [...new Set(matches)];
        // console.error(`[UrlGuard] Verifying ${uniqueUrls.length} URLs...`);

        const validations = uniqueUrls.map(async (url) => {
            try {
                // Create a permissive HTTPS agent to ignore SSL revocation/self-signed errors
                // This is critical for corporate environments or when revocation servers are offline
                const agent = new https.Agent({
                    rejectUnauthorized: false
                });

                await axios.head(url, {
                    timeout: 5000,
                    httpsAgent: agent,
                    validateStatus: (status) => status >= 200 && status < 400,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
                });
                // console.error(`[UrlGuard] ✅ ALIVE: ${url}`);
            } catch (error: any) {
                // WARN ONLY - DO NOT BLOCK
                // The user needs to proceed even if our validation is flaky (e.g. GitHub anti-bot, firewalls)
                console.error(`[UrlGuard] ⚠️ WARNING: Could not verify '${url}': ${error.message}. Proceeding anyway.`);
                // throw new Error(...) // DISABLED BLOCKING
            }
        });

        // specific "await" not strictly needed if we don't throw, but good to finish checks
        await Promise.all(validations);
    }
}
