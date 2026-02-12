import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { UserService } from './services/User.service.';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router, private userService: UserService) {}

  async canActivate(): Promise<boolean | UrlTree> {
    const msal = (window as any).msalInstance;

    if (!msal) return this.router.parseUrl('/login');

    try {
      await msal.handleRedirectPromise();
    } catch {}

    const accounts = msal.getAllAccounts?.() ?? [];
    if (!accounts.length) return this.router.parseUrl('/login');

    // ensure active account set
    if (!msal.getActiveAccount?.()) {
      msal.setActiveAccount(accounts[0]);
    }

    // ✅ If profile not loaded, load it now (so header shows name)
    if (!localStorage.getItem('user_data')) {
      try {
        const me = await this.userService.fetchMe();   // implement below
        this.userService.setUser(me);
      } catch (e) {
        // if /me fails, still allow navigation or force login based on your choice
        console.error('Failed to load /me', e);
      }
    } else {
      this.userService.getUser(); // hydrate subject from storage
    }

    return true;
  }
}