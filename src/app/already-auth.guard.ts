import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { UserService } from './services/User.service.';

@Injectable({ providedIn: 'root' })
export class AlreadyAuthGuard implements CanActivate {
  constructor(private router: Router, private userService: UserService) {}


  async canActivate(): Promise<boolean | UrlTree> {
    const msal = (window as any).msalInstance;
    if (!msal) return true;

    try {
      await msal.handleRedirectPromise();
    } catch {}

    const hasAccount = (msal.getAllAccounts?.().length ?? 0) > 0;

    // ✅ Hydrate user service from localStorage so getUserName() works in UI
    // (this reads localStorage and pushes into BehaviorSubject)
    this.userService.getUser();

    return hasAccount ? this.router.parseUrl('/workitems') : true;
  }
}

