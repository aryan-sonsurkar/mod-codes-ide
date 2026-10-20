import {
  test,
  expect,
  navigateToProjects,
  navigateToSettings,
  clearLocalStorage,
  injectOnboardingCompleted,
  injectConsentAccepted,
  uniqueProject,
  createAndOpenProject,
  openAIPanel,
} from "./helpers";

// Point Ollama at a dead port so the setup section renders even on machines
// that happen to run a real Ollama. Nothing listens on 59999.
async function injectOllamaOffline(page) {
  await page.addInitScript(() => {
    try {
      const raw = localStorage.getItem("modcodes-settings");
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.ai = {
        ...(parsed.ai || {}),
        provider: "ollama",
        baseUrl: "http://127.0.0.1:59999",
      };
      localStorage.setItem("modcodes-settings", JSON.stringify(parsed));
    } catch {}
  });
}

// Deterministic LAN discovery: emit one host candidate, then end gathering.
async function stubWebRtc(page) {
  await page.addInitScript(() => {
    class FakeRTCPeerConnection {
      constructor() {
        this.iceGatheringState = "gathering";
      }
      createDataChannel() {}
      async createOffer() {
        return { type: "offer", sdp: "v=0" };
      }
      async setLocalDescription() {
        setTimeout(() => {
          this.onicecandidate?.({
            candidate: {
              candidate:
                "candidate:1 1 UDP 2122260223 192.168.1.50 51234 typ host",
            },
          });
          this.onicecandidate?.({ candidate: null });
        }, 0);
      }
      close() {}
    }
    window.RTCPeerConnection = FakeRTCPeerConnection;
  });
}

test.describe("Local Link", () => {
  test.beforeEach(async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await injectOllamaOffline(page);
    await stubWebRtc(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
  });

  test("shows Ollama setup with a working connection probe", async ({
    modcodesPage: page,
  }) => {
    await openAIPanel(page);

    const providerSelect = page.locator("#ai-provider-select");
    await expect(providerSelect).toBeVisible({ timeout: 20000 });
    await providerSelect.selectOption("ollama");

    const localLink = page.locator('[data-testid="local-link"]');
    await expect(localLink).toBeVisible({ timeout: 20000 });
    await expect(localLink).toContainText("Local Link");

    await page.locator('[data-testid="local-link-test"]').click();

    const result = page.locator('[data-testid="local-link-result"]');
    await expect(result).toBeVisible({ timeout: 20000 });
    await expect(result).toContainText(/could not reach/i);
    await expect(result).toContainText(/local-network permission/i);
  });

  test("exposes copyable origin-grant commands and LAN discovery", async ({
    modcodesPage: page,
  }) => {
    await openAIPanel(page);

    const providerSelect = page.locator("#ai-provider-select");
    await expect(providerSelect).toBeVisible({ timeout: 20000 });
    await providerSelect.selectOption("ollama");

    const toggle = page.locator('[data-testid="local-link-toggle"]');
    await expect(toggle).toBeVisible({ timeout: 20000 });
    await toggle.click();

    const commands = page.locator('[data-testid="local-link-commands"]');
    await expect(commands).toBeVisible();
    await expect(commands).toContainText(/OLLAMA_ORIGINS/);
    await expect(commands).toContainText(/localhost:\d+/);
    await expect(commands).toContainText(/other devices/i);

    await page.locator('[data-testid="local-link-lan-toggle"]').click();
    await page.locator('[data-testid="local-link-find-lan"]').click();

    const lanResult = page.locator('[data-testid="local-link-lan-result"]');
    await expect(lanResult).toBeVisible({ timeout: 20000 });
    await expect(lanResult).toContainText("192.168.1.50:11434");

    const qr = page.locator('[data-testid="local-link-qr"] svg');
    await expect(qr).toBeVisible();
    await expect(qr).toHaveAttribute(
      "aria-label",
      /QR code for http:\/\/192\.168\.1\.50:11434/
    );
  });

  test("settings stops claiming Ollama is localhost-only", async ({
    modcodesPage: page,
  }) => {
    await navigateToSettings(page);
    const aiNav = page.locator(".settings-nav-item", { hasText: /AI/i });
    if (await aiNav.isVisible().catch(() => false)) {
      await aiNav.click({ force: true });
      await page.waitForTimeout(500);
    }

    const text = await page.locator("body").textContent();
    expect(text).not.toContain(
      "are local services only reachable from localhost"
    );
    expect(text).toContain("Local Link");

    const testButton = page.locator(".settings-connection-button").first();
    await expect(testButton).toBeEnabled();
    await expect(testButton).toContainText("Test");
  });
});
