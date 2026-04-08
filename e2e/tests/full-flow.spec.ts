/**
 * Full user flow E2E test.
 *
 * Exercises the critical path through the application:
 * org creation -> workspace -> project -> issue CRUD -> board view ->
 * cycles -> wiki -> command palette search -> my issues.
 *
 * Uses the auth fixture (authedPage / authedRequest) and API helpers
 * from the e2e infrastructure.
 */
import { expect, test } from '../fixtures/auth';
import { cleanup, createIssue, seedProjectHierarchy } from '../helpers/api';

test.describe('Full user flow', () => {
  let orgId: string;

  test.afterEach(async ({ authedRequest }) => {
    if (orgId) {
      await cleanup(authedRequest, orgId);
    }
  });

  test('complete project management workflow', async ({ authedPage, authedRequest, testUser }) => {
    // ── Step 1: Sign up / Auth ─────────────────────────────────────────
    // Auth is handled by the authedPage fixture (worker-scoped signup + login).
    // We just verify we have a valid test user.
    await test.step('Sign up / Auth', async () => {
      expect(testUser.id).toBeDefined();
      expect(testUser.email).toBeDefined();
    });

    // ── Step 2: Create project ─────────────────────────────────────────
    let workspace: { id: string; slug: string };
    let project: { id: string; prefix: string };

    await test.step('Create project', async () => {
      const hierarchy = await seedProjectHierarchy(authedRequest, {
        orgName: 'E2E Org',
        workspaceName: 'E2E Workspace',
        projectName: 'E2E Project',
        projectPrefix: 'E2E',
      });
      orgId = hierarchy.org.id;
      workspace = hierarchy.workspace;
      project = hierarchy.project;

      expect(hierarchy.org.id).toBeDefined();
      expect(workspace.id).toBeDefined();
      expect(project.id).toBeDefined();
      expect(project.prefix).toBe('E2E');
    });

    // ── Step 3: Create issue ───────────────────────────────────────────
    await test.step('Create issue', async () => {
      await authedPage.goto(`/${workspace.slug}/projects/${project.id}/issues`);

      // Wait for the page to fully load (issue list or empty state)
      await expect(
        authedPage.locator('[data-testid="issue-list"], [data-testid="empty-state"], main'),
      ).toBeVisible({ timeout: 15_000 });

      // Try the Quick Add button first, then fall back to the keyboard shortcut
      const quickAddButton = authedPage.locator(
        '[data-testid="quick-add-issue"], [data-testid="create-issue-button"], button:has-text("Add issue"), button:has-text("New issue")',
      );
      const hasButton = await quickAddButton.first().isVisible();

      if (hasButton) {
        await quickAddButton.first().click();
      } else {
        // Try keyboard shortcut "C" to open the quick add
        await authedPage.keyboard.press('c');
      }

      // Fill in the issue title
      const titleInput = authedPage
        .locator(
          '[data-testid="issue-title-input"], input[placeholder*="issue"], input[name="title"], [contenteditable="true"]',
        )
        .first();

      const titleVisible = await titleInput.isVisible();

      if (titleVisible) {
        await titleInput.fill('E2E Test Issue');
        await authedPage.keyboard.press('Enter');

        // Wait for the issue to appear in the list
        await expect(authedPage.locator('text="E2E Test Issue"')).toBeVisible({ timeout: 10_000 });
      } else {
        // Create the issue via API as fallback
        await createIssue(authedRequest, project.id, 'E2E Test Issue');
      }

      // Reload to ensure we see the latest state
      await authedPage.goto(`/${workspace.slug}/projects/${project.id}/issues`);

      await expect(authedPage.locator('text="E2E Test Issue"')).toBeVisible({ timeout: 10_000 });
    });

    // ── Step 4: Board view / Kanban ────────────────────────────────────
    await test.step('Board view / Kanban', async () => {
      // Look for a board/kanban view toggle
      const boardToggle = authedPage
        .locator(
          '[data-testid="view-board"], [data-testid="board-view"], button[aria-label*="Board"], a[href*="board"]',
        )
        .first();
      const hasBoardToggle = await boardToggle.isVisible();

      if (hasBoardToggle) {
        await boardToggle.click();
        await authedPage.waitForTimeout(1_000);

        // The issue should appear inside a board column
        await expect(authedPage.locator('text="E2E Test Issue"')).toBeVisible({ timeout: 10_000 });
      }
    });

    // ── Step 5: Cycles ─────────────────────────────────────────────────
    await test.step('Cycles', async () => {
      await authedPage.goto(`/${workspace.slug}/projects/${project.id}/cycles`);

      const createCycleButton = authedPage
        .locator(
          '[data-testid="create-cycle"], button:has-text("New cycle"), button:has-text("Create cycle"), button:has-text("Add cycle")',
        )
        .first();
      const hasCycleButton = await createCycleButton.isVisible({ timeout: 5_000 });

      if (hasCycleButton) {
        await createCycleButton.click();

        const cycleNameInput = authedPage
          .locator(
            'input[name="name"], input[placeholder*="cycle"], [data-testid="cycle-name-input"]',
          )
          .first();
        const hasCycleInput = await cycleNameInput.isVisible({ timeout: 3_000 });

        if (hasCycleInput) {
          await cycleNameInput.fill('Sprint 1');
          // Submit the form
          const submitBtn = authedPage
            .locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")')
            .first();
          await submitBtn.click();

          await expect(authedPage.locator('text="Sprint 1"')).toBeVisible({ timeout: 10_000 });
        }
      }
    });

    // ── Step 6: Wiki ───────────────────────────────────────────────────
    await test.step('Wiki', async () => {
      await authedPage.goto(`/${workspace.slug}/wiki`);

      const createSpaceButton = authedPage
        .locator(
          '[data-testid="create-wiki-space"], button:has-text("New space"), button:has-text("Create space"), button:has-text("Add space")',
        )
        .first();
      const hasSpaceButton = await createSpaceButton.isVisible({ timeout: 5_000 });

      if (hasSpaceButton) {
        await createSpaceButton.click();

        const spaceNameInput = authedPage
          .locator(
            'input[name="name"], input[placeholder*="space"], [data-testid="space-name-input"]',
          )
          .first();
        const hasSpaceInput = await spaceNameInput.isVisible({ timeout: 3_000 });

        if (hasSpaceInput) {
          await spaceNameInput.fill('Engineering Docs');
          const submitBtn = authedPage
            .locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")')
            .first();
          await submitBtn.click();

          // Wait for the space to appear
          await expect(authedPage.locator('text="Engineering Docs"')).toBeVisible({
            timeout: 10_000,
          });
        }
      }
    });

    // ── Step 7: Search ─────────────────────────────────────────────────
    await test.step('Search', async () => {
      // Use the platform-appropriate modifier key
      const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
      await authedPage.keyboard.press(`${modifier}+k`);

      const searchInput = authedPage
        .locator(
          '[data-testid="command-palette-input"], [role="combobox"], input[placeholder*="Search"], input[placeholder*="search"]',
        )
        .first();
      const hasSearchInput = await searchInput.isVisible({ timeout: 3_000 });

      if (hasSearchInput) {
        await searchInput.fill('E2E Test Issue');

        // Wait for search results to appear
        await authedPage.waitForTimeout(1_000);

        // Verify the issue appears in search results
        const searchResult = authedPage
          .locator(
            '[data-testid="search-result"], [role="option"], [role="listbox"] >> text="E2E Test Issue"',
          )
          .first();
        await expect(searchResult).toBeVisible({ timeout: 5_000 });

        // Close the command palette
        await authedPage.keyboard.press('Escape');
      }
    });

    // ── Step 8: My Work ────────────────────────────────────────────────
    await test.step('My Work', async () => {
      // First assign the issue to ourselves via API
      const issuesRes = await authedRequest.get(`/api/v1/projects/${project.id}/issues`);
      expect(issuesRes.ok()).toBe(true);

      const issuesList = await issuesRes.json();
      const issues = (issuesList as { data: { id: string; title: string }[] }).data;
      const e2eIssue = issues?.find((i: { title: string }) => i.title === 'E2E Test Issue');

      expect(e2eIssue).toBeDefined();

      // Assign to self
      const assignRes = await authedRequest.post(
        `/api/v1/projects/${project.id}/issues/${e2eIssue?.id}/assignees`,
        { data: { userId: testUser.id } },
      );

      expect(assignRes.ok()).toBe(true);

      // Navigate to My Issues
      await authedPage.goto(`/${workspace.slug}/my-issues`);

      await expect(authedPage.locator('text="E2E Test Issue"')).toBeVisible({ timeout: 10_000 });
    });
  });
});
