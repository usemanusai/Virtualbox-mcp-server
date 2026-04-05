import { normalizeVmState, type NormalizedVmState } from "./vm-state.js";
import { utcNow } from "./json-utils.js";

export interface VmStateRecord {
    managedBy?: string;
    name: string;
    state: NormalizedVmState;
}

export interface VmStateSnapshot {
    observed_at_utc: string;
    vms: VmStateRecord[];
}

export class VmStateCache {
    private stateByVm = new Map<string, { state: NormalizedVmState; observedAtMs: number }>();
    private snapshot: { data: VmStateSnapshot; observedAtMs: number } | null = null;

    constructor(private readonly ttlMs: number = 2000) { }

    getCachedState(vmName: string): NormalizedVmState | null {
        const found = this.stateByVm.get(vmName);
        if (!found) return null;
        if (Date.now() - found.observedAtMs > this.ttlMs) return null;
        return found.state;
    }

    setState(vmName: string, state: string): NormalizedVmState {
        const normalized = normalizeVmState(state);
        this.stateByVm.set(vmName, { state: normalized, observedAtMs: Date.now() });
        return normalized;
    }

    getSnapshot(): VmStateSnapshot | null {
        if (!this.snapshot) return null;
        if (Date.now() - this.snapshot.observedAtMs > this.ttlMs) return null;
        return this.snapshot.data;
    }

    setSnapshot(vms: Array<{ name: string; state: string; managedBy?: string }>): VmStateSnapshot {
        const data: VmStateSnapshot = {
            observed_at_utc: utcNow(),
            vms: vms.map(v => ({
                managedBy: v.managedBy,
                name: v.name,
                state: this.setState(v.name, v.state)
            }))
        };
        this.snapshot = { data, observedAtMs: Date.now() };
        return data;
    }
}

