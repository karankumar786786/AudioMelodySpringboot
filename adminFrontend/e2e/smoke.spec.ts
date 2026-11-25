import { expect, test } from "@playwright/test";
import { MockApi } from "./mock-api";

test.describe("admin smoke", () => {
  test("login with email and one-time code", async ({ page }) => {
    const api = new MockApi(page);
    await api.install();

    await page.goto("/");
    await page.getByLabel("Email Address").fill("admin@onemelody.test");
    await page.getByRole("button", { name: "Send Verification Code" }).click();

    await expect(page.getByLabel("Verification code digit 1")).toBeVisible();
    for (const [i, digit] of ["1", "2", "3", "4", "5", "6"].entries()) {
      await page.getByLabel(`Verification code digit ${i + 1}`).fill(digit);
    }

    await expect(
      page.getByRole("heading", { name: "Mission Control HUD" }),
    ).toBeVisible();
    expect(api.callsTo("POST", "/auth/login")[0]?.body).toMatchObject({
      email: "admin@onemelody.test",
    });
    expect(api.callsTo("POST", "/auth/verify-otp")[0]?.body).toMatchObject({
      otp: "123456",
    });
  });

  test("login rejects an invalid email before calling the API", async ({
    page,
  }) => {
    const api = new MockApi(page);
    await api.install();
    await page.goto("/");
    await page.getByLabel("Email Address").fill("not-an-email");
    await page.getByRole("button", { name: "Send Verification Code" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    expect(api.callsTo("POST", "/auth/login")).toHaveLength(0);
  });

  test("upload a new track", async ({ page }) => {
    const api = new MockApi(page);
    await api.install();
    await api.signIn();

    await page.goto("/songs?new=true");
    const dialog = page.getByRole("dialog", { name: "Add New Track" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Track Title").fill("Smoke Test Song");
    const artists = dialog.getByPlaceholder("e.g. The Weeknd, Daft Punk");
    await artists.fill("Test Artist");
    await artists.press("Enter");
    await dialog.getByLabel("Cover Image Artwork").setInputFiles({
      name: "cover.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake-png"),
    });
    await dialog.getByLabel("Audio File (.mp3, .wav, .flac)").setInputFiles({
      name: "track.mp3",
      mimeType: "audio/mpeg",
      buffer: Buffer.from("fake-mp3"),
    });

    await dialog.getByRole("button", { name: "Create & Queue Track" }).click();

    await expect(
      page.getByText("Track created successfully and queued for processing!"),
    ).toBeVisible();
    await expect(dialog).toBeHidden();
    const created = api.callsTo("POST", "/admin/song")[0]?.body;
    expect(created).toMatchObject({
      title: "Smoke Test Song",
      artistName: "Test Artist",
      tempSongKey: "temp/audio-test",
      imageKey: "/songs/images/cover-test.png",
    });
  });

  test("publish a track to the featured hero", async ({ page }) => {
    const api = new MockApi(page);
    await api.install();
    await api.signIn();

    await page.goto("/songs");
    const feature = page.getByRole("button", {
      name: "Feature Midnight Drive",
    });
    await expect(feature).toBeVisible();
    await feature.click();

    await expect(page.getByText("Marked as hero featured")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Unfeature Midnight Drive" }),
    ).toBeVisible();
    expect(
      api.callsTo("PATCH", "/admin/song/song-1/featured")[0]?.body,
    ).toMatchObject({ featured: true });
  });

  test("delete a track needs the typed confirmation", async ({ page }) => {
    const api = new MockApi(page);
    await api.install();
    await api.signIn();

    await page.goto("/songs");
    await page.getByRole("button", { name: "Delete Midnight Drive" }).click();

    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText('Delete "Midnight Drive"?');
    const go = confirm.getByRole("button", { name: "Delete track" });
    await expect(go).toBeDisabled();
    await confirm.getByLabel("Type Midnight Drive to confirm").fill("Midnight");
    await expect(go).toBeDisabled();
    await confirm
      .getByLabel("Type Midnight Drive to confirm")
      .fill("Midnight Drive");
    await go.click();

    await expect(
      page.getByText('Track "Midnight Drive" queued for deletion'),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Delete Midnight Drive" }),
    ).toHaveCount(0);
    expect(api.callsTo("DELETE", "/admin/song/song-1")).toHaveLength(1);
  });

  test("an ADMIN does not see super-admin actions", async ({ page }) => {
    const api = new MockApi(page);
    await api.install();
    await api.signIn("ADMIN");

    await page.goto("/jobs");
    await expect(
      page.getByRole("heading", { name: "Song Ingestion Pipeline" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Sync DB/ })).toHaveCount(0);
  });

  test("jobs refresh every 15 s while visible and pause while hidden", async ({
    page,
  }) => {
    const api = new MockApi(page);
    await api.install();
    await api.signIn();
    await page.clock.install();

    await page.goto("/jobs");
    await expect(
      page.getByRole("heading", { name: "Song Ingestion Pipeline" }),
    ).toBeVisible();
    await expect(
      page.getByText("No ingestion jobs found matching filter criteria."),
    ).toBeVisible();
    const summaryCalls = () => api.callsTo("GET", "/admin/jobs/summary").length;
    // Dev mode mounts twice (React StrictMode), so measure from the settled count.
    const base = summaryCalls();
    expect(base).toBeGreaterThan(0);

    await page.clock.runFor(14_000);
    expect(summaryCalls()).toBe(base);
    await page.clock.runFor(1_000);
    await expect.poll(summaryCalls).toBe(base + 1);

    const setVisibility = (state: "visible" | "hidden") =>
      page.evaluate((s) => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => s,
        });
        document.dispatchEvent(
          new Event("visibilitychange", { bubbles: true }),
        );
      }, state);

    await setVisibility("hidden");
    await page.clock.runFor(60_000);
    expect(summaryCalls()).toBe(base + 1);

    // Coming back refetches at once, then polling resumes.
    await setVisibility("visible");
    await expect.poll(summaryCalls).toBe(base + 2);
    await page.clock.runFor(15_000);
    await expect.poll(summaryCalls).toBe(base + 3);
  });

  for (const [path, heading] of [
    ["/", "Mission Control HUD"],
    ["/artists", "Artist Management"],
    ["/playlists", "Playlists Studio"],
    ["/users", "Account Management"],
    ["/catalog-health", "Catalog Health"],
  ] as const) {
    test(`${path} renders without page errors`, async ({ page }) => {
      const api = new MockApi(page);
      await api.install();
      await api.signIn();
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(errors).toEqual([]);
    });
  }
});

