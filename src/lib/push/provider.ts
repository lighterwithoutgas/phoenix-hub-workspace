// Push-notification abstraction (Firebase Cloud Messaging). Mock logs to console.
export interface PushProvider {
  send(userId: string, title: string, body: string): Promise<void>;
}

export class MockPushProvider implements PushProvider {
  async send(userId: string, title: string, _body?: string) {
    if (typeof console !== "undefined") console.info("[mock-push]", userId, title);
  }
}
