import type { ActivityItem, ConflictItem, Facility, FollowupItem, MonthlyPlan, PlanStats, User } from './types';

const BASE = 'http://localhost:4000';
const SERVER_URL_KEY = 'menoufia_server_url';

export function getServerUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) || BASE;
}

export function setServerUrl(url: string): void {
  localStorage.setItem(SERVER_URL_KEY, url.replace(/\/+$/, ''));
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request(path: string, options: RequestInit = {}, userCode?: string) {
  const baseUrl = getServerUrl();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (userCode) headers['x-user-code'] = userCode;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `HTTP ${res.status}`, res.status);
  }
  return data;
}

export const api = {
  login: (code: string): Promise<{ user: User }> =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ code }) }),

  getPlans: (code: string): Promise<{ plans: MonthlyPlan[] }> =>
    request('/api/plans', { method: 'GET' }, code),

  uploadPlanExcel: (
    code: string,
    monthLabel: string,
    file: File,
    onUploadProgress?: (percent: number) => void
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const baseUrl = getServerUrl();
      xhr.open('POST', `${baseUrl}/api/plans/upload`);
      xhr.setRequestHeader('x-user-code', code);

      if (xhr.upload && onUploadProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            onUploadProgress(pct);
          }
        };
      }

      xhr.onload = () => {
        let data: any = {};
        try {
          data = JSON.parse(xhr.responseText || '{}');
        } catch {
          data = { error: xhr.statusText || 'حدث خطأ في الخادم' };
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new ApiError(data.error || `خطأ ${xhr.status}: ${xhr.statusText}`, xhr.status));
        }
      };

      xhr.onerror = () => {
        reject(new ApiError('فشل الاتصال بالسيرفر. تأكد من تشغيل السيرفر وعنوان الشبكة.', 0));
      };

      xhr.ontimeout = () => {
        reject(new ApiError('انتهت مهلة الانتظار أثناء معالجة المستند. يرجى التأكد من وضوح الصفحات أو المحاولة مجدداً.', 408));
      };

      xhr.timeout = 240000; // 4 minutes timeout for multi-page OCR

      const form = new FormData();
      form.append('month_label', monthLabel);
      form.append('file', file, file.name);
      xhr.send(form);
    });
  },

  getFacilities: (code: string, planId: string): Promise<{ facilities: Facility[] }> =>
    request(`/api/plans/${planId}/facilities`, { method: 'GET' }, code),

  getFeed: (code: string, planId: string): Promise<{ feed: ActivityItem[] }> =>
    request(`/api/plans/${planId}/feed`, { method: 'GET' }, code),

  reserveFacility: (code: string, facilityId: string) =>
    request(`/api/facilities/${facilityId}/reserve`, { method: 'POST' }, code),

  completeFacility: (code: string, facilityId: string, payload: Record<string, unknown>) =>
    request(`/api/facilities/${facilityId}/complete`, { method: 'POST', body: JSON.stringify(payload) }, code),

  releaseFacility: (code: string, facilityId: string) =>
    request(`/api/facilities/${facilityId}/release`, { method: 'POST' }, code),

  getStats: (code: string, planId: string): Promise<PlanStats> =>
    request(`/api/plans/${planId}/stats`, { method: 'GET' }, code),

  getFollowups: (code: string): Promise<{ followups: FollowupItem[] }> =>
    request('/api/followups', { method: 'GET' }, code),

  markFollowupDone: (code: string, inspectionId: string) =>
    request(`/api/inspections/${inspectionId}/followup-done`, { method: 'POST' }, code),

  getConflicts: (code: string): Promise<{ conflicts: ConflictItem[] }> =>
    request('/api/conflicts', { method: 'GET' }, code),

  resolveConflict: (code: string, id: string, decision: 'discard' | 'replace') =>
    request(`/api/conflicts/${id}/resolve`, { method: 'POST', body: JSON.stringify({ decision }) }, code),

  exportUrl: (code: string, planId: string) =>
    `${getServerUrl()}/api/plans/${planId}/export.xlsx?code=${encodeURIComponent(code)}`,

  unlockFacility: (code: string, facilityId: string) =>
    request(`/api/facilities/${facilityId}/unlock`, { method: 'POST' }, code),

  getWorkers: (code: string): Promise<{ workers: User[] }> =>
    request('/api/workers', { method: 'GET' }, code),

  createWorker: (code: string, name: string, workerCode: string) =>
    request('/api/workers', { method: 'POST', body: JSON.stringify({ name, code: workerCode }) }, code),

  toggleWorker: (code: string, workerId: string) =>
    request(`/api/workers/${workerId}/toggle`, { method: 'PATCH' }, code),

  syncBatch: (code: string, operations: unknown[]) =>
    request('/api/sync/batch', { method: 'POST', body: JSON.stringify({ operations }) }, code),
};
