export function utcNow(): string {
    return new Date().toISOString();
}

export function stableSort(value: any): any {
    if (Array.isArray(value)) {
        return value.map(stableSort);
    }
    if (value && typeof value === "object") {
        const sorted: Record<string, any> = {};
        for (const key of Object.keys(value).sort()) {
            sorted[key] = stableSort(value[key]);
        }
        return sorted;
    }
    return value;
}

export function stableStringify(value: any): string {
    return JSON.stringify(stableSort(value), null, 2);
}

