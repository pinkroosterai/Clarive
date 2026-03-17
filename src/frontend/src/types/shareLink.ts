export interface ShareLinkInfo {
  id: string;
  entryId: string;
  expiresAt: string | null;
  hasPassword: boolean;
  pinnedVersion: number | null;
  accessCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface ShareLinkCreated extends ShareLinkInfo {
  token: string;
}

export interface CreateShareLinkRequest {
  expiresAt?: string | null;
  password?: string | null;
  pinnedVersion?: number | null;
}

export interface SharedEntry {
  entryId: string;
  title: string;
  systemMessage: string | null;
  version: number;
  publishedAt: string | null;
  prompts: SharedPrompt[];
}

export interface SharedPrompt {
  content: string;
  order: number;
  isTemplate: boolean;
  templateFields: TemplateFieldRef[] | null;
}

export interface TemplateFieldRef {
  name: string;
  defaultValue: string | null;
  type: string;
}
