import { BONSAI_MODEL_TIERS, getModelById, modelDownloadBytes, modelVersionKey } from "./catalog";
import { normalizeStorageError, openWeightCache, removeCachedWeight, weightCacheContainsModel } from "./cache";

export const MODEL_STATES = {
  notDownloaded: "notDownloaded",
  downloading: "downloading",
  downloaded: "downloaded",
  loading: "loading",
  ready: "ready",
  error: "error",
  evicted: "evicted",
  incompatible: "incompatible",
};

export function isWebGpuCapable(capability) {
  return Boolean(
    capability &&
      capability.state === "available" &&
      capability.adapter &&
      capability.device
  );
}

export function checkModelCompatibility(model, capability) {
  if (!model) {
    return { compatible: false, reason: "unknown-model", message: "Unknown model." };
  }
  if (!isWebGpuCapable(capability)) {
    return {
      compatible: false,
      reason: "no-webgpu",
      message: "WebGPU is not available in this browser.",
    };
  }
  const limits = capability.limits || {};
  for (const [key, required] of Object.entries(model.requiredLimits || {})) {
    if (typeof limits[key] === "number" && limits[key] < required) {
      return {
        compatible: false,
        reason: "insufficient-limits",
        key,
        required,
        actual: limits[key],
        message: `This GPU cannot host the model (needs ${key} >= ${required}).`,
      };
    }
  }
  return {
    compatible: true,
    reason: null,
    requiresWebGpu: !model.cpuFallback,
  };
}

export function baseModelState({ hasCachedWeights, capability }) {
  if (!isWebGpuCapable(capability)) {
    return MODEL_STATES.incompatible;
  }
  return hasCachedWeights ? MODEL_STATES.downloaded : MODEL_STATES.notDownloaded;
}

export function createModelRegistry({
  capability,
  cacheProvider,
  onStateChange = () => {},
} = {}) {
  const transient = new Map();
  const cachePromise = Promise.resolve(openWeightCache(cacheProvider)).then(
    (cache) => cache || null
  );

  async function isModelCached(model) {
    const cache = await cachePromise;
    if (!cache) {
      return false;
    }
    return weightCacheContainsModel(cache, model);
  }

  function emit(modelId) {
    const model = getModelById(modelId);
    if (model) {
      onStateChange({ modelId, model });
    }
  }

  function hasModel(id) {
    return Boolean(getModelById(id));
  }

  return {
    capability,
    async getModel(id) {
      const model = getModelById(id);
      if (!model) {
        return { model: null, state: null, compatibility: null, downloadBytes: 0, versionKey: null };
      }
      const cached = await isModelCached(model);
      const compatibility = checkModelCompatibility(model, this.capability);
      const base = baseModelState({
        hasCachedWeights: cached,
        capability: this.capability,
      });
      let state = transient.get(id) || base;
      if (!compatibility.compatible) {
        state = MODEL_STATES.incompatible;
      }
      return {
        model,
        state,
        compatibility,
        downloadBytes: modelDownloadBytes(model),
        versionKey: modelVersionKey(model),
      };
    },
    async list() {
      const result = [];
      for (const model of BONSAI_MODEL_TIERS) {
        result.push(await this.getModel(model.id));
      }
      return result;
    },
    beginDownload(id) {
      if (hasModel(id)) {
        transient.set(id, MODEL_STATES.downloading);
        emit(id);
      }
    },
    markLoading(id) {
      if (hasModel(id)) {
        transient.set(id, MODEL_STATES.loading);
        emit(id);
      }
    },
    markReady(id) {
      if (hasModel(id)) {
        transient.set(id, MODEL_STATES.ready);
        emit(id);
      }
    },
    fail(id, error) {
      if (hasModel(id)) {
        transient.set(id, MODEL_STATES.error);
        emit(id);
      }
      return normalizeStorageError(error);
    },
    async finishDownload(id) {
      if (hasModel(id)) {
        transient.delete(id);
        emit(id);
      }
    },
    resetModel(id) {
      if (hasModel(id)) {
        transient.delete(id);
        emit(id);
      }
    },
    async evictModel(id) {
      const model = getModelById(id);
      if (!model) {
        return { evicted: false, state: null };
      }
      transient.delete(id);
      const cache = await cachePromise;
      let removed = false;
      if (cache) {
        for (const file of model.files) {
          removed = (await removeCachedWeight(cache, file.url)) || removed;
        }
      }
      emit(id);
      return { evicted: removed || !cache, state: MODEL_STATES.evicted };
    },
  };
}