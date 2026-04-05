import assert from "node:assert/strict";
import { redactSecrets } from "../dist/logger.js";

function run() {
    const data = {
        password: "p",
        token: "t",
        nested: { apiKey: "k", passphrase: "pp", key: "kk", value: "ok" }
    };
    const out = redactSecrets(data);
    assert.equal(out.password, "***REDACTED***");
    assert.equal(out.token, "***REDACTED***");
    assert.equal(out.nested.apiKey, "***REDACTED***");
    assert.equal(out.nested.passphrase, "***REDACTED***");
    assert.equal(out.nested.key, "***REDACTED***");
    assert.equal(out.nested.value, "ok");
    console.log("shared-utils unit tests passed");
}

run();