test.describe("shorts", () => {
  test("hide a listener's short from the shorts page", async ({ page }) => {
    const api = new MockApi(page);
    await api.install();
    await api.signIn("ADMIN");

    await page.goto("/shorts");
    await expect(page.getByRole("heading", { name: "Shorts" })).toBeVisible();
    await expect(page.getByText("Night drive vibes")).toBeVisible();
    await expect(
      page.getByText("♪ Midnight Drive", { exact: false }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Hide" }).click();
    await expect(page.getByText("Short hidden")).toBeVisible();
    expect(api.callsTo("POST", "/admin/shorts/short-1/hide")).toHaveLength(1);

    await page.getByRole("tab", { name: "Reports" }).click();
    await expect(page.getByRole("tab", { name: "Reports" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("the upload dialog opens and needs a video", async ({ page }) => {
    const api = new MockApi(page);
    await api.install();
    await api.signIn("ADMIN");

    await page.goto("/shorts");
    await page.getByRole("button", { name: "Upload short" }).click();
    const dialog = page.getByRole("dialog", { name: "Upload a short" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Upload" })).toBeDisabled();
  });
});

test.describe("song analytics", () => {
  test("dashboard shows listening, linked to the song page", async ({ page }) => {
    const api = new MockApi(page);
    await api.install();
    await api.signIn();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Listening" })).toBeVisible();
    await expect(page.getByText("Most skipped intros")).toBeVisible();
    await page.getByRole("link", { name: /Midnight Drive/ }).first().click();
    await expect(page).toHaveURL(/\/songs\/song-1$/);
  });

  test("song page: KPIs, heatmap and quality", async ({ page }) => {
    const api = new MockApi(page);
    await api.install();
    await api.signIn();
    await page.goto("/songs/song-1");
    await expect(page.getByRole("heading", { name: "Midnight Drive" })).toBeVisible();
    await expect(page.getByText("Completion rate")).toBeVisible();
    await expect(page.getByText("50%").first()).toBeVisible();
    expect(api.callsTo("GET", "/admin/song/song-1/analytics")).not.toHaveLength(0);

    await page.getByRole("tab", { name: "Listening heatmap" }).click();
    await expect(page.getByRole("img", { name: "Listens per second of the song" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Hook 1: 0:06/ })).toBeVisible();

    await page.getByRole("tab", { name: "Delivery & quality" }).click();
    await expect(page.getByText("Delivery by quality and platform")).toBeVisible();
    await expect(page.getByRole("cell", { name: "610 ms" })).toBeVisible();
  });

  test("chunk inspector fetches every chunk and flags the missing one", async ({ page }) => {
    const api = new MockApi(page);
    await api.install();
    await api.signIn();
    await page.goto("/songs/song-1");
    await page.getByRole("tab", { name: "Chunk inspector" }).click();
    await expect(page.getByText("3 renditions")).toBeVisible();

    await page.getByRole("button", { name: "Run test" }).click();
    await expect(page.getByText("12 / 12 chunks")).toBeVisible();
    await expect(page.getByText("Integrity checks")).toBeVisible();
    // 240kbps chunk 2 is a 404 in the fixture.
    await expect(page.getByText("1 failed: #2 (404)")).toBeVisible();
    await expect(page.getByText(/320 kbps measured vs 320 kbps nominal/)).toBeVisible();

    const table = page.getByTestId("chunk-table");
    await expect(table.getByRole("row")).toHaveCount(5); // header + init + 3 chunks
  });
});
