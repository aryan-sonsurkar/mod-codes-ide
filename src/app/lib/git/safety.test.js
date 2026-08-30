import { describe,it,expect } from "vitest";
import { gitSafetyLevel } from "./safety";
describe("git safety",()=>{
  it("destructive requires approval",()=>expect(gitSafetyLevel({isDestructive:true})).toBe("explicit-approval"));
  it("warn overlap",()=>expect(gitSafetyLevel({hasUncommitted:true,affectedOverlap:true})).toBe("warn-overlap"));
  it("normal otherwise",()=>expect(gitSafetyLevel({})).toBe("normal"));
});
