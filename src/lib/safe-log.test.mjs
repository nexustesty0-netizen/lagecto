import assert from "node:assert/strict";
import test from "node:test";
import { publicRpcMessage, redactSensitive, requestIdFrom } from "./safe-log.ts";

test("redactSensitive hides tokens, emails and phones", () => {
  assert.match(redactSensitive("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb"), /redacted-token/);
  assert.match(redactSensitive("user lagecto@outlook.com signed in"), /redacted-email/);
  assert.match(redactSensitive("call +263 71 503 4314"), /redacted-phone/);
  assert.match(redactSensitive("https://x.test/?token=abc123&ok=1"), /redacted/);
});

test("requestIdFrom accepts only short safe ids", () => {
  const headers = new Headers({ "x-request-id": "req-abc_1" });
  assert.equal(requestIdFrom(headers), "req-abc_1");
  assert.notEqual(requestIdFrom(new Headers({ "x-request-id": "http://evil" })), "http://evil");
});

test("publicRpcMessage never returns SQL or schema errors", () => {
  assert.equal(publicRpcMessage("Not authorized", "Unable to save."), "Not authorized");
  assert.equal(publicRpcMessage("duplicate key value violates unique constraint", "Unable to save."), "Unable to save.");
  assert.equal(publicRpcMessage("relation products does not exist", "Unable to save."), "Unable to save.");
  assert.equal(publicRpcMessage("", "Unable to save."), "Unable to save.");
});
