/**
 * Build absolute URL for API calls.
 * The browser must call Flask directly (cross-origin + credentials) so the session cookie set on the
 * API host after OAuth is sent. See RootLayout script: `window.__OKR_BACKEND_ORIGIN__`.
 *
 * Important: `NEXT_PUBLIC_*` is inlined at `next build`. Docker builds often run without that env, so
 * the client bundle would fall back to `window.location.origin` and break cookies. Runtime injection
 * fixes Render/production without requiring build-time secrets.
 */
declare global {
  interface Window {
    __OKR_BACKEND_ORIGIN__?: string;
  }
}

function clientBackendOrigin(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const o = window.__OKR_BACKEND_ORIGIN__;
  if (typeof o === 'string' && o.trim() !== '') {
    return o.replace(/\/$/, '');
  }
  return undefined;
}

function apiFetchUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const injected = clientBackendOrigin();
  const raw = injected ?? process.env.NEXT_PUBLIC_API_URL;
  if (raw === '' || raw === undefined) {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${p}`;
    }
    const internal = process.env.INTERNAL_API_URL || 'http://127.0.0.1:5001';
    return `${internal.replace(/\/$/, '')}${p}`;
  }
  return `${raw.replace(/\/$/, '')}${p}`;
}

export interface Item {
  _id?: string;
  userId?: string;
  title: string;
  description: string;
  imageUrls?: string[];
  videoUrls?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Profile {
  _id?: string;
  userId?: string;
  displayName: string;
  bio: string;
  profileImageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type DashboardSortField = 'score' | 'owner' | 'updated';
export type SortDirection = 'asc' | 'desc';

export interface ViewPreferences {
  lastDetailTab: string;
  visibleTabs: Record<string, boolean>;
  dashboardSort: DashboardSortField;
  dashboardSortDirection: SortDirection;
  dashboardFilterUpdateType: string;
  historyEventTypeFilter: string;
}

export const DEFAULT_VIEW_PREFERENCES: ViewPreferences = {
  lastDetailTab: 'overview',
  visibleTabs: {
    overview: true,
    progress: true,
    updates: true,
    history: true,
    dependencies: true,
    files: true,
  },
  dashboardSort: 'updated',
  dashboardSortDirection: 'desc',
  dashboardFilterUpdateType: 'all',
  historyEventTypeFilter: 'all',
};

export type ObjectiveLevel = 'strategic' | 'functional' | 'tactical';
export type ObjectiveTimeline = 'annual' | 'quarterly';

export type ObjectiveStatus = 'draft' | 'in_review' | 'approved' | 'rejected';

export interface Objective {
  _id?: string;
  title: string;
  description?: string;
  ownerId?: string;
  level: ObjectiveLevel;
  timeline: ObjectiveTimeline;
  fiscalYear: number;
  quarter?: string;
  parentObjectiveId?: string | null;
  division?: string;
  departmentId?: string | null;
  status?: ObjectiveStatus;
  relatedObjectiveIds?: string[];
  /** Per linked OKR id: subjective 0–1 health of that dependency (0.1 steps), stored on this objective. */
  dependencyHealth?: Record<string, number>;
  averageScore?: number | null;
  createdAt?: string;
  updatedAt?: string;
  /** ISO date (YYYY-MM-DD) for next leadership review / check-in. */
  nextReviewDate?: string | null;
  /** Short narrative for slides and overview; persisted on the objective. */
  latestUpdateSummary?: string | null;
  /** Organization id (Postgres); sent on create when known. */
  orgId?: string;
  /** Present on objectives returned from the dependencies graph API. */
  linkHealth?: number | null;
}

export interface ObjectiveTree extends Objective {
  children: ObjectiveTree[];
  keyResults: KeyResult[];
  averageScore?: number | null;
}

export interface KeyResult {
  _id?: string;
  objectiveId: string;
  title: string;
  target?: string;
  currentValue?: string;
  unit?: string;
  /** Score 0.0–1.0 (OKR standard) */
  score?: number | null;
  targetScore?: number;
  ownerId?: string | null;
  notes?: Array<{ text?: string; createdAt?: string }>;
  createdAt?: string;
  lastUpdatedAt?: string;
}

export interface WorkflowEvent {
  _id?: string;
  objectiveId: string;
  fromStatus: string;
  toStatus: string;
  actorId: string;
  reason?: string;
  timestamp: string;
}

export interface ScoreHistoryEntry {
  _id?: string;
  keyResultId: string;
  score: number;
  notes?: string;
  recordedBy: string;
  recordedAt: string;
}

/** Short TTL cache for objective list fetches (reduces duplicate requests). */
const OBJECTIVES_LIST_CACHE_MS = 45_000;
const objectivesListCache = new Map<string, { storedAt: number; data: Objective[] }>();

export function invalidateObjectivesListCache(): void {
  objectivesListCache.clear();
}

export interface Comment {
  _id?: string;
  objectiveId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Attachment {
  _id?: string;
  objectiveId: string;
  keyResultId?: string | null;
  fileName: string;
  fileSize: number;
  fileType: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
  deletedAt?: string | null;
  storagePublicId?: string | null;
}

/** Audit entry when an attachment is deleted (immutable log). */
export interface AttachmentDeletionAudit {
  _id?: string;
  objectiveId: string;
  keyResultId?: string | null;
  attachmentId: string;
  fileName: string;
  fileSize: number;
  fileType?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  storageUrl?: string;
  deletedBy: string;
  deletedAt: string;
}

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
}

export interface OrgTreeUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface OrgTreeTeam {
  id: string;
  canonicalName: string;
  displayName: string;
  departmentId?: string | null;
  users: OrgTreeUser[];
}

export interface OrgTreeDepartment {
  id: string;
  canonicalName: string;
  displayName: string;
  parentDepartmentId?: string | null;
  teams: OrgTreeTeam[];
}

export interface OrgTreeResponse {
  org: OrgSummary;
  departments: OrgTreeDepartment[];
  unassignedUsers: OrgTreeUser[];
}

export interface ObjectiveAncestor {
  _id: string;
  title: string;
  parentObjectiveId?: string | null;
}

async function getAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(apiFetchUrl('/api/auth/token'), {
      credentials: 'include', // Include cookies for session
    });
    if (response.ok) {
      const data = await response.json();
      return data.accessToken || null;
    } else {
      // 401 is expected when not logged in - return null silently
      // Don't log or throw errors for 401
      if (response.status === 401) {
        return null;
      }
      
      // Only log non-401 errors
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (response.status === 500) {
        console.error('Token endpoint configuration error:', errorData);
      }
      // Don't log other errors either - just return null
    }
  } catch (error) {
    // Network errors - return null silently
    return null;
  }
  return null;
}

/** Thrown when PUT key-result returns 409 Conflict (stale lastUpdatedAt). */
export class ApiConflictError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: { current?: KeyResult; error?: string; message?: string }
  ) {
    super(message);
    this.name = 'ApiConflictError';
  }
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  let token = await getAccessToken();

  // If token fetch failed, try once more after a short delay
  if (!token) {
    await new Promise(resolve => setTimeout(resolve, 500));
    token = await getAccessToken();
  }

  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  // Bearer token from /api/auth/token when the user has an API session cookie (OAuth or password grant).
  const response = await fetch(apiFetchUrl(url), {
    ...options,
    headers,
    credentials: 'include', // Include cookies
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    const backendMessage = error.message || error.error || '';
    if (response.status === 403) {
      throw new Error(
        backendMessage
          ? `You don't have permission to perform this action. ${backendMessage}`
          : 'You don\'t have permission to perform this action. Your role or ownership may not allow it. Ask an admin to assign the correct role or permissions.'
      );
    }
    throw new Error(backendMessage || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

async function fetchPublic(url: string, options: RequestInit = {}) {
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  const response = await fetch(apiFetchUrl(url), {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

async function fetchPublicBlob(url: string, options: RequestInit = {}): Promise<Blob> {
  const response = await fetch(apiFetchUrl(url), {
    ...options,
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || (err as { error?: string }).error || `HTTP error! status: ${response.status}`);
  }
  return response.blob();
}

export const api = {
  // Auth API
  async login(): Promise<{
    auth_url?: string | null;
    /** Set when API runs with ALLOW_INSECURE_AUTH0_DEV (local only). */
    auth_disabled?: boolean;
    message?: string;
    error?: string;
  }> {
    return fetchPublic('/api/auth/login');
  },

  async loginEmailPassword(email: string, password: string): Promise<{ user: any; message: string }> {
    return fetchPublic('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
  },

  async register(email: string, password: string, name?: string): Promise<{ user: any; message: string }> {
    return fetchPublic('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, name }),
    });
  },

  async logout(): Promise<{ logout_url?: string; message?: string }> {
    return fetchPublic('/api/auth/logout', { method: 'POST' });
  },

  async getCurrentUser(): Promise<any> {
    return fetchWithAuth('/api/auth/me');
  },

  async getUsers(): Promise<
    {
      _id: string;
      role: string;
      departmentId?: string;
      name?: string;
      email?: string;
      okrCreateDisabled?: boolean;
    }[]
  > {
    return fetchWithAuth('/api/auth/users');
  },

  async getUserNames(): Promise<{ _id: string; name: string }[]> {
    return fetchWithAuth('/api/auth/users/names');
  },

  async getDepartments(): Promise<{ _id: string; name: string; color?: string }[]> {
    return fetchWithAuth('/api/departments');
  },

  /** Create a department. With Postgres, pass orgId from {@link api.getOrgs}. Mongo uses name only. */
  async createDepartment(body: { name: string; orgId?: string }): Promise<{ _id: string; name: string }> {
    const name = body.name.trim();
    if (!name) throw new Error('Department name is required');
    if (body.orgId) {
      return fetchWithAuth(`/api/orgs/${encodeURIComponent(body.orgId)}/departments`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    }
    return fetchWithAuth('/api/departments', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async getOrgs(): Promise<OrgSummary[]> {
    return fetchWithAuth('/api/orgs');
  },

  async getOrgTree(orgId: string): Promise<OrgTreeResponse> {
    return fetchWithAuth(`/api/orgs/${encodeURIComponent(orgId)}/tree`);
  },

  async getObjectivesByScope(params: { scope: 'org' | 'department' | 'team' | 'user'; scopeId: string; fiscalYear?: number }): Promise<Objective[]> {
    const search = new URLSearchParams();
    search.set('scope', params.scope);
    search.set('scopeId', params.scopeId);
    if (params.fiscalYear != null) search.set('fiscalYear', String(params.fiscalYear));
    return fetchWithAuth(`/api/okrs/scope/objectives?${search.toString()}`);
  },

  async getObjectiveAncestors(objectiveId: string): Promise<ObjectiveAncestor[]> {
    return fetchWithAuth(`/api/objectives/${encodeURIComponent(objectiveId)}/ancestors`);
  },

  async updateUser(
    uid: string,
    body: {
      role?: string;
      departmentId?: string | null;
      okrCreateDisabled?: boolean;
      hideUserManagementNav?: boolean;
    }
  ): Promise<{
    _id: string;
    role: string;
    departmentId?: string;
    okrCreateDisabled?: boolean;
    hideUserManagementNav?: boolean;
  }> {
    return fetchWithAuth(`/api/auth/users/${encodeURIComponent(uid)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  async getItems(): Promise<Item[]> {
    return fetchWithAuth('/api/items');
  },

  async getItem(id: string): Promise<Item> {
    return fetchWithAuth(`/api/items/${id}`);
  },

  async createItem(item: { title: string; description: string; images?: File[]; videos?: File[] }): Promise<Item> {
    const formData = new FormData();
    formData.append('title', item.title);
    formData.append('description', item.description);
    
    if (item.images) {
      item.images.forEach((file) => {
        formData.append('images', file);
      });
    }
    
    if (item.videos) {
      item.videos.forEach((file) => {
        formData.append('videos', file);
      });
    }
    
    return fetchWithAuth('/api/items', {
      method: 'POST',
      body: formData,
    });
  },

  async updateItem(id: string, item: { title?: string; description?: string; images?: File[]; videos?: File[]; imageUrls?: string[]; videoUrls?: string[] }): Promise<Item> {
    const formData = new FormData();
    if (item.title) formData.append('title', item.title);
    if (item.description) formData.append('description', item.description);
    
    if (item.images) {
      item.images.forEach((file) => {
        formData.append('images', file);
      });
    }
    
    if (item.videos) {
      item.videos.forEach((file) => {
        formData.append('videos', file);
      });
    }
    
    // If no files but URLs provided, use JSON
    if (!item.images?.length && !item.videos?.length && (item.imageUrls || item.videoUrls)) {
      return fetchWithAuth(`/api/items/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: item.title,
          description: item.description,
          imageUrls: item.imageUrls,
          videoUrls: item.videoUrls,
        }),
      });
    }
    
    return fetchWithAuth(`/api/items/${id}`, {
      method: 'PUT',
      body: formData,
    });
  },

  async deleteItem(id: string): Promise<void> {
    return fetchWithAuth(`/api/items/${id}`, {
      method: 'DELETE',
    });
  },

  // Profile API
  async getProfile(): Promise<Profile> {
    return fetchWithAuth('/api/profiles');
  },

  async createProfile(profile: { displayName: string; bio: string; image?: File }): Promise<Profile> {
    const formData = new FormData();
    formData.append('displayName', profile.displayName);
    formData.append('bio', profile.bio);
    if (profile.image) {
      formData.append('image', profile.image);
    }
    return fetchWithAuth('/api/profiles', {
      method: 'POST',
      body: formData,
    });
  },

  async updateProfile(profile: { displayName?: string; bio?: string; image?: File }): Promise<Profile> {
    const formData = new FormData();
    if (profile.displayName) formData.append('displayName', profile.displayName);
    if (profile.bio !== undefined) formData.append('bio', profile.bio);
    if (profile.image) {
      formData.append('image', profile.image);
    }
    return fetchWithAuth('/api/profiles', {
      method: 'PUT',
      body: formData,
    });
  },

  async uploadImage(image: File): Promise<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('image', image);
    return fetchWithAuth('/api/profiles/image', {
      method: 'POST',
      body: formData,
    });
  },

  /** View preferences (tabs, sort, filter). Saved to user profile. */
  async getViewPreferences(): Promise<ViewPreferences> {
    return fetchWithAuth('/api/profiles/preferences');
  },

  async updateViewPreferences(prefs: Partial<ViewPreferences>): Promise<ViewPreferences> {
    return fetchWithAuth('/api/profiles/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  },

  async resetViewPreferences(): Promise<ViewPreferences> {
    return fetchWithAuth('/api/profiles/preferences', { method: 'DELETE' });
  },

  // Chat API (public endpoint, no auth required)
  async sendChatMessage(
    messages: Array<{ role: string; content: string }>,
    model?: string,
    images?: string[],
    mode?: string,
    video_b64?: string,
    video_mime?: string
  ): Promise<{ message: string; usage?: any }> {
    return fetchPublic('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages,
        model: model || 'openai/gpt-3.5-turbo',
        images: images ?? [],
        mode: mode ?? 'assistant',
        video_b64: video_b64 ?? '',
        video_mime: video_mime ?? 'video/mp4',
      }),
    });
  },

  async chatPipeline(params: {
    audio?: Blob;
    text?: string;
    images?: File[];
    video?: File;
    messages: Array<{ role: string; content: string }>;
    tts: boolean;
    voice: string;
    mode: string;
  }): Promise<{
    message?: string;
    transcribed_text?: string;
    usage?: unknown;
    audio_base64?: string;
    audio_format?: string;
    tts_error?: string;
  }> {
    const fd = new FormData();
    if (params.text) fd.append('text', params.text);
    fd.append('messages', JSON.stringify(params.messages));
    fd.append('tts', params.tts ? 'true' : 'false');
    fd.append('voice', params.voice);
    fd.append('mode', params.mode);
    if (params.audio) fd.append('audio', params.audio, 'audio.webm');
    if (params.images?.length) {
      params.images.forEach((f) => fd.append('images', f));
    }
    if (params.video) fd.append('video', params.video);
    return fetchPublic('/api/chat/pipeline', { method: 'POST', body: fd });
  },

  async textToSpeech(text: string, opts?: { voice?: string }): Promise<Blob> {
    return fetchPublicBlob('/api/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: opts?.voice ?? 'coral' }),
    });
  },

  async askTutor(
    question: string,
    opts: {
      images?: string[];
      video_b64?: string;
      video_mime?: string;
    }
  ): Promise<{ fun: string; help: string[]; raw?: string }> {
    const now = new Date();
    return fetchPublic('/api/tutor', {
      method: 'POST',
      body: JSON.stringify({
        question,
        images: opts.images ?? [],
        video_b64: opts.video_b64 ?? '',
        video_mime: opts.video_mime ?? 'video/mp4',
        weekday: now.toLocaleDateString('en-US', { weekday: 'long' }),
        time: now.toLocaleTimeString(),
      }),
    });
  },

  async transcribeAudio(file: File): Promise<{ text: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return fetchPublic('/api/transcribe', { method: 'POST', body: fd });
  },

  async generateVoice(params: {
    text: string;
    provider: 'openai' | 'magic_hour';
    voice?: string;
    model?: string;
    speed?: number;
    voice_name?: string;
    name?: string;
  }): Promise<Blob> {
    return fetchPublicBlob('/api/voice/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  },

  // OKRs API
  /** Lightweight counts for sidebar; avoids N+1 getKeyResults. */
  async getObjectivesStats(params?: { fiscalYear?: number; departmentId?: string | null }): Promise<{ strategic: number; functional: number; tactical: number; keyResults: number }> {
    const search = new URLSearchParams();
    if (params?.fiscalYear != null) search.set('fiscalYear', String(params.fiscalYear));
    if (params?.departmentId != null && params.departmentId !== '') search.set('departmentId', params.departmentId);
    return fetchWithAuth(`/api/objectives/stats?${search.toString()}`);
  },

  async getObjectives(params?: { fiscalYear?: number; level?: string; division?: string; status?: string; ownerId?: string; departmentId?: string; parentObjectiveId?: string | null }): Promise<Objective[]> {
    const search = new URLSearchParams();
    if (params?.fiscalYear != null) search.set('fiscalYear', String(params.fiscalYear));
    if (params?.level) search.set('level', params.level);
    if (params?.division) search.set('division', params.division);
    if (params?.status) search.set('status', params.status);
    if (params?.ownerId) search.set('ownerId', params.ownerId);
    if (params?.departmentId) search.set('departmentId', params.departmentId);
    if (params?.parentObjectiveId !== undefined) search.set('parentObjectiveId', params.parentObjectiveId ?? '');
    const q = search.toString();
    const cacheKey = q || 'default';
    const now = Date.now();
    const hit = objectivesListCache.get(cacheKey);
    if (hit && now - hit.storedAt < OBJECTIVES_LIST_CACHE_MS) {
      return hit.data;
    }
    const data = (await fetchWithAuth(`/api/objectives${q ? `?${q}` : ''}`)) as Objective[];
    objectivesListCache.set(cacheKey, { storedAt: now, data });
    return data;
  },

  async getObjective(id: string, params?: { since?: string }): Promise<Objective | { unchanged: true }> {
    const url = params?.since
      ? `/api/objectives/${id}?since=${encodeURIComponent(params.since)}`
      : `/api/objectives/${id}`;
    const data = await fetchWithAuth(url);
    if (data && typeof data === 'object' && 'unchanged' in data && data.unchanged === true) {
      return { unchanged: true };
    }
    return data as Objective;
  },

  async postView(objectiveId: string, body?: { userName?: string }): Promise<{ viewers: { userId: string; userName: string }[]; count: number }> {
    return fetchWithAuth(`/api/objectives/${objectiveId}/view`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    });
  },

  async leaveView(objectiveId: string): Promise<void> {
    return fetchWithAuth(`/api/objectives/${objectiveId}/leave`, { method: 'POST' });
  },

  async getObjectiveTree(id: string): Promise<ObjectiveTree> {
    return fetchWithAuth(`/api/objectives/${id}/tree`);
  },

  async createObjective(obj: Partial<Objective> & { title: string; fiscalYear: number }): Promise<Objective> {
    const out = await fetchWithAuth('/api/objectives', {
      method: 'POST',
      body: JSON.stringify(obj),
    });
    invalidateObjectivesListCache();
    return out as Objective;
  },

  async updateObjective(id: string, obj: Partial<Objective>): Promise<Objective> {
    const out = await fetchWithAuth(`/api/objectives/${id}`, {
      method: 'PUT',
      body: JSON.stringify(obj),
    });
    invalidateObjectivesListCache();
    return out as Objective;
  },

  async deleteObjective(id: string): Promise<void> {
    await fetchWithAuth(`/api/objectives/${id}`, { method: 'DELETE' });
    invalidateObjectivesListCache();
  },

  async getKeyResults(objectiveId: string): Promise<KeyResult[]> {
    return fetchWithAuth(`/api/key-results?objectiveId=${encodeURIComponent(objectiveId)}`);
  },

  async getKeyResult(id: string): Promise<KeyResult> {
    return fetchWithAuth(`/api/key-results/${id}`);
  },

  async createKeyResult(kr: { objectiveId: string; title: string; target?: string; currentValue?: string; unit?: string }): Promise<KeyResult> {
    return fetchWithAuth('/api/key-results', {
      method: 'POST',
      body: JSON.stringify(kr),
    });
  },

  async updateKeyResult(id: string, kr: Partial<KeyResult>): Promise<KeyResult> {
    const token = await getAccessToken();
    if (!token) throw new Error('Unable to get access token.');
    const response = await fetch(apiFetchUrl(`/api/key-results/${id}`), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(kr),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 409) {
      throw new ApiConflictError(
        data.message || 'Conflict',
        409,
        data as { current?: KeyResult; error?: string; message?: string }
      );
    }
    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }
    return data as KeyResult;
  },

  async deleteKeyResult(id: string): Promise<void> {
    return fetchWithAuth(`/api/key-results/${id}`, { method: 'DELETE' });
  },

  async getKeyResultHistory(keyResultId: string): Promise<ScoreHistoryEntry[]> {
    return fetchWithAuth(`/api/key-results/${keyResultId}/history`);
  },

  async getWorkflowHistory(objectiveId: string): Promise<WorkflowEvent[]> {
    return fetchWithAuth(`/api/objectives/${objectiveId}/workflow-history`);
  },

  async getDependencies(objectiveId: string): Promise<{
    upstream: Objective[];
    downstream: Objective[];
  }> {
    return fetchWithAuth(`/api/objectives/${objectiveId}/dependencies`);
  },

  /**
   * Set or clear dependency health (0–1, one decimal) on `ownerObjectiveId` for the link to `relatedObjectiveId`.
   * Upstream: owner is this OKR, related is the upstream objective.
   * Downstream: owner is the child OKR, related is this OKR.
   */
  async patchDependencyHealth(
    ownerObjectiveId: string,
    relatedObjectiveId: string,
    score: number | null
  ): Promise<Objective> {
    return fetchWithAuth(`/api/objectives/${ownerObjectiveId}/dependency-health`, {
      method: 'PATCH',
      body: JSON.stringify({ relatedObjectiveId, score }),
    });
  },

  async submitObjective(objectiveId: string): Promise<Objective> {
    return fetchWithAuth(`/api/objectives/${objectiveId}/submit`, { method: 'POST' });
  },

  async approveObjective(objectiveId: string): Promise<Objective> {
    return fetchWithAuth(`/api/objectives/${objectiveId}/approve`, { method: 'POST' });
  },

  async rejectObjective(objectiveId: string, reason?: string): Promise<Objective> {
    return fetchWithAuth(`/api/objectives/${objectiveId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason ?? '' }),
    });
  },

  async resubmitObjective(objectiveId: string): Promise<Objective> {
    return fetchWithAuth(`/api/objectives/${objectiveId}/resubmit`, { method: 'POST' });
  },

  async reopenObjective(objectiveId: string, reason?: string): Promise<Objective> {
    return fetchWithAuth(`/api/objectives/${objectiveId}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason ?? '' }),
    });
  },

  async getComments(objectiveId: string): Promise<Comment[]> {
    return fetchWithAuth(`/api/objectives/${objectiveId}/comments`);
  },

  async createComment(objectiveId: string, body: string): Promise<Comment> {
    return fetchWithAuth(`/api/objectives/${objectiveId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },

  async getAttachments(objectiveId: string): Promise<Attachment[]> {
    return fetchWithAuth(`/api/objectives/${objectiveId}/attachments`);
  },

  async createAttachment(form: {
    objectiveId: string;
    keyResultId?: string | null;
    file?: File;
    url?: string;
    fileName?: string;
    fileSize?: number;
    fileType?: string;
  }): Promise<Attachment> {
    if (form.file) {
      const fd = new FormData();
      fd.append('objectiveId', form.objectiveId);
      if (form.keyResultId) fd.append('keyResultId', form.keyResultId);
      fd.append('file', form.file);
      return fetchWithAuth('/api/attachments', { method: 'POST', body: fd });
    }
    return fetchWithAuth('/api/attachments', {
      method: 'POST',
      body: JSON.stringify({
        objectiveId: form.objectiveId,
        keyResultId: form.keyResultId ?? undefined,
        url: form.url,
        fileName: form.fileName,
        fileSize: form.fileSize,
        fileType: form.fileType,
      }),
    });
  },

  async deleteAttachment(attachmentId: string): Promise<void> {
    return fetchWithAuth(`/api/attachments/${attachmentId}`, { method: 'DELETE' });
  },

  /** Authenticated clients receive the storage URL for preview/download (checks session). */
  async getAttachmentAccess(attachmentId: string): Promise<{
    url: string;
    fileName: string;
    fileType: string;
  }> {
    return fetchWithAuth(`/api/attachments/${attachmentId}/access`);
  },

  async getAttachmentDeletions(objectiveId: string): Promise<AttachmentDeletionAudit[]> {
    return fetchWithAuth(`/api/objectives/${objectiveId}/attachment-deletions`);
  },

  /** Create shareable link for an objective. Returns { token, url, expiresAt }. */
  async createShareLink(objectiveId: string, options?: { expiresInDays?: number }): Promise<{ token: string; url: string; expiresAt?: string | null }> {
    return fetchWithAuth(`/api/objectives/${objectiveId}/share-links`, {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
    });
  },

  /** List share links for an objective. */
  async getShareLinks(objectiveId: string): Promise<Array<{ token: string; url: string; createdAt?: string; expiresAt?: string | null }>> {
    return fetchWithAuth(`/api/objectives/${objectiveId}/share-links`);
  },

  /** Revoke a share link. */
  async revokeShareLink(token: string): Promise<void> {
    return fetchWithAuth(`/api/share-links/${token}`, { method: 'DELETE' });
  },

  /** Get current user outgoing webhook config (masked). */
  async getOutgoingConfig(): Promise<{ webhookUrlMasked?: string | null; channelType?: string | null; channelDisplayName?: string | null; configured: boolean }> {
    return fetchWithAuth('/api/integrations/outgoing');
  },

  /** Save Slack/Teams webhook. Body: { webhookUrl, channelType?, channelDisplayName? }. */
  async saveOutgoingConfig(body: { webhookUrl: string; channelType?: 'slack' | 'teams'; channelDisplayName?: string }): Promise<{ message: string; configured: boolean }> {
    return fetchWithAuth('/api/integrations/outgoing', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /** Send test message to configured webhook. */
  async testOutgoingWebhook(): Promise<{ message: string }> {
    return fetchWithAuth('/api/integrations/outgoing/test', { method: 'POST' });
  },

  /** Get incoming webhook URL for the current user (for automation tools). */
  async getIncomingWebhookUrl(): Promise<{ url: string }> {
    return fetchWithAuth('/api/integrations/incoming-url');
  },

  /** Get Google OAuth URL to connect account for Slides export. */
  async getGoogleAuthUrl(): Promise<{ url: string }> {
    return fetchWithAuth('/api/integrations/google/auth-url');
  },

  /** Get Google OAuth URL to connect Gmail sending (per-user OAuth). */
  async getGoogleEmailAuthUrl(): Promise<{ url: string }> {
    return fetchWithAuth('/api/integrations/google-email/auth-url');
  },

  /** Create Google Slides presentation from OKR tree. Body: { treeRootId } or { objectiveIds: string[] }. */
  async exportToGoogleSlides(body: { treeRootId?: string; objectiveIds?: string[] }): Promise<{ presentationId: string; link: string }> {
    return fetchWithAuth('/api/integrations/google/export', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /** Export selected objectives as PowerPoint (.pptx) and trigger download. Optional narrative is added as a script slide. */
  async exportToPowerPoint(objectiveIds: string[], narrative?: string | null): Promise<void> {
    const token = await getAccessToken();
    if (!token) throw new Error('Unable to get access token.');
    const response = await fetch(apiFetchUrl('/api/objectives/export-pptx'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ objectiveIds, narrative: narrative ?? undefined }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'PowerPoint export failed');
    }
    const blob = await response.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'okr_presentation.pptx';
    a.click();
    URL.revokeObjectURL(a.href);
  },

  /** Generate a professional OKR presentation narrative using AI (OpenRouter). */
  async generatePresentationStory(objectiveIds: string[]): Promise<{ story: string }> {
    return fetchWithAuth('/api/objectives/generate-presentation-story', {
      method: 'POST',
      body: JSON.stringify({ objectiveIds }),
    });
  },

  /** Post current OKR summary to configured Slack/Teams channel. */
  async postUpdateToChannel(objectiveId: string): Promise<{ message: string }> {
    return fetchWithAuth(`/api/objectives/${objectiveId}/post-update`, { method: 'POST' });
  },

  /** Resolve share token (public, no auth). Returns { objective, keyResults }. */
  async getShareByToken(token: string): Promise<{ objective: Objective; keyResults: KeyResult[] }> {
    const res = await fetch(apiFetchUrl(`/api/shares/${encodeURIComponent(token)}`), { credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to load shared OKR: ${res.status}`);
    }
    return res.json();
  },

  /**
   * Trigger download of OKR export (JSON, Excel, or PDF). Uses current filters. view_only users get 403.
   */
  async exportObjectivesDownload(params: {
    format: 'json' | 'xlsx' | 'pdf';
    tree?: boolean;
    fiscalYear?: number;
    level?: string;
    division?: string;
    status?: string;
    ownerId?: string;
    parentObjectiveId?: string | null;
  }): Promise<void> {
    const search = new URLSearchParams();
    search.set('format', params.format);
    if (params.tree) search.set('tree', '1');
    if (params.fiscalYear != null) search.set('fiscalYear', String(params.fiscalYear));
    if (params.level) search.set('level', params.level);
    if (params.division) search.set('division', params.division);
    if (params.status) search.set('status', params.status);
    if (params.ownerId) search.set('ownerId', params.ownerId);
    if (params.parentObjectiveId !== undefined) search.set('parentObjectiveId', params.parentObjectiveId ?? '');
    const url = apiFetchUrl(`/api/objectives/export?${search.toString()}`);
    const token = await getAccessToken();
    if (!token) throw new Error('Unable to get access token.');
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Export failed: ${response.status}`);
    }
    const contentType = response.headers.get('content-type') || '';
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/);
    const defaultNames: Record<string, string> = {
      json: 'okrs_export.json',
      xlsx: 'okrs_export.xlsx',
      pdf: 'okrs_export.pdf',
    };
    const filename = match ? match[1] : defaultNames[params.format];
    if (params.format === 'json' || contentType.includes('application/json')) {
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } else {
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  },
};

/**
 * Postgres requires an org id for `POST /api/orgs/:orgId/departments`. Resolves it from parent objectives,
 * then `GET /orgs` (bootstraps a default org + membership when none exist), then any objective’s `orgId`.
 */
export async function resolveOrgIdForDepartment(parentOptions: Objective[]): Promise<string | undefined> {
  const fromParents = parentOptions.find((o) => o.orgId)?.orgId;
  if (fromParents) return fromParents;
  try {
    const orgs = await api.getOrgs();
    if (orgs[0]?.id) return orgs[0].id;
  } catch {
    // ignore
  }
  try {
    const objs = await api.getObjectives({});
    return objs.find((o) => o.orgId)?.orgId;
  } catch {
    return undefined;
  }
}
