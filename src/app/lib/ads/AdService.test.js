import { describe, it, expect } from "vitest";
import { createAdService } from "./AdService";

describe("AdService", () => {
  it("never receives project data and round-robins", () => {
    const svc = createAdService();
    const a1 = svc.requestAd({ placement: "projects" });
    expect(a1.label).toBe("Sponsored");
    svc.showAd();
    const a2 = svc.requestAd({ placement: "research" });
    expect(a2.id).not.toBe(a1.id);
  });
  it("dismiss clears", () => {
    const svc = createAdService();
    svc.requestAd();
    svc.dismissAd();
    expect(svc.showAd()).toBe(null);
  });
});
