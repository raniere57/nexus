import type { ServiceSnapshot, ServerSnapshot } from '../../shared/types.ts';
import { getServiceSnapshots } from '../services/repository.ts';

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

export function broadcastServerUpdate(snapshot: ServerSnapshot) {
  const payload = JSON.stringify({
    type: 'server_update',
    data: snapshot
  });
  
  for (const ws of subscribers) {
    try {
      ws.send(payload);
    } catch (e) {
      console.error('[WebSocket] Error sending server update, removing subscriber', e);
      subscribers.delete(ws);
    }
  }
}
