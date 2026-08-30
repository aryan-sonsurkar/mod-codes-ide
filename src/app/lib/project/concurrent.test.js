import { describe, it, expect } from "vitest";
import { detectConcurrentEdits } from "./concurrent";
describe("concurrent",()=>{
  it("detects overlap",()=>{
    expect(detectConcurrentEdits({userEditedPaths:["a/b.js"], agentChangeset:{changes:[{path:"a/b.js"}]}})).toEqual(["a/b.js"]);
  });
  it("no overlap",()=>{
    expect(detectConcurrentEdits({userEditedPaths:["x"], agentChangeset:{changes:[{path:"y"}]}})).toEqual([]);
  });
});
