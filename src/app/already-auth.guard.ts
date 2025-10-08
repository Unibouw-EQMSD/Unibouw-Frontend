import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AlreadyAuthGuard implements CanActivate {
  constructor(private router: Router) {}

canActivate(): boolean | UrlTree {
    const msal = (window as any).msalInstance;
    const hasAccount = !!msal && typeof msal.getAllAccounts === 'function' && msal.getAllAccounts().length > 0;
    const hasUserData = !!localStorage.getItem('user_data'); // set after /getMe

// If authenticated, redirect away from /login
    if (hasAccount && hasUserData) {
      return this.router.parseUrl('/workitems'); // target after login
    }
    return true;
  }
}