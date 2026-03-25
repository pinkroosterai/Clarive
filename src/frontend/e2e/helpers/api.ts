import { Page } from '@playwright/test';

/**
 * E2E seed API helpers — call the backend seed endpoint to create test data
 * programmatically instead of through UI interactions.
 *
 * These endpoints are only available when ASPNETCORE_ENVIRONMENT=E2E.
 */

interface SeedEntryResult {
  entryId: string;
  tabId: string;
  url: string;
}

interface SeedPublishResult {
  versionId: string;
  version: number;
}

interface SeedTabResult {
  tabId: string;
}

interface SeedFolderResult {
  folderId: string;
}

async function seedFetch<T>(page: Page, path: string, body: object): Promise<T> {
  return page.evaluate(
    async ({ path, body }) => {
      async function doFetch() {
        return fetch(path, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('cl_token')}`,
          },
          body: JSON.stringify(body),
        });
      }

      let res = await doFetch();

      // If the JWT expired (common after snapshot restore), refresh it and retry
      if (res.status === 401) {
        const rt = localStorage.getItem('cl_refresh');
        if (rt) {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: rt }),
          });
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            localStorage.setItem('cl_token', data.token);
            localStorage.setItem('cl_refresh', data.refreshToken);
            res = await doFetch();
          }
        }
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Seed API ${path} failed: ${res.status} ${text}`);
      }
      return res.json();
    },
    { path, body }
  );
}

/**
 * Create an entry via the seed API. Returns entry ID, main tab ID, and URL.
 */
export async function createEntryViaAPI(
  page: Page,
  opts: { title: string; content?: string; systemMessage?: string; folderId?: string }
): Promise<SeedEntryResult> {
  return seedFetch<SeedEntryResult>(page, '/api/e2e/entries', opts);
}

/**
 * Publish the current tab of an entry. Returns the published version ID and number.
 */
export async function publishEntryViaAPI(
  page: Page,
  entryId: string,
  tabId: string
): Promise<SeedPublishResult> {
  return seedFetch<SeedPublishResult>(page, `/api/e2e/entries/${entryId}/publish`, { tabId });
}

/**
 * Create a new tab on an entry, forked from a published version.
 */
export async function createTabViaAPI(
  page: Page,
  entryId: string,
  opts: { name: string; forkedFromVersion?: number }
): Promise<SeedTabResult> {
  return seedFetch<SeedTabResult>(page, `/api/e2e/entries/${entryId}/tabs`, {
    name: opts.name,
    forkedFromVersion: opts.forkedFromVersion ?? 1,
  });
}

/**
 * Create a folder via the seed API.
 */
export async function createFolderViaAPI(
  page: Page,
  name: string,
  parentId?: string
): Promise<SeedFolderResult> {
  return seedFetch<SeedFolderResult>(page, '/api/e2e/folders', { name, parentId });
}
