import { api } from './apiClient';

// ── Types ──

export interface TestDataset {
  id: string;
  name: string;
  rowCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestDatasetDetail {
  id: string;
  name: string;
  rows: TestDatasetRow[];
  createdAt: string;
  updatedAt: string;
}

export interface TestDatasetRow {
  id: string;
  values: Record<string, string>;
  createdAt: string;
}

// ── Dataset CRUD ──

export async function getDatasets(entryId: string): Promise<TestDataset[]> {
  return api.get<TestDataset[]>(`/api/entries/${entryId}/datasets`);
}

export async function getDataset(entryId: string, datasetId: string): Promise<TestDatasetDetail> {
  return api.get<TestDatasetDetail>(`/api/entries/${entryId}/datasets/${datasetId}`);
}

export async function createDataset(entryId: string, name: string): Promise<TestDatasetDetail> {
  return api.post<TestDatasetDetail>(`/api/entries/${entryId}/datasets`, { name });
}

export async function updateDataset(
  entryId: string,
  datasetId: string,
  name: string
): Promise<TestDatasetDetail> {
  return api.put<TestDatasetDetail>(`/api/entries/${entryId}/datasets/${datasetId}`, { name });
}

export async function deleteDataset(entryId: string, datasetId: string): Promise<void> {
  return api.delete(`/api/entries/${entryId}/datasets/${datasetId}`);
}

// ── Row CRUD ──

export async function addRow(
  entryId: string,
  datasetId: string,
  values: Record<string, string>
): Promise<TestDatasetRow> {
  return api.post<TestDatasetRow>(`/api/entries/${entryId}/datasets/${datasetId}/rows`, { values });
}

export async function updateRow(
  entryId: string,
  datasetId: string,
  rowId: string,
  values: Record<string, string>
): Promise<TestDatasetRow> {
  return api.put<TestDatasetRow>(`/api/entries/${entryId}/datasets/${datasetId}/rows/${rowId}`, {
    values,
  });
}

export async function deleteRow(entryId: string, datasetId: string, rowId: string): Promise<void> {
  return api.delete(`/api/entries/${entryId}/datasets/${datasetId}/rows/${rowId}`);
}

// ── AI Generation ──

export async function generateRows(
  entryId: string,
  datasetId: string,
  count: number = 5
): Promise<TestDatasetRow[]> {
  return api.post<TestDatasetRow[]>(`/api/entries/${entryId}/datasets/${datasetId}/generate`, {
    count,
  });
}
