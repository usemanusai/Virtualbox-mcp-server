/**
 * String Utilities for VirtualBox MCP Server
 */

/**
 * Calculates the Levenshtein distance between two strings.
 * This is the minimum number of single-character edits (insertions, deletions, or substitutions)
 * required to change one string into the other.
 * @param a - First string
 * @param b - Second string
 * @returns The Levenshtein distance
 */
export function leven(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    // Create a 2D array to store distances
    const matrix: number[][] = [];

    // Initialize the first row and column
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Finds the closest match to a target string from a list of candidates.
 * Useful for "Did you mean...?" suggestions.
 * @param target - The string to match
 * @param candidates - Array of possible matches
 * @param maxDistance - Maximum acceptable Levenshtein distance (default: 5)
 * @returns The closest match and its distance, or undefined if no match within maxDistance
 */
export function closestMatch(
    target: string,
    candidates: string[],
    maxDistance: number = 5
): { match: string; distance: number } | undefined {
    if (!target || candidates.length === 0) {
        return undefined;
    }

    const normalizedTarget = target.toLowerCase().trim();
    let bestMatch: string | undefined;
    let bestDistance = Infinity;

    for (const candidate of candidates) {
        const normalizedCandidate = candidate.toLowerCase().trim();
        const distance = leven(normalizedTarget, normalizedCandidate);

        if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = candidate;
        }

        // Perfect match - no need to continue
        if (distance === 0) {
            break;
        }
    }

    if (bestMatch && bestDistance <= maxDistance) {
        return { match: bestMatch, distance: bestDistance };
    }

    return undefined;
}

/**
 * Sanitizes a string for use as a filename or identifier.
 * Removes or replaces characters that might cause issues in file systems.
 * @param input - The string to sanitize
 * @param replacement - Character to replace invalid characters with (default: '_')
 * @returns The sanitized string
 */
export function sanitizeForFilename(input: string, replacement: string = '_'): string {
    return input
        .replace(/[^a-zA-Z0-9._-]/g, replacement)
        .replace(new RegExp(`${replacement}+`, 'g'), replacement)
        .replace(new RegExp(`^${replacement}|${replacement}$`, 'g'), '');
}
