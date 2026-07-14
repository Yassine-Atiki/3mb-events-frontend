import { Injectable } from '@angular/core';

import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          prompt: (momentListener?: (notification: GooglePromptNotification) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}

export interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

export interface GooglePromptNotification {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  getNotDisplayedReason?: () => string;
  getSkippedReason?: () => string;
}

/**
 * Loads Google Identity Services once and returns an ID token (JWT credential).
 */
@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private scriptPromise: Promise<void> | null = null;

  ensureScriptLoaded(): Promise<void> {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      return Promise.resolve();
    }
    if (this.scriptPromise) {
      return this.scriptPromise;
    }

    this.scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-gis="true"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Impossible de charger Google Sign-In.')));
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset['gis'] = 'true';
      script.onload = () => resolve();
      script.onerror = () => {
        this.scriptPromise = null;
        reject(new Error('Impossible de charger Google Sign-In.'));
      };
      document.head.appendChild(script);
    });

    return this.scriptPromise;
  }

  /**
   * Opens Google account picker / One Tap and resolves with the ID token credential.
   */
  async requestIdToken(): Promise<string> {
    const clientId = environment.googleClientId;
    if (!clientId) {
      throw new Error('Google Client ID non configuré.');
    }

    await this.ensureScriptLoaded();

    try {
      return await this.promptForCredential(clientId, true);
    } catch {
      return this.promptForCredential(clientId, false);
    }
  }

  private promptForCredential(clientId: string, useFedCm: boolean): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const google = window.google;
      if (!google?.accounts?.id) {
        reject(new Error('Google Sign-In indisponible.'));
        return;
      }

      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };

      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response?.credential) {
            finish(() => resolve(response.credential));
          } else {
            finish(() => reject(new Error('Connexion Google annulée.')));
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: useFedCm
      });

      google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          finish(() =>
            reject(
              new Error(
                'Google Sign-In indisponible pour le moment. Vérifiez les cookies tiers / pop-ups, ou réessayez.'
              )
            )
          );
        }
      });
    });
  }
}
