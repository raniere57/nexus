import type { ServiceSnapshot } from '../../shared/types.js';
import { getServiceSnapshots } from '../services/repository.js';

let subscribers = new Set<any>(); // Simple set to hold ws connections

export function addSubscriber(ws: any) {
  subscribers.add(ws);
}

export function removeSubscriber(ws: any) {
  subscribers.delete(ws);
}

export function broadcastStatusUpdate(snapshot: ServiceSnapshot) {
  const payload = JSON.stringify({
    type: 'status_update',
    data: snapshot
  });
  
  for (const ws of subscribers) {
    try {
      ws.send(payload);
    } catch (e) {
      console.error('[WebSocket] Error sending update, removing subscriber', e);
      subscribers.delete(ws);
    }
  }
}
