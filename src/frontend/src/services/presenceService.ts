import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { getToken } from '@/services/api/apiClient';

let connection: HubConnection | null = null;

export function getPresenceConnection(): HubConnection {
  if (!connection) {
    connection = new HubConnectionBuilder()
      .withUrl('/api/hubs/presence', {
        accessTokenFactory: () => getToken() || '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    // Server sends keepalives every 15s; client must allow at least 2x that
    // before declaring a timeout. Default (30s) was too close to the old 30s
    // keepalive interval, causing spurious disconnects on minor network jitter.
    connection.serverTimeoutInMilliseconds = 60_000;
    connection.keepAliveIntervalInMilliseconds = 15_000;
  }
  return connection;
}

export async function startPresenceConnection(): Promise<void> {
  const conn = getPresenceConnection();
  if (conn.state === HubConnectionState.Disconnected) {
    try {
      await conn.start();
    } catch {
      // Presence is non-critical — fail silently
    }
  }
}

export async function stopPresenceConnection(): Promise<void> {
  if (connection && connection.state !== HubConnectionState.Disconnected) {
    try {
      await connection.stop();
    } catch {
      // Ignore cleanup errors
    }
  }
  connection = null;
}
