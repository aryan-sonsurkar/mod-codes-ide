import { describe, it, expect } from "vitest";
import { inspectCodebase } from "./inspect";
describe("inspect bounded",()=>{
  it("detects Next.js stack with package.json", async ()=>{
    const tree={ name:"root", kind:"directory", children:[{name:"package.json", kind:"file", path:"root/package.json"}, {name:"page.js", kind:"file", path:"root/app/page.js"}]};
    const fileContents=new Map([["root/package.json", JSON.stringify({dependencies:{next:"1",react:"1"}, devDependencies:{vitest:"1"}})]]);
    const res=await inspectCodebase({ tree, fileContents });
    expect(res.technologyStack).toContain("Next.js");
    expect(res.testingSetup).toBe("vitest");
    expect(res.confidence).toBe("high");
    expect(res.routes.length).toBeGreaterThan(0);
  });
  it("low confidence without package", async ()=>{
    const tree={ name:"root", kind:"directory", children:[]};
    const res=await inspectCodebase({ tree, fileContents:new Map()});
    expect(res.confidence).toBe("low");
    expect(res.potentialRisks.length).toBeGreaterThan(0);
  });
});
