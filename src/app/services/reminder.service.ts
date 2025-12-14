import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AppConfigService } from './app.config.service';
import { MsalService } from '@azure/msal-angular';

@Injectable({
  providedIn: 'root'
})
export class ReminderService {

  private apiURL: string = '';

  constructor(
    private http: HttpClient,
    private msalService: MsalService,
    private appConfigService: AppConfigService
  ) {
    this.apiURL = this.appConfigService.getConfig().apiURL;
  }

  /**
   * ✅ Generate Auth Headers
   */
  private async getHeaders(): Promise<HttpHeaders> {
    const accounts = this.msalService.instance.getAllAccounts();
    if (!accounts.length) throw new Error('No MSAL account found');

    const result = await this.msalService.instance.acquireTokenSilent({
      account: accounts[0],
      scopes: ['api://96b6d570-73e9-4669-98d6-745f22f4acc0/Api.Read'],
    });

    return new HttpHeaders({
      Accept: '*/*',
      Authorization: `Bearer ${result.accessToken}`,
    });
  }

  /**
   * ✅ Update Global RFQ Reminder Configuration
   * (Your old code used GET incorrectly — API should be POST)
   */
  updateGolbalReminderConfigSet(body: any): Observable<any> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.post<any>(
          `${this.apiURL}/Common/UpdateRfqGolbalReminderSet`,
          body,
          { headers }
        )
      )
    );
  }

getGlobalReminderConfig(): Observable<any> {
  return from(this.getHeaders()).pipe(
    switchMap((headers) =>
      this.http.get<any>(
        `${this.apiURL}/Common/GetRfqGolbalReminderSet`,
        { headers }
      )
    )
  );
}

}



