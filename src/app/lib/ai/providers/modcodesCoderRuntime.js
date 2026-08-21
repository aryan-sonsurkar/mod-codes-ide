import { detectWebGpuCapability } from "../browser/webgpu";
import { createHardwareProfile } from "../hardware";

export async function checkRequirements() {
  const gpu = await detectWebGpuCapability();
  const hardware = createHardwareProfile();
  return {
    webgpu: gpu ? gpu.state : "unknown",
    deviceMemoryGb: hardware.deviceMemoryGb,
    cpuCores: hardware.cpuCores,
    workerSupported: typeof Worker !== "undefined",
  };
}

export function getMeasurements() {
  return {
    modelSize: "Unknown",
    downloadSize: "Unknown",
    loadTime: "Unknown",
    memoryRequirement: "Unknown",
    firstTokenLatency: "Unknown",
    tokensPerSecond: "Unknown",
    contextWindow: "Unknown",
    webgpu: "Unknown",
  };
}

export function createModcodesCoderRuntimeAdapter() {
  return {
    async createEngine() {
      throw new Error("MODCODES-CODER runtime not installed — stub provider is active.");
    },
    async createChat() {
      throw new Error("MODCODES-CODER runtime not installed");
    },
  };
}
