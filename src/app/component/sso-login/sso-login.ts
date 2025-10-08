import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PublicClientApplication, AuthenticationResult } from '@azure/msal-browser';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface MeResponse {
  name: string;
  email: string;
  roles: string;
  scopes: string;
}

@Component({
  selector: 'app-sso-login',
  templateUrl: './sso-login.html',
  styleUrls: ['./sso-login.css'],
  standalone: true,
   imports: [CommonModule, FormsModule]
})
export class SSOLogin implements OnInit {
  loading = false;
email: string = '';
  private msalInstance: PublicClientApplication;

  constructor(private http: HttpClient, private router: Router) {
    this.msalInstance = (window as any).msalInstance;
  }

  async ngOnInit() {
    const res = await this.msalInstance.handleRedirectPromise().catch(err => {
      console.error('MSAL handleRedirectPromise error:', err);
      return null;
    });

    if (res?.account) {
      this.msalInstance.setActiveAccount(res.account);
    } else {
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length === 1) this.msalInstance.setActiveAccount(accounts[0]);
    }

    const accounts = this.msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      this.loading = true;
      try {
        await this.continueLoginFlow(accounts[0]);
      } catch (e) {
        console.error('Continue login flow failed:', e);
      } finally {
        this.loading = false;
      }
    }
  }

  async onSubmit() {
  if (!this.email) return alert('Please enter your email.');
  this.loading = true;

  try {
    const accounts = this.msalInstance.getAllAccounts();

    if (accounts.length === 0) {
      // First click: redirect to Microsoft login
      await this.msalInstance.loginRedirect({
        scopes: environment.scopes,
        loginHint: this.email, // prefill the typed email
        redirectUri: environment.redirectUri || `${window.location.origin}/login`
      });
      return;
    }

    // Already logged in -> acquire token
    const result = await this.msalInstance.acquireTokenSilent({
      scopes: environment.scopes,
      account: accounts[0]
    });

    const token = result.accessToken;

    // Call GetMe API to get email info
    const me = await firstValueFrom(
  this.http.get<MeResponse>(`${environment.apiUrl}${environment.getMeEndpoint}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
);

    // Compare typed email with Azure AD email
    if (me.email.toLowerCase() !== this.email.toLowerCase()) {
      alert('This email is not associated with your Microsoft account.');
      this.loading = false;
      return;
    }

    // Save token & user data
    localStorage.setItem('access_token', token);
    localStorage.setItem('user_data', JSON.stringify(me));

    await this.router.navigate(['/workitems'], { replaceUrl: true });
  } catch (err) {
    console.error('Login failed:', err);
    alert('Login failed. Please try again.');
  } finally {
    this.loading = false;
  }
}

  private async continueLoginFlow(account: any) {
    const result: AuthenticationResult = await this.msalInstance.acquireTokenSilent({
      scopes: environment.scopes,
      account
    });

    const token = result.accessToken;
    localStorage.setItem('access_token', token);

    const me = await firstValueFrom(
      this.http.get<MeResponse>(`${environment.apiUrl}${environment.getMeEndpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    );

    localStorage.setItem('user_data', JSON.stringify(me));
    await this.router.navigate(['/workitems'], { replaceUrl: true });
  }
}
