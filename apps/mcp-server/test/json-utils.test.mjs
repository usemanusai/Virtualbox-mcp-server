import test from "node:test";
import assert from "node:assert/strict";
import { stableStringify } from "../dist/json-utils.js";

test("stableStringify keeps deterministic key order", () => {
    const payload = { b: 1, a: { d: 4, c: 3 } };
    const out = stableStringify(payload);
    assert.equal(out, `{\n  "a": {\n    "c": 3,\n    "d": 4\n  },\n  "b": 1\n}`);
});

