import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { from, Observable, switchMap, map } from 'rxjs';
import { MsalService } from '@azure/msal-angular';
import { AppConfigService } from './app.config.service';

export interface Rfq {
  id?: string;
  rfqNumber?: string; // ✅ Add this
  projectName?: string; // optional
  customerID: string;
  projectID: string;
  customerName?: string;
  sentDate: string;
  dueDate: string;
  globalDueDate?: string;
  rfqSent: number;
  quoteReceived: number;
  customerNote?: string;
  deadLine?: string;
  createdOn?: string; // ✅ Add this
  createdBy?: string;
}

export interface RfqSubcontractorDueDate {
  subcontractorID: string;
  dueDate: string; // yyyy-MM-dd
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
      switchMap((headers) =>
        this.http.get<{ count: number; data: Rfq[] }>(`${this.rfqEndpoint}/byProject`, { headers })
      ),
      map((res) =>
        (res.data || []).map((it) => ({
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
        }))
      )
    );
  }
  getRfqById(rfqId: string): Observable<Rfq> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<{ data: any }>(`${this.rfqEndpoint}/${rfqId}`, { headers })
      ),
      map((res) => {
        const d = res.data;
        return {
          id: d.rfqID,
          rfqNumber: d.rfqNumber, // ✅ Add this
          sentDate: d.sentDate,
          dueDate: d.dueDate,
          globalDueDate: d.globalDueDate,
          customerID: d.customerID,
          projectID: d.projectID,
          customerName: d.customerName,
          projectName: d.projectName, // ✅ Add if needed
          rfqSent: d.rfqSent,
          quoteReceived: d.quoteReceived,
          customerNote: d.customerNote,
          deadLine: d.deadLine,
          createdOn: d.createdOn, // ✅ Add this
          createdBy: d.createdBy,
        };
      })
    );
  }

  /** Fetch RFQs by project ID */
  getRfqByProjectId(projectId: string): Observable<Rfq[]> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<{ data: Rfq[] }>(`${this.rfqEndpoint}/byProject/${projectId}`, { headers })
      ),
      map((res) => res.data || [])
    );
  }

  getWorkItemInfo(rfqId: string): Observable<any> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<any>(`${this.apiURL}/Rfq/${rfqId}/workitem-info`, { headers })
      )
    );
  }

  getSubcontractorsByWorkItem(workItemId: string) {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<any[]>(`${this.apiURL}/Common/subcontractorworkitemmapping/${workItemId}`, {
          headers,
        })
      )
    );
  }

  /** Create a new RFQ */
  createRfq(
    rfqPayload: any,
    subcontractorIds: string[],
    workItemIds: string[],
    sendEmail: boolean = true
  ): Observable<any> {
    const params = new HttpParams({
      fromObject: {
        subcontractorIds: subcontractorIds,
        workItems: workItemIds,
        sendEmail: sendEmail.toString(), // send flag to backend
      },
    });

    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.post(`${this.apiURL}/Rfq/create-simple`, rfqPayload, { headers, params })
      )
    );
  }

  createRfqSimple(
    rfq: any,
    subcontractorIds: string[],
    workItems: string[],
    emailBody: string,
    sendEmail: boolean = false,
    subcontractorDueDates: RfqSubcontractorDueDate[]
  ): Observable<any> {
    let params = new HttpParams();
    subcontractorIds.forEach((id) => (params = params.append('subcontractorIds', id)));
    workItems.forEach((id) => (params = params.append('workItems', id)));
    params = params.set('emailBody', emailBody);
    params = params.set('sendEmail', sendEmail.toString());

    // Merge rfq and due dates into one object for the POST body
    const body = {
      ...rfq,
      subcontractorDueDates,
    };

    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.post(`${this.apiURL}/Rfq/create-simple`, body, { headers, params })
      )
    );
  }

  updateRfq(
    rfqID: string,
    rfqPayload: any,
    subcontractorIds: string[],
    workItemIds: string[],
    sendEmail: boolean = false
  ): Observable<any> {
    // 🛑 Hard validation (fail fast)
    if (!rfqID) throw new Error('rfqID is required');
    if (!rfqPayload) throw new Error('rfqPayload is required');
    if (!subcontractorIds?.length) throw new Error('At least one subcontractorId is required');
    if (!workItemIds?.length) throw new Error('At least one workItemId is required');

    // ✅ Build params correctly (repeat keys, NO commas)
    let params = new HttpParams().set('rfqId', rfqID).set('sendEmail', String(sendEmail));

    subcontractorIds.forEach((id) => {
      params = params.append('subcontractorIds', id);
    });

    workItemIds.forEach((id) => {
      params = params.append('workItems', id);
    });

    // 🧪 Debug helper (REMOVE later)
    console.log('UPDATE RFQ URL:', `${this.apiURL}/Rfq/update?${params.toString()}`);
    console.log('UPDATE RFQ BODY:', rfqPayload);

    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.post(`${this.apiURL}/Rfq/update`, rfqPayload, { headers, params })
      )
    );
  }

  getRfqSubcontractorDueDates(rfqId: string): Observable<any[]> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        // ⭐ This assumes the backend endpoint is implemented as /api/Rfq/{rfqId}/subcontractor-duedates
        this.http.get<any[]>(`${this.rfqEndpoint}/${rfqId}/subcontractor-duedates`, { headers })
      )
    );
  }

  saveSubcontractorWorkItemMapping(
    workItemId: string,
    subcontractorId: string,
    dueDate: string,
    rfqId: string // NEW PARAM
  ): Observable<any> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.post(
          `${this.apiURL}/Rfq/save-subcontractor-workitem-mapping?workItemId=${workItemId}&subcontractorId=${subcontractorId}&rfqId=${rfqId}&dueDate=${dueDate}`,
          {}, // empty body
          { headers }
        )
      )
    );
  }

  saveOrUpdateRfqSubcontractorMapping(
    rfqId: string,
    subcontractorId: string,
    workItemId: string,
    dueDate: string
  ): Observable<any> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.post(
          `${this.apiURL}/Rfq/save-or-update-rfq-subcontractor-mapping?rfqId=${rfqId}&subcontractorId=${subcontractorId}&workItemId=${workItemId}&dueDate=${dueDate}`,
          {}, // empty body
          { headers }
        )
      )
    );
  }

  deleteRfq(rfqId: string) {
    return from(this.getHeaders()).pipe(
      switchMap((headers) => this.http.post(`${this.apiURL}/Rfq/delete/${rfqId}`, {}, { headers }))
    );
  }

  replyToConversation(payload: any): Observable<any> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.post<{ data: any }>(`${this.apiURL}/RFQConversationMessage/reply`, payload, {
          headers,
        })
      ),
      map((res) => res.data)
    );
  }
}
