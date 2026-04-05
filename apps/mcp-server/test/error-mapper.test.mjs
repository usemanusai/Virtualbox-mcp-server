import test from "node:test";
import assert from "node:assert/strict";
import { mapGuestError } from "../dist/error-mapper.js";

test("mapGuestError returns strict codes", () => {
    assert.equal(mapGuestError(new Error("Connection timed out")), "PROCESS_TIMEOUT");
    assert.equal(mapGuestError(new Error("VM not found")), "VM_NOT_FOUND");
    assert.equal(mapGuestError(new Error("must be 'running'")), "VM_NOT_RUNNING");
    assert.equal(mapGuestError(new Error("Authentication failure")), "AUTH_FAILED");
});
