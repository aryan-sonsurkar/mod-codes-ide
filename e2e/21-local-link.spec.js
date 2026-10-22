import {
  test,
  expect,
  PROJECTS_URL,
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
const OFFLINE_BASE = "http://127.0.0.1:59999";
async function injectOllamaOffline(page) {
  await page.addInitScript((offlineBase) => {
    try {
      const raw = localStorage.getItem("modcodes-settings");
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.ai = {
        ...(parsed.ai || {}),
        provider: "ollama",
        baseUrl: offlineBase,
      };
      localStorage.setItem("modcodes-settings", JSON.stringify(parsed));
    } catch {}
  }, OFFLINE_BASE);
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
      /projects\?ollama=http%3A%2F%2F192\.168\.1\.50%3A11434/
    );
  });

  test("a join link sets the Ollama address and strips itself", async ({
    modcodesPage: page,
  }) => {
    const readSettings = () =>
      page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem("modcodes-settings") || "{}");
        } catch {
          return {};
        }
      });

    await page.goto(
      `${PROJECTS_URL}?ollama=${encodeURIComponent("http://192.168.1.50:11434")}`
    );
    await page.waitForTimeout(2000);

    const applied = await readSettings();
    expect(applied.ai?.baseUrl).toBe("http://192.168.1.50:11434");
    expect(applied.ai?.provider).toBe("ollama");
    expect(page.url()).not.toContain("ollama=");

    await page.goto(
      `${PROJECTS_URL}?ollama=${encodeURIComponent("https://example.com")}`
    );
    await page.waitForTimeout(1500);

    // The init script re-seeds the offline address on every navigation, so a
    // rejected public target must leave that value untouched.
    const rejected = await readSettings();
    expect(rejected.ai?.baseUrl).toBe(OFFLINE_BASE);
  });

  test("mesh dialog validates pairing text and builds an answer", async ({
    modcodesPage: page,
  }) => {
    await openAIPanel(page);

    const providerSelect = page.locator("#ai-provider-select");
    await expect(providerSelect).toBeVisible({ timeout: 20000 });
    await providerSelect.selectOption("ollama");

    await page.locator('[data-testid="local-link-lan-toggle"]').click();
    await page.locator('[data-testid="local-link-mesh"]').click();

    const panel = page.locator('[data-testid="mesh-panel"]');
    await expect(panel).toBeVisible();

    // The host side must not offer to share when Ollama is unreachable.
    const host = page.locator('[data-testid="mesh-host"]');
    await expect(host).toContainText(/can't reach Ollama/i, { timeout: 20000 });
    await expect(
      page.locator('[data-testid="mesh-host-start"]')
    ).toHaveCount(0);

    await page.getByRole("tab", { name: /Use the other machine/i }).click();
    const offerInput = page.locator('[data-testid="mesh-offer-input"]');
    await offerInput.fill("hello there");
    await page.locator('[data-testid="mesh-join-start"]').click();
    await expect(page.locator('[data-testid="mesh-error"]')).toContainText(
      /not a MODCODES pairing link/i
    );

    // Replace WebRTC with a deterministic peer so the answer step is offline.
    await page.evaluate(() => {
      class FakeMeshPeer {
        constructor() {
          this.iceGatheringState = "complete";
          this.localDescription = null;
          this.ondatachannel = null;
        }
        createDataChannel() {
          return { readyState: "connecting", send() {}, close() {} };
        }
        async createOffer() {
          return { type: "offer", sdp: "v=0" };
        }
        async createAnswer() {
          return { type: "answer", sdp: "v=0" };
        }
        async setRemoteDescription() {}
        async setLocalDescription(description) {
          this.localDescription = {
            type: description.type,
            sdp: [
              "v=0",
              "o=- 1 1 IN IP4 127.0.0.1",
              "a=fingerprint:sha-256 DD:EE:FF:00",
              "",
            ].join("\r\n"),
          };
        }
        close() {}
      }
      window.RTCPeerConnection = FakeMeshPeer;
    });

    const offerSdp = [
      "v=0",
      "o=- 1 1 IN IP4 192.168.1.50",
      "a=fingerprint:sha-256 AA:BB:CC:00",
      "",
    ].join("\r\n");
    const offerText = `MODCODES1:${JSON.stringify({
      v: 1,
      kind: "offer",
      room: "AB23CD",
      sdp: offerSdp,
    })}`;

    await offerInput.fill(offerText);
    await page.locator('[data-testid="mesh-join-start"]').click();

    const answer = page.locator('[data-testid="mesh-answer"]');
    await expect(answer).toBeVisible({ timeout: 20000 });
    await expect(answer).toHaveValue(/^MODCODES1:.*"kind":"answer"/);
    await expect(page.locator('[data-testid="mesh-phrase"]')).toContainText(
      "AB23CD"
    );
    await expect(page.locator('[data-testid="mesh-phrase"] strong')).not.toBeEmpty();
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
