import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export type AddNotificationInput = Pick<Notification, 'title' | 'message'> &
  Partial<Pick<Notification, 'id' | 'read' | 'createdAt'>>;

interface NotificationState {
  notifications: Notification[];
}

const initialState: NotificationState = {
  notifications: []
};

export const NotificationStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ notifications }) => ({
    unreadCount: computed(() => notifications().filter((notification) => !notification.read).length)
  })),
  withMethods((store) => ({
    add(input: AddNotificationInput): void {
      const notification: Notification = {
        id: input.id ?? crypto.randomUUID(),
        title: input.title,
        message: input.message,
        read: input.read ?? false,
        createdAt: input.createdAt ?? new Date().toISOString()
      };
      patchState(store, { notifications: [notification, ...store.notifications()] });
    },
    markRead(id: string): void {
      patchState(store, {
        notifications: store.notifications().map((notification) =>
          notification.id === id ? { ...notification, read: true } : notification
        )
      });
    },
    markAllRead(): void {
      patchState(store, {
        notifications: store.notifications().map((notification) => ({ ...notification, read: true }))
      });
    },
    remove(id: string): void {
      patchState(store, {
        notifications: store.notifications().filter((notification) => notification.id !== id)
      });
    },
    clear(): void {
      patchState(store, { notifications: [] });
    }
  }))
);
