import assert from "node:assert/strict";
import { getDisplayedLength, getFullTextFallback, splitSpeechSegments } from "./speech-sync";

assert.equal(getDisplayedLength(10, -0.2), 0);
assert.equal(getDisplayedLength(10, 0), 0);
assert.equal(getDisplayedLength(10, 0.49), 5);
assert.equal(getDisplayedLength(10, 1), 10);
assert.equal(getDisplayedLength(10, 1.5), 10);

assert.equal(getFullTextFallback("你好，AI 教练。"), "你好，AI 教练。");
assert.equal(getFullTextFallback(""), "");

const segments = splitSpeechSegments("  第一段。\n第二段！ ");
assert.deepEqual(segments, [
  { start: 0, end: 7, ttsText: "第一段。" },
  { start: 7, end: 11, ttsText: "第二段！" },
]);
assert.deepEqual(splitSpeechSegments("  \n  "), []);
assert.deepEqual(splitSpeechSegments("请说明您的需求"), [
  { start: 0, end: 7, ttsText: "请说明您的需求" },
]);

console.log("speech-sync tests passed");
