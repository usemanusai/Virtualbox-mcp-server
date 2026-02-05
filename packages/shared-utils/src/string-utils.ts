/**
 * Calculates the Levenshtein distance between two strings.
 * Adapted from 'leven' (MIT License).
 */
export function leven(first: string, second: string): number {
    if (first === second) {
        return 0;
    }

    const swap = first;
    if (first.length > second.length) {
        first = second;
        second = swap;
    }

    let firstLength = first.length;
    let secondLength = second.length;

    while (firstLength > 0 && (first.charCodeAt(firstLength - 1) === second.charCodeAt(secondLength - 1))) {
        firstLength--;
        secondLength--;
    }

    let start = 0;
    while (start < firstLength && (first.charCodeAt(start) === second.charCodeAt(start))) {
        start++;
    }

    firstLength -= start;
    secondLength -= start;

    if (firstLength === 0) {
        return secondLength;
    }

    let bCharacterCode;
    let result;
    let temporary;
    let temporary2;
    let index = 0;
    let index2 = 0;

    const characterCodeCache = [];
    const array = [];

    while (index < firstLength) {
        characterCodeCache[index] = first.charCodeAt(start + index);
        array[index] = ++index;
    }

    while (index2 < secondLength) {
        bCharacterCode = second.charCodeAt(start + index2);
        temporary = index2++;
        result = index2;

        for (index = 0; index < firstLength; index++) {
            temporary2 = bCharacterCode === characterCodeCache[index] ? temporary : temporary + 1;
            temporary = array[index];
            result = array[index] = temporary > result
                ? (temporary2 > result ? result + 1 : temporary2)
                : (temporary2 > temporary ? temporary + 1 : temporary2);
        }
    }

    return result as number;
}

/**
 * Finds the closest match for a target string in a list of candidates.
 */
export function closestMatch(target: string, candidates: string[]): string | undefined {
    if (!candidates || candidates.length === 0) return undefined;

    let bestMatch: string | undefined;
    let minDistance = Infinity;

    for (const candidate of candidates) {
        const distance = leven(target, candidate);
        if (distance < minDistance) {
            minDistance = distance;
            bestMatch = candidate;
        }
    }

    // Only suggest if reasonable similarity (e.g., within 3 edits or 40% length)
    if (minDistance > 3 && minDistance > target.length * 0.4) {
        return undefined;
    }

    return bestMatch;
}
