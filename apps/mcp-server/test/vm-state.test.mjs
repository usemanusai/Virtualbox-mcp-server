import test from "node:test";
import assert from "node:assert/strict";
import { normalizeVmState } from "../dist/vm-state.js";

test("normalizeVmState maps legacy and raw states", () => {
    assert.equal(normalizeVmState("running"), "running");
    assert.equal(normalizeVmState("poweroff"), "powered_off");
    assert.equal(normalizeVmState("not_created"), "powered_off");
    assert.equal(normalizeVmState("saved"), "saved");
    assert.equal(normalizeVmState("paused"), "paused");
    assert.equal(normalizeVmState("aborted"), "unknown");
});

