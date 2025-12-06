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



  
//   ------------------ Reminder State Management ------------------

  // Default values
//   private defaultReminderSequence = [-2, -3, -5, -7, -9];
//   private defaultReminderTime = '08:00';
//   private defaultReminderEmailBody = `Dear Subcontractor,
// This is a reminder to upload your quote before the due date. Please ensure all required documents are submitted on time.
// Thank you.`;

//   // BehaviorSubjects with default values
//   private reminderSequenceSource = new BehaviorSubject<any[]>(this.defaultReminderSequence);
//   private reminderTimeSource = new BehaviorSubject<string | null>(this.defaultReminderTime);
//   private reminderEmailBodySource = new BehaviorSubject<string | null>(this.defaultReminderEmailBody);

//   reminderSequence$ = this.reminderSequenceSource.asObservable();
//   reminderTime$ = this.reminderTimeSource.asObservable();
//   reminderEmailBody$ = this.reminderEmailBodySource.asObservable();

//   // Methods to update the values
//   setReminderSequence(value: any[]) {
//     this.reminderSequenceSource.next(value);
//   }

//   setReminderTime(value: string) {
//     this.reminderTimeSource.next(value);
//   }

//   setReminderEmailBody(value: string) {
//     this.reminderEmailBodySource.next(value);
//   }

}



