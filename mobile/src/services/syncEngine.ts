import NetInfo from '@react-native-community/netinfo';
import { api, ApiError } from './api';
import {
  enqueueSyncAction,
  getFacilitiesCache,
  getFeedCache,
  getPlansCache,
  getSyncQueue,
  removeSyncQueueItem,
  saveFacilitiesCache,
  saveFeedCache,
  savePlansCache,
  updateFacilityLocal,
} from '../db/localDb';
import { Facility, Inspection, SyncReport, User } from '../types';

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

const EMPTY_REPORT: SyncReport = { synced: 0, conflicts: [], rejected: [] };

// Pushes queued offline actions. Never throws: a failed flush simply leaves the queue for the next attempt.
export async function flushSyncQueue(userCode: string): Promise<SyncReport> {
  try {
    if (!(await isOnline())) return EMPTY_REPORT;
    const queue = await getSyncQueue();
    if (queue.length === 0) return EMPTY_REPORT;

    const operations = queue.map((q) => ({
      queue_id: q.queue_id,
      facility_id: q.facility_id,
      action: q.action,
      payload: JSON.parse(q.payload_json || '{}'),
      created_at: q.created_at,
    }));

    const res = await api.syncBatch(userCode, operations);
    const report: SyncReport = { synced: 0, conflicts: [], rejected: [] };
    for (const r of (res.results || []) as any[]) {
      // Every result is final on the server side (applied / saved for admin review / rejected), so drop it from the queue.
      await removeSyncQueueItem(r.queue_id);
      if (r.status === 'applied') report.synced++;
      else if (r.status === 'conflict') report.conflicts.push({ facility_name: r.facility_name || '', reason: r.reason || '' });
      else if (r.status === 'rejected') report.rejected.push({ facility_name: r.facility_name || '', reason: r.reason || '' });
    }
    return report;
  } catch {
    return EMPTY_REPORT;
  }
}

// Human-readable summary of a sync report (used for the alert shown after reconnecting)
export function describeSyncReport(r: SyncReport): string | null {
  const lines: string[] = [];
  if (r.synced > 0) lines.push(`تمت مزامنة ${r.synced} عملية بنجاح.`);
  r.conflicts.forEach((c) => lines.push(`⚠️ ${c.facility_name}: ${c.reason}`));
  r.rejected.forEach((c) => lines.push(`❌ ${c.facility_name}: ${c.reason}`));
  return lines.length ? lines.join('\n') : null;
}

export async function loadPlansOfflineFirst(userCode: string) {
  await flushSyncQueue(userCode);
  try {
    const { plans } = await api.getPlans(userCode);
    await savePlansCache(plans);
    return { plans, offline: false };
  } catch {
    const cached = await getPlansCache();
    return { plans: cached, offline: true };
  }
}

export async function loadPlanDataOfflineFirst(userCode: string, planId: string) {
  await flushSyncQueue(userCode);
  try {
    const [{ facilities }, { feed }] = await Promise.all([
      api.getFacilities(userCode, planId),
      api.getFeed(userCode, planId),
    ]);
    await saveFacilitiesCache(planId, facilities);
    await saveFeedCache(planId, feed);
    return { facilities, feed, offline: false };
  } catch {
    const [facilities, feed] = await Promise.all([getFacilitiesCache(planId), getFeedCache(planId)]);
    return { facilities, feed, offline: true };
  }
}

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Server reachable but said no (e.g. already reserved by a colleague) -> surface the reason, do NOT queue.
// Only genuine network failures are queued for later.
export async function reserveFacilityOfflineFirst(user: User, facility: Facility): Promise<{ facility: Facility; queued: boolean }> {
  try {
    const res = await api.reserveFacility(user.code, facility.id);
    await updateFacilityLocal(res.facility);
    return { facility: res.facility, queued: false };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const now = new Date().toISOString();
    const updated: Facility = { ...facility, status: 'reserved', reserved_by_id: user.id, reserved_by_name: user.name, reserved_at: now };
    await updateFacilityLocal(updated);
    await enqueueSyncAction({
      queue_id: newId(`reserve_${facility.id}`),
      facility_id: facility.id,
      action: 'reserve',
      payload_json: '{}',
      created_at: now,
    });
    return { facility: updated, queued: true };
  }
}

export async function releaseFacilityOfflineFirst(user: User, facility: Facility): Promise<{ facility: Facility; queued: boolean }> {
  try {
    const res = await api.releaseFacility(user.code, facility.id);
    await updateFacilityLocal(res.facility);
    return { facility: res.facility, queued: false };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const updated: Facility = { ...facility, status: 'available', reserved_by_id: null, reserved_by_name: null, reserved_at: null };
    await updateFacilityLocal(updated);
    await enqueueSyncAction({
      queue_id: newId(`release_${facility.id}`),
      facility_id: facility.id,
      action: 'release',
      payload_json: '{}',
      created_at: new Date().toISOString(),
    });
    return { facility: updated, queued: true };
  }
}

type CompletePayload = Omit<Inspection, 'id' | 'facility_id' | 'plan_id' | 'worker_id' | 'worker_name' | 'created_at'>;

export async function completeInspectionOfflineFirst(
  user: User,
  facility: Facility,
  payload: CompletePayload
): Promise<{ facility: Facility; queued: boolean }> {
  // client_id makes retries idempotent: if the request reached the server but the reply was lost,
  // the queued retry will not create a second inspection.
  const withId: CompletePayload = { ...payload, client_id: payload.client_id || newId('insp') };
  try {
    const res = await api.completeFacility(user.code, facility.id, withId as unknown as Record<string, unknown>);
    const merged: Facility = { ...res.facility, inspection: res.inspection };
    await updateFacilityLocal(merged);
    return { facility: merged, queued: false };
  } catch (e) {
    // Rejected by the server (validation/conflict): keep the form open so the field data is not lost.
    if (e instanceof ApiError) throw e;
    const now = new Date().toISOString();
    const localInspection: Inspection = {
      id: `local_${Date.now()}`,
      facility_id: facility.id,
      plan_id: facility.plan_id,
      worker_id: user.id,
      worker_name: user.name,
      ...withId,
      created_at: now,
    };
    const updated: Facility = {
      ...facility,
      status: 'completed',
      completed_by_id: user.id,
      completed_by_name: user.name,
      completed_at: now,
      visit_outcome: withId.visit_outcome || 'inspected',
      inspection: localInspection,
    };
    await updateFacilityLocal(updated);
    await enqueueSyncAction({
      queue_id: newId(`complete_${facility.id}`),
      facility_id: facility.id,
      action: 'complete',
      payload_json: JSON.stringify(withId),
      created_at: now,
    });
    return { facility: updated, queued: true };
  }
}
