import { app, shell } from 'electron';
import http from 'node:http';
import { getSupabaseClient } from './supabase-client';
import type { AuthResult, SessionResult } from '../shared/types';

type OAuthCompleteCallback = (result: AuthResult) => void;

const SUCCESS_HTML = `<!DOCTYPE html><html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#faf9f5">
<div style="text-align:center"><h1 style="font-size:48px;margin:0">✅</h1><h2 style="color:#141413">Sign-in successful</h2><p style="color:#888">You can close this tab and return to Typeless.</p></div>
</body></html>`;

const FAILURE_HTML = (msg: string) => `<!DOCTYPE html><html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#faf9f5">
<div style="text-align:center"><h1 style="font-size:48px;margin:0">❌</h1><h2 style="color:#141413">Sign-in failed</h2><p style="color:#888">${msg}</p></div>
</body></html>`;

export class AuthService {
  private _onOAuthComplete: OAuthCompleteCallback | null = null;
  private _callbackServer: http.Server | null = null;

  set onOAuthComplete(cb: OAuthCompleteCallback | null) {
    this._onOAuthComplete = cb;
  }

  async signUp(email: string, password: string, displayName: string): Promise<AuthResult> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) return { success: false, error: this.getErrorMessage(error) };
    return {
      success: true,
      user: { id: data.user!.id, email, displayName },
    };
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: this.getErrorMessage(error) };
    return {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email!,
        displayName: data.user.user_metadata?.display_name || '',
      },
    };
  }

  async signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
    const redirectTo = app.isPackaged
      ? 'typeless://auth/callback'
      : await this.startCallbackServer();

    console.log(`[Auth] OAuth mode: ${app.isPackaged ? 'packaged (custom protocol)' : 'dev (localhost)'}`);
    console.log(`[Auth] Redirect URL: ${redirectTo}`);

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) {
      this.stopCallbackServer();
      return { success: false, error: error.message };
    }
    if (data?.url) {
      shell.openExternal(data.url);
    }
    return { success: true };
  }

  async handleOAuthCallback(url: string): Promise<AuthResult> {
    const parsedUrl = new URL(url);
    const code = parsedUrl.searchParams.get('code');
    if (!code) {
      return { success: false, error: 'No authorization code received' };
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { success: false, error: error.message };
    return {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email!,
        displayName: data.user.user_metadata?.full_name || data.user.user_metadata?.display_name || data.user.email!.split('@')[0],
      },
    };
  }

  async signOut(): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    return { success: !error, error: error?.message };
  }

  async getSession(): Promise<SessionResult> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return { isAuthenticated: false };
    return {
      isAuthenticated: true,
      user: {
        id: data.session.user.id,
        email: data.session.user.email!,
        displayName: data.session.user.user_metadata?.display_name || '',
      },
    };
  }

  /**
   * Dev mode only: start a temporary HTTP server on a random port to receive
   * the OAuth callback from Supabase. Auto-closes after receiving the callback
   * or after 5 minutes (timeout).
   */
  private startCallbackServer(): Promise<string> {
    this.stopCallbackServer();

    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        if (!req.url?.startsWith('/auth/callback')) {
          res.writeHead(404);
          res.end();
          return;
        }

        const fullUrl = `http://localhost:${port}${req.url}`;
        console.log(`[Auth] Dev callback received: ${req.url}`);

        const result = await this.handleOAuthCallback(fullUrl);

        if (result.success) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(SUCCESS_HTML);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(FAILURE_HTML(result.error || 'Unknown error'));
        }

        this._onOAuthComplete?.(result);
        setTimeout(() => this.stopCallbackServer(), 1000);
      });

      let port = 0;
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') {
          reject(new Error('Failed to start callback server'));
          return;
        }
        port = addr.port;
        console.log(`[Auth] Dev callback server listening on port ${port}`);
        resolve(`http://localhost:${port}/auth/callback`);
      });

      server.on('error', reject);
      this._callbackServer = server;

      setTimeout(() => {
        console.log('[Auth] Dev callback server timed out');
        this.stopCallbackServer();
      }, 5 * 60 * 1000);
    });
  }

  private stopCallbackServer(): void {
    if (this._callbackServer) {
      this._callbackServer.close();
      this._callbackServer = null;
    }
  }

  private getErrorMessage(error: any): string {
    switch (error.code) {
      case 'invalid_credentials': return 'Invalid email or password';
      case 'email_not_confirmed': return 'Please verify your email address first';
      case 'user_already_exists': return 'This email is already registered';
      case 'weak_password': return 'Password is too weak, at least 6 characters required';
      default: break;
    }
    if (error.message?.includes('Invalid login credentials')) return 'Invalid email or password';
    if (error.status === 429) return 'Too many attempts, please try again later';
    return error.message || 'An unknown error occurred';
  }
}
