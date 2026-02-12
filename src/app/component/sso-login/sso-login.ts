import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PublicClientApplication, AuthenticationResult } from '@azure/msal-browser';
import { AppConfigService } from '../../services/app.config.service';
import { UserService } from '../../services/User.service.';

interface MeResponse {
  name: string;
  email: string;
  roles: string;
  scopes?: string;
}

@Component({
  selector: 'app-sso-login',
  templateUrl: './sso-login.html',
  styleUrls: ['./sso-login.css'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class SSOLogin implements OnInit {
  loading = false;
  email: string = '';

  private msalInstance: PublicClientApplication;
  private apiURL: string = '';
  private getMeEndpoint: string = '';
  private redirectUri: string = '';
  private scopes: string[] = [];

  constructor(
    private http: HttpClient,
    private router: Router,
    private appConfigService: AppConfigService,  private userService: UserService

  ) {
    this.msalInstance = (window as any).msalInstance;

    const config = this.appConfigService.getConfig();
    this.apiURL = config.apiURL;
    this.getMeEndpoint = config.getMeEndpoint || '/Users/me';
    this.redirectUri = config.redirectUri || `${window.location.origin}/`;
    this.scopes = config.scopes || ['user.read'];
  }

  // single ngOnInit()
async ngOnInit() {
  this.loading = true;
  console.log('[SSOLogin] ngOnInit fired');

  try {
    const result = await this.msalInstance.handleRedirectPromise();

    if (result?.account) {
      console.log('[SSOLogin] redirect result account found');
      this.msalInstance.setActiveAccount(result.account);
      await this.continueLoginFlow(result.account);
      return;
    }

    const activeAccount = this.msalInstance.getActiveAccount();
    if (activeAccount) {
      console.log('[SSOLogin] active account found');
      await this.continueLoginFlow(activeAccount);
      return;
    }

    const accounts = this.msalInstance.getAllAccounts();
    console.log('[SSOLogin] accounts length:', accounts.length);

    // ✅ ADD THIS: handle "accounts exist but no active account"
    if (accounts.length > 0) {
      console.log('[SSOLogin] setting first account as active');
      this.msalInstance.setActiveAccount(accounts[0]);
      await this.continueLoginFlow(accounts[0]);
      return;
    }
  } catch (error) {
    console.error('❌ Redirect handling failed:', error);
  } finally {
    this.loading = false;
  }
}
  // Login button click handler
  async onSubmit(emailRef: any) {
    if (emailRef.invalid) {
      emailRef.control.markAsTouched();
      console.warn('⚠️ Email field invalid');
      return;
    }

    await this.msalInstance.loginRedirect({
      scopes: this.scopes,
      loginHint: this.email,
      redirectUri: this.redirectUri,
    });
  }

  // Common function for silent token + API call
private async continueLoginFlow(account: any) {
  try {
    this.loading = true;

    const result: AuthenticationResult = await this.msalInstance.acquireTokenSilent({
      scopes: this.scopes,
      account,
    });

    const token = result.accessToken;
    localStorage.setItem('access_token', token);

    const me = await firstValueFrom(
      this.http.get<MeResponse>(`${this.apiURL}${this.getMeEndpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );


const normalizedMe: MeResponse = {
  name: (me as any).name ?? (me as any).displayName ?? (me as any).userName ?? '',
  email: (me as any).email ?? (me as any).mail ?? (me as any).upn ?? '',
  roles: (me as any).roles ?? '',
  scopes: (me as any).scopes,
};

localStorage.setItem('user_data', JSON.stringify(normalizedMe));
this.userService.setUser(normalizedMe);

    await this.router.navigate(['/workitems'], { replaceUrl: true });
  } catch (error) {
    console.error('❌ continueLoginFlow failed:', error);
    alert('Login failed. Please try again.');
  } finally {
    this.loading = false;
  }
}
}
