import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { from, Observable, switchMap, map } from 'rxjs';
import { MsalService } from '@azure/msal-angular';
import { AppConfigService } from './app.config.service';

export interface Rfq {
  id?: string;
  rfqNumber?: string;   // ✅ Add this
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
  createdOn?: string;    // ✅ Add this
  createdBy?: string;
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
getRfqById(rfqId: string): Observable<Rfq> {
  return from(this.getHeaders()).pipe(
    switchMap(headers =>
      this.http.get<{ data: any }>(`${this.rfqEndpoint}/${rfqId}`, { headers })
    ),
    map(res => {  
      const d = res.data;
      return {
        id: d.rfqID,
        rfqNumber: d.rfqNumber,          // ✅ Add this
        sentDate: d.sentDate,
        dueDate: d.dueDate,
        globalDueDate: d.globalDueDate,
        customerID: d.customerID,
        projectID: d.projectID,
        customerName: d.customerName,
        projectName: d.projectName,      // ✅ Add if needed
        rfqSent: d.rfqSent,
        quoteReceived: d.quoteReceived,
        customerNote: d.customerNote,
        deadLine: d.deadLine,
        createdOn: d.createdOn,          // ✅ Add this
        createdBy: d.createdBy,
      };
    })
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

getSubcontractorsByWorkItem(workItemId: string) {
  return from(this.getHeaders()).pipe(
    switchMap(headers =>
      this.http.get<any[]>(`${this.apiURL}/Common/subcontractorworkitemmapping/${workItemId}`, { headers })
    )
  );
}

  /** Create a new RFQ */
createRfq(rfqPayload: any, subcontractorIds: string[], workItemIds: string[], sendEmail: boolean = true): Observable<any> {
  const params = new HttpParams({
    fromObject: {
      subcontractorIds: subcontractorIds,
      workItems: workItemIds,
      sendEmail: sendEmail.toString() // send flag to backend
    }
  });

  return from(this.getHeaders()).pipe(
    switchMap(headers =>
      this.http.post(`${this.apiURL}/Rfq/create-simple`, rfqPayload, { headers, params })
    )
  );
}

createRfqSimple(
  rfq: any,
  subcontractorIds: string[],
  workItems: string[],
  emailBody: string,
  sendEmail: boolean = false
): Observable<any> {
  let params = new HttpParams();
  subcontractorIds.forEach(id => params = params.append('subcontractorIds', id));
  workItems.forEach(id => params = params.append('workItems', id));
  params = params.set('emailBody', emailBody);
  params = params.set('sendEmail', sendEmail.toString()); // convert boolean to string

 return from(this.getHeaders()).pipe(
  switchMap(headers =>
    this.http.post(`${this.apiURL}/Rfq/create-simple`, rfq, { headers, params })
  )
);
}



updateRfq(
  rfqID: string,
  rfqPayload: any,
  subcontractorIds: string[],
  workItemIds: string[],
  sendEmail: boolean = true,
  emailBody: string = ''     // ✅ NEW PARAM
): Observable<any> 
{
  const params = new HttpParams({
    fromObject: {
      subcontractorIds: subcontractorIds.join(','), // ensure comma separated
      workItems: workItemIds.join(','),
      sendEmail: sendEmail.toString(),
      emailBody: emailBody                          // ✅ SEND EDITED EMAIL BODY
    }
  });

  return from(this.getHeaders()).pipe(
    switchMap(headers =>
      this.http.put(
        `${this.apiURL}/Rfq/${rfqID}`,
        rfqPayload,
        { headers, params }
      )
    )
  );
}


    getRfqSubcontractorDueDates(rfqId: string): Observable<any[]> {
         return from(this.getHeaders()).pipe(
            switchMap(headers =>
                // ⭐ This assumes the backend endpoint is implemented as /api/Rfq/{rfqId}/subcontractor-duedates
                this.http.get<any[]>(`${this.rfqEndpoint}/${rfqId}/subcontractor-duedates`, { headers })
            )
        );
    }

deleteRfq(rfqId: string) {
  return from(this.getHeaders()).pipe(
    switchMap(headers =>
      this.http.post(`${this.apiURL}/Rfq/delete/${rfqId}`, {}, { headers })
    )
  );
}
    
}
