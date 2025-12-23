import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AppConfigService } from './app.config.service';
import { MsalService } from '@azure/msal-angular';

@Injectable({
  providedIn: 'root',
})
export class RfqResponseService {
  private apiURL: string = '';

  constructor(
    private http: HttpClient,
    private msalService: MsalService,
    private appConfigService: AppConfigService
  ) {
    this.apiURL = this.appConfigService.getConfig().apiURL;
  }
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
  /* Fetch Project Summary */
  getProjectSummary(rfqId: string, subId: string, workItemIds?: string[]) {
    let url = `${this.apiURL}/RfqResponse/GetProjectSummary?rfqId=${rfqId}&subId=${subId}`;

    if (workItemIds && workItemIds.length) {
      // append multiple workItemIds
      workItemIds.forEach((id) => {
        url += `&workItemIds=${id}`;
      });
    }

    return this.http.get(url);
  }

  getResponsesByProjectId(projectId: string) {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<any>(`${this.apiURL}/RfqResponse/responses/project/${projectId}`, { headers })
      )
    );
  }

  deleteQuoteFile(rfqId: string, subId: string, workItemId: string) {
    return this.http.delete(
      `${this.apiURL}/RfqResponse/DeleteQuoteFile?rfqId=${rfqId}&subcontractorId=${subId}&workItemId=${workItemId}`
    );
  }

  submitRfqResponseWithFile(
    rfqId: string,
    subcontractorId: string,
    workItemId: string,
    status: string,
    file?: File
  ): Observable<any> {
    const formData = new FormData();
    formData.append('rfqId', rfqId);
    formData.append('subcontractorId', subcontractorId);
    formData.append('workItemId', workItemId);
    formData.append('status', status);

    if (file) {
      // If backend expects actual File object
      formData.append('file', file, file.name);
    }

    // If no file or file appended directly
    return this.http.post(`${this.apiURL}/RfqResponse/submit`, formData);
  }

  submitRfqResponse(
    rfqId: string,
    subcontractorId: string,
    workItemId: string,
    status: string,
    reason?: any,
    p0?: any
  ): Observable<any> {
    const formData = new FormData();
    formData.append('rfqId', rfqId);
    formData.append('subcontractorId', subcontractorId);
    formData.append('workItemId', workItemId);
    formData.append('status', status);

    // ✅ Only for Not Interested
    if (reason) {
      formData.append('reason', JSON.stringify(reason));
    }

    return this.http.post(`${this.apiURL}/RfqResponse/submit`, formData);
  }

  // ✅ Upload file (if you add this later)
  uploadQuoteFile(
  rfqId: string,
  subId: string,
  workItemId: string,   // ✅ ADD THIS
  file: File,
  totalAmount: number,
  comment: string
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('totalAmount', totalAmount.toString());
  formData.append('comment', comment);
  formData.append('workItemId', workItemId); // ✅ REQUIRED

  return this.http.post(
    `${this.apiURL}/RfqResponse/UploadQuote?rfqId=${rfqId}&subcontractorId=${subId}&workItemId=${workItemId}`,
    formData
  );
}

  getPreviousSubmissions(rfqId: string, subId: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiURL}/RfqResponse/PreviousSubmissions?rfqId=${rfqId}&subcontractorId=${subId}`
    );
  }

  getResponsesByProjectSubcontractors(projectId: string): Observable<any> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<any>(
          `${this.apiURL}/RfqResponse/responses/project/${projectId}/subcontractors`,
          { headers }
        )
      )
    );
  }
getQuoteAmount(rfqId: string, subId: string, workItemId: string): Observable<any> {
  return from(this.getHeaders()).pipe(
    switchMap((headers) =>
      this.http.get<any>(
        `${this.apiURL}/RfqResponse/GetQuoteAmount?rfqId=${rfqId}&subcontractorId=${subId}&workItemId=${workItemId}`,
        { headers }
      )
    )
  );
}
  markAsViewed(rfqId: string, subcontractorId: string, workItemId: string): Observable<any> {
    return this.http.post(
      `${this.apiURL}/RfqResponse/mark-viewed`,
      null, // no body
      {
        params: {
          rfqId: rfqId,
          subcontractorId: subcontractorId,
          workItemId: workItemId,
        },
      }
    );
  }

  downloadQuote(documentId: string): Observable<Blob> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get(`${this.apiURL}/RfqResponse/DownloadQuote`, {
          params: { documentId },
          headers,
          responseType: 'blob',
        })
      )
    );
  }

  sendReminder(subId: string | null, rfqId: string | null, emailBody: string): Observable<any> {
    const body = {
      SubcontractorId: subId ?? null,
      RfqID: rfqId ?? null,
      EmailBody: emailBody,
    };

    return this.http.post<any>(`${this.apiURL}/Email/send-reminder`, body);
  }
}
