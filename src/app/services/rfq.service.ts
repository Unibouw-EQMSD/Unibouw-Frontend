import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { from, Observable, switchMap, map } from 'rxjs';
import { MsalService } from '@azure/msal-angular';
import { AppConfigService } from './app.config.service';

export interface Rfq {
  id?: string;
  customerID: string;        // required by backend
  projectID: string;         // required by backend
  customerName?: string;
  sentDate: string;
  dueDate: string;
  rfqSent: number;
  quoteReceived: number;
  customerNote?: string;
  deadLine?: string;         // optional, can set same as dueDate
  createdBy?: string;
  actions?: string[];
  isEditingDueDate?: boolean; // for inline editing
}

@Injectable({ providedIn: 'root' })
export class RfqService {
  private apiURL: string = '';
  private rfqEndpoint: string = '';

  constructor(
    private http: HttpClient,
    private msalService: MsalService,
    private appConfigService: AppConfigService
  ) {
    this.apiURL = this.appConfigService.getConfig().apiURL;
    this.rfqEndpoint = `${this.apiURL}/Rfq`;
  }

  /** Generate headers with Azure AD token */
  private async getHeaders(): Promise<HttpHeaders> {
    const accounts = this.msalService.instance.getAllAccounts();
    if (!accounts.length) throw new Error('No MSAL account found');

    const result = await this.msalService.instance.acquireTokenSilent({
      account: accounts[0],
      scopes: ['api://96b6d570-73e9-4669-98d6-745f22f4acc0/Api.Read'],
    });

    return new HttpHeaders({
      Accept: 'application/json',
      Authorization: `Bearer ${result.accessToken}`,
    });
  }

  /** Fetch all RFQs */
  getAllRfq(): Observable<Rfq[]> {
    return from(this.getHeaders()).pipe(
      switchMap(headers =>
        this.http.get<{ count: number; data: Rfq[] }>(`${this.rfqEndpoint}/byProject`, { headers })
      ),
      map(res => (res.data || []).map(it => ({
        id: it.id,
        sentDate: it.sentDate,
        dueDate: it.dueDate,
        rfqSent: it.rfqSent,
        quoteReceived: it.quoteReceived,
        customerID: it.customerID,
        projectID: it.projectID,
        customerNote: it.customerNote,
        deadLine: it.deadLine,
        customerName: it.customerName,
      })))
    );
  }

  /** Fetch RFQs by project ID */
  getRfqByProjectId(projectId: string): Observable<Rfq[]> {
    return from(this.getHeaders()).pipe(
      switchMap(headers =>
        this.http.get<{ data: Rfq[] }>(`${this.rfqEndpoint}/byProject/${projectId}`, { headers })
      ),
      map(res => res.data || [])
    );
  }

getWorkItemInfo(rfqId: string): Observable<any> {
  return from(this.getHeaders()).pipe(
    switchMap((headers) =>
      this.http.get<any>(
        `${this.apiURL}/Rfq/${rfqId}/workitem-info`,
        { headers }
      )
    )
  );
}

  /** Create a new RFQ */
 createRfq(rfqPayload: any, subcontractorIds: string[], workItemIds: string[]): Observable<any> {
  const params = new HttpParams({
    fromObject: {
      subcontractorIds: subcontractorIds,
      workItems: workItemIds
    }
  });

  return from(this.getHeaders()).pipe(
    switchMap(headers =>
      this.http.post(`${this.apiURL}/Rfq/create-simple`, rfqPayload, { headers, params })
    )
  );
}
}
