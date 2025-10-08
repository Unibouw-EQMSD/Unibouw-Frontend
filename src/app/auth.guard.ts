import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  private msal = (window as any).msalInstance;

constructor(private router: Router) {}

canActivate(): boolean | UrlTree {
    const hasAccount = !!this.msal && typeof this.msal.getAllAccounts === 'function' && this.msal.getAllAccounts().length > 0;
    const hasUserData = !!localStorage.getItem('user_data'); // set this after your /getMe call

if (hasAccount && hasUserData) return true;

return this.router.parseUrl('/login');
  }
}