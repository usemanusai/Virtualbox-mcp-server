import assert from "node:assert/strict";
import { normalizeVmState } from "../dist/vm-state.js";
import { mapGuestError } from "../dist/error-mapper.js";
import { stableStringify } from "../dist/json-utils.js";
import { resolveProgramStrategy } from "../dist/guest-execution-engine.js";
import { VmStateCache } from "../dist/vm-state-cache.js";
import { validateResponse, VmStatusResponseSchema } from "../dist/response-schemas.js";
import { normalizeWindowsPath, quoteWindowsArg } from "../dist/windows-command-builder.js";
import { GuestExecutionEngine } from "../dist/guest-execution-engine.js";

async function run() {
    assert.equal(normalizeVmState("running"), "running");
    assert.equal(normalizeVmState("poweroff"), "powered_off");
    assert.equal(normalizeVmState("not_created"), "powered_off");
    assert.equal(normalizeVmState("saved"), "saved");
    assert.equal(normalizeVmState("paused"), "paused");
    assert.equal(normalizeVmState("aborted"), "unknown");

    assert.equal(mapGuestError(new Error("Connection timed out")), "PROCESS_TIMEOUT");
    assert.equal(mapGuestError(new Error("VM not found")), "VM_NOT_FOUND");
    assert.equal(mapGuestError(new Error("must be 'running'")), "VM_NOT_RUNNING");
    assert.equal(mapGuestError(new Error("Authentication failure")), "AUTH_FAILED");
    assert.equal(mapGuestError(new Error("The filename, directory name, or volume label syntax is incorrect.")), "PATH_SYNTAX_ERROR");
    assert.equal(mapGuestError(new Error("working directory not found")), "WORKDIR_NOT_FOUND");

    const out = stableStringify({ b: 1, a: { d: 4, c: 3 } });
    assert.equal(out, `{\n  "a": {\n    "c": 3,\n    "d": 4\n  },\n  "b": 1\n}`);

    const win = resolveProgramStrategy("windows", "auto", { vm_name: "w", command: "whoami" });
    assert.equal(win.program.toLowerCase(), "cmd.exe");
    assert.deepEqual(win.args, ["/c", "whoami"]);

    const lin = resolveProgramStrategy("linux", "auto", { vm_name: "l", command: "whoami" });
    assert.equal(lin.program, "/bin/sh");
    assert.deepEqual(lin.args, ["-lc", "whoami"]);

    const cache = new VmStateCache(10000);
    const snap = cache.setSnapshot([{ name: "vm1", state: "running", managedBy: "native" }]);
    assert.equal(snap.vms[0].state, "running");
    assert.equal(cache.getCachedState("vm1"), "running");

    const valid = validateResponse(VmStatusResponseSchema, { name: "vm1", state: "running" });
    assert.equal(valid.name, "vm1");

    const p1 = normalizeWindowsPath("G:\\");
    assert.equal(p1.normalized, "G:\\");
    const p2 = normalizeWindowsPath("G:\\New folder\\AD-Forencics");
    assert.equal(p2.normalized, "G:\\New folder\\AD-Forencics");
    const p3 = normalizeWindowsPath("\\\\VBoxSvr\\shared\\New folder");
    assert.equal(p3.normalized, "\\\\VBoxSvr\\shared\\New folder");
    const p4 = normalizeWindowsPath("G:/New folder/mixed");
    assert.equal(p4.normalized, "G:\\New folder\\mixed");

    assert.equal(quoteWindowsArg("G:\\New folder"), "\"G:\\New folder\"");
    assert.equal(quoteWindowsArg("G:\\"), "\"G:\\\\\"");

    // Integration-style mock: strict workdir failure should not fallback.
    const mockVagrant = {
        async getVMStatus() { return "running"; },
        async getGuestOSFamily() { return "windows"; },
        async executeGuestProgram(vm, program, args) {
            const joined = `${program} ${args.join(" ")}`;
            if (joined.includes("Test-Path")) {
                return { exitCode: 0, stdout: "0|G:\\Bad", stderr: "" };
            }
            return { exitCode: 0, stdout: "ok", stderr: "" };
        },
        async sendKeystrokes() { }
    };
    const engine = new GuestExecutionEngine(mockVagrant);
    const strictFail = await engine.execute({
        vm_name: "w",
        program: "cmd.exe",
        args: ["/c", "dir"],
        working_dir: "G:\\Bad",
        strict_paths: true,
        allow_workdir_fallback: false
    });
    assert.equal(strictFail.error_code, "WORKDIR_NOT_FOUND");

    const fallbackOk = await engine.execute({
        vm_name: "w",
        program: "cmd.exe",
        args: ["/c", "dir"],
        working_dir: "G:\\Bad",
        strict_paths: true,
        allow_workdir_fallback: true
    });
    assert.equal(fallbackOk.ok, true);

    const legacyShape = await engine.execute({
        vm_name: "w",
        command: "whoami"
    });
    assert.equal(legacyShape.ok, true);

    console.log("mcp-server unit tests passed");
}

await run();
