import test from "node:test";
import assert from "node:assert/strict";
import { redactSecrets } from "../dist/logger.js";

test("redactSecrets masks sensitive keys recursively", () => {
    const data = {
        password: "p",
        token: "t",
        nested: { apiKey: "k", value: "ok" }
    };
    const out = redactSecrets(data);
    assert.equal(out.password, "***REDACTED***");
    assert.equal(out.token, "***REDACTED***");
    assert.equal(out.nested.apiKey, "***REDACTED***");
    assert.equal(out.nested.value, "ok");
});

