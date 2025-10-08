import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AccountInfo, PublicClientApplication } from '@azure/msal-browser';
import { UserService } from '../../services/User.service.';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header {
  private msalInstance: PublicClientApplication;

constructor(public router: Router,private userService: UserService) {
    this.msalInstance = (window as any).msalInstance;
  }
  isProjectsActive(): boolean {
    return this.router.url.startsWith('/projectdetails') ||
      this.router.url.startsWith('/rfq') ||
      this.router.url.startsWith('/add-rfq')||
      this.router.url.startsWith('/view-projects');

  }

  isWorkitemActive(): boolean {
    return this.router.url.startsWith('/workitems') ||
      this.router.url.startsWith('/add-workitem');
  }

  isSubcontractorActive(): boolean {
    return this.router.url.startsWith('/subcontractor') ||
      this.router.url.startsWith('/add-subcontractor');
  }

getUserName(): string {
    return this.userService.getUserName();
  }

// Get user email from your API response
  getUserEmail(): string {
    return this.userService.getUserEmail();
  }

async signOut() {
    try {
      // app state cleanup
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_data');
      this.msalInstance.setActiveAccount(null);

const accounts: AccountInfo[] = this.msalInstance.getAllAccounts();

if (accounts.length) {
        // proper AAD logout, then back to /login
        await this.msalInstance.logoutRedirect({
          account: accounts[0],
          postLogoutRedirectUri: `${window.location.origin}/login`
        });
        return; // browser will navigate
      }

// fallback: no accounts, just go to login
      this.router.navigate(['/login']);
    } catch {
      // last-resort
      localStorage.clear();
      this.router.navigate(['/login']);
    }
  }
}
