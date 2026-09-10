import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initGlobalErrorHandlers,
  destroyGlobalErrorHandlers,
  isGlobalErrorHandlersInitialized,
} from "./globalHandlers.js";
import { captureError, getRecentErrors, clearErrors } from "./errorCollector.js";

describe("globalHandlers", () => {
  let mockWindow;

  beforeEach(() => {
    destroyGlobalErrorHandlers();
    clearErrors();
    mockWindow = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    vi.stubGlobal("window", mockWindow);
  });

  afterEach(() => {
    destroyGlobalErrorHandlers();
    clearErrors();
    vi.restoreAllMocks();
  });

  it("initializes once", () => {
    initGlobalErrorHandlers();
    expect(isGlobalErrorHandlersInitialized()).toBe(true);
    initGlobalErrorHandlers();
    expect(isGlobalErrorHandlersInitialized()).toBe(true);
  });

  it("destroys handlers", () => {
    initGlobalErrorHandlers();
    destroyGlobalErrorHandlers();
    expect(isGlobalErrorHandlersInitialized()).toBe(false);
  });

  it("registers error and unhandledrejection listeners", () => {
    initGlobalErrorHandlers();
    expect(mockWindow.addEventListener).toHaveBeenCalledWith("error", expect.any(Function));
    expect(mockWindow.addEventListener).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));
  });

  it("removes listeners on destroy", () => {
    initGlobalErrorHandlers();
    destroyGlobalErrorHandlers();
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith("error", expect.any(Function));
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));
  });

  it("isGlobalErrorHandlersInitialized reflects state", () => {
    expect(isGlobalErrorHandlersInitialized()).toBe(false);
    initGlobalErrorHandlers();
    expect(isGlobalErrorHandlersInitialized()).toBe(true);
    destroyGlobalErrorHandlers();
    expect(isGlobalErrorHandlersInitialized()).toBe(false);
  });
});
