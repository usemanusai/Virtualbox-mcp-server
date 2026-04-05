import test from "node:test";
import assert from "node:assert/strict";
import { resolveProgramStrategy } from "../dist/guest-execution-engine.js";

test("resolveProgramStrategy selects windows shell for auto windows", () => {
    const r = resolveProgramStrategy("windows", "auto", { vm_name: "w", command: "whoami" });
    assert.equal(r.program.toLowerCase(), "cmd.exe");
    assert.deepEqual(r.args, ["/c", "whoami"]);
});

test("resolveProgramStrategy selects linux shell for auto linux", () => {
    const r = resolveProgramStrategy("linux", "auto", { vm_name: "l", command: "whoami" });
    assert.equal(r.program, "/bin/sh");
    assert.deepEqual(r.args, ["-lc", "whoami"]);
});

