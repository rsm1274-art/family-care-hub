import type {
  AuthResponse,
  DocumentDto,
  HealthResponse,
  HouseholdExport,
  ImportLegacyResult,
  ImportResult,
  LegacyBackupFile,
  LoginRequest,
  MedicationDto,
  MedicationInput,
  PersonDto,
  PersonInput,
  RegisterRequest,
  UserDto,
} from '@familycarehub/shared-types';

const TOKEN_KEY = 'fch_token';
const USER_KEY = 'fch_user';
const SERVER_URL_KEY = 'fch_server_url';
const DEFAULT_SERVER_URL = 'http://localhost:4000';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getServerUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) || DEFAULT_SERVER_URL;
}

function setServerUrl(url: string): void {
  localStorage.setItem(SERVER_URL_KEY, url.replace(/\/+$/, ''));
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getUser(): UserDto | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserDto;
  } catch {
    return null;
  }
}

function storeSession(auth: AuthResponse): void {
  localStorage.setItem(TOKEN_KEY, auth.token);
  localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
}

function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: { auth?: boolean } = { auth: true }
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth !== false) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(getServerUrl() + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) return undefined as T;

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // fall through with null body
  }

  if (!res.ok) {
    const message =
      (json as { error?: string } | null)?.error || `Request failed (${res.status})`;
    // An expired/invalid token means the session is dead — drop it so the
    // app returns to the login screen instead of erroring forever.
    if (res.status === 401 && opts.auth !== false) clearSession();
    throw new ApiError(res.status, message);
  }
  return json as T;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  // Components render `data:image/jpeg;base64,${x}` — return the bare payload.
  return dataUrl.split(',')[1];
}

export const apiClient = {
  getServerUrl,
  setServerUrl,
  getUser,
  isLoggedIn(): boolean {
    return !!getToken();
  },

  async health(serverUrl?: string): Promise<HealthResponse> {
    const base = (serverUrl || getServerUrl()).replace(/\/+$/, '');
    const res = await fetch(`${base}/api/health`);
    if (!res.ok) throw new ApiError(res.status, `Health check failed (${res.status})`);
    return (await res.json()) as HealthResponse;
  },

  async register(req: RegisterRequest): Promise<UserDto> {
    const auth = await request<AuthResponse>('POST', '/api/auth/register', req, { auth: false });
    storeSession(auth);
    return auth.user;
  },

  async login(req: LoginRequest): Promise<UserDto> {
    const auth = await request<AuthResponse>('POST', '/api/auth/login', req, { auth: false });
    storeSession(auth);
    return auth.user;
  },

  logout(): void {
    clearSession();
  },

  // --- People ---
  listPeople: () => request<PersonDto[]>('GET', '/api/people'),
  createPerson: (input: PersonInput) => request<PersonDto>('POST', '/api/people', input),
  updatePerson: (id: string, input: PersonInput) =>
    request<PersonDto>('PUT', `/api/people/${id}`, input),
  deletePerson: (id: string) => request<void>('DELETE', `/api/people/${id}`),

  // --- Medications ---
  listMedications: (personId: string) =>
    request<MedicationDto[]>('GET', `/api/people/${personId}/medications`),
  createMedication: (personId: string, input: MedicationInput) =>
    request<MedicationDto>('POST', `/api/people/${personId}/medications`, input),
  updateMedication: (id: string, input: MedicationInput) =>
    request<MedicationDto>('PUT', `/api/medications/${id}`, input),
  deleteMedication: (id: string) => request<void>('DELETE', `/api/medications/${id}`),
  uploadMedicationImage: (id: string, imageBase64: string) =>
    request<MedicationDto>('POST', `/api/medications/${id}/image`, { imageBase64 }),

  // --- Documents ---
  listDocuments: (personId: string) =>
    request<DocumentDto[]>('GET', `/api/people/${personId}/documents`),

  /** Fetch a stored image and return it as bare base64 for the existing UI. */
  async fetchImageBase64(personId: string, filename: string): Promise<string | null> {
    const token = getToken();
    if (!token) return null;
    const res = await fetch(`${getServerUrl()}/api/images/${personId}/${filename}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return blobToBase64(await res.blob());
  },

  importLegacy: (backup: LegacyBackupFile) =>
    request<ImportLegacyResult>('POST', '/api/backup/import-legacy', backup),

  // --- Full household backup ---
  exportBackup: (personIds?: string[]) => {
    const query = personIds && personIds.length > 0
      ? `?personIds=${personIds.map(encodeURIComponent).join(',')}`
      : '';
    return request<HouseholdExport>('GET', `/api/backup/export${query}`);
  },
  importBackup: (data: HouseholdExport) =>
    request<ImportResult>('POST', '/api/backup/import', data),
};
