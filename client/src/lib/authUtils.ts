import { AuthUser } from '../hooks/useAuth';

class AuthClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '';
  }

  async getUser(): Promise<AuthUser | null> {
    try {
      const response = await fetch('/api/auth/user', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return null;
        }
        throw new Error('Failed to get user');
      }

      const data = await response.json();
      return data.user;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  login() {
    // Redirect to Replit Auth login
    window.location.href = '/api/auth/login';
  }

  async logout() {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to logout');
      }
    } catch (error) {
      console.error('Error during logout:', error);
      throw error;
    }
  }

  async getLoginStatus(): Promise<boolean> {
    const user = await this.getUser();
    return !!user;
  }
}

export const authClient = new AuthClient();

export async function requireAuth(): Promise<boolean> {
  const isLoggedIn = await authClient.getLoginStatus();
  if (!isLoggedIn) {
    authClient.login();
    return false;
  }
  return true;
}