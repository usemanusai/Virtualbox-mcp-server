export type NormalizedVmState = "powered_off" | "saved" | "running" | "paused" | "unknown";

export function normalizeVmState(rawState: string | undefined | null): NormalizedVmState {
    if (!rawState) return "unknown";
    const state = rawState.toLowerCase().trim();

    if (state === "running") return "running";
    if (state === "saved") return "saved";
    if (state === "paused") return "paused";
    if (state === "poweroff" || state === "powered_off" || state === "not_created") return "powered_off";
    if (state === "aborted") return "unknown";
    return "unknown";
}

