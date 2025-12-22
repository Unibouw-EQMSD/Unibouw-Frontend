import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, switchMap, from, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MsalService } from '@azure/msal-angular';
import { AppConfigService } from './app.config.service';

export interface projectdetails {
  projectID: string;
  number: string;
  name: string;
  customerName: string;
  customerID?: string;
  projectManagerName: string;
  startDate?: string;
  completionDate?: string;
  status: string;
  active?: boolean;
  editItem?: boolean;
}

export interface RFQConversationMessage {
  ConversationMessageID?: string;
  ProjectID: string;
  RfqID: string;
  WorkItemID: string;
  SubcontractorID: string;
  ProjectManagerID?: string;
  SenderType: 'PM' | 'Subcontractor';
  MessageText: string;
  Subject?: string;
  MessageDateTime?: Date;
  Status?: string;
  CreatedBy: string;
  CreatedOn?: Date;
}

// log-conversation.model.ts
export interface LogConversation {
  // LogConversationID: string | null;
  ProjectID: string;
  RfqID: string;
  SubcontractorID: string;
  ProjectManagerID: string;
  ConversationType: string;
  Subject: string;
  Message: string;
  MessageDateTime: Date;
  CreatedBy: string;
  CreatedOn: Date;
}

export type SenderType = 'PM' | 'Subcontractor';

export interface ConversationMessageDto {
  messageID: string;
  senderType: SenderType;
  messageText: string;
  messageDateTime: string;
  subject?: string;
}

@Injectable({ providedIn: 'root' })
export class projectService {
  apiURL: string = '';
  getprojectsurl: string = '';

  constructor(
    private http: HttpClient,
    private msalService: MsalService,
    private appConfigService: AppConfigService
  ) {
    this.apiURL = this.appConfigService.getConfig().apiURL;
    this.getprojectsurl = this.apiURL + '/Projects';
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

  getProjectById(id: string): Observable<projectdetails> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<{ data: projectdetails }>(`${this.getprojectsurl}/${id}`, { headers })
      ),
      map((res) => res.data) // ✅ extract data before returning
    );
  }

  getProjects(): Observable<projectdetails[]> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<{ count: number; data: projectdetails[] }>(
          this.getprojectsurl, // ✅ only use getprojectsurl
          { headers }
        )
      ),
      map((res) =>
        (res.data || []).map((it) => ({
          projectID: it.projectID,
          number: it.number || '',
          name: it.name || '',
          customerName: it.customerName || '',
          customerID: it.customerID || '',
          projectManagerName: it.projectManagerName || '',
          startDate: it.startDate || '',
          completionDate: it.completionDate || '',
          status: it.status,
          editItem: false,
        }))
      )
    );
  }

  getConversationByProjectAndSubcontractor(
    projectId: string,
    subcontractorId: string
  ): Observable<projectdetails[]> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<{ count: number; data: projectdetails[] }>(
          `${this.apiURL}/RFQConversationMessage/GetConvoByProjectAndSubcontractor`,
          {
            headers,
            params: {
              projectId,
              subcontractorId,
            },
          }
        )
      ),
      map((res) => res.data) //extract messages list
    );
  }

  createLogConversation(payload: LogConversation): Observable<LogConversation> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.post<{ message: string; data: LogConversation }>(
          `${this.apiURL}/RFQConversationMessage/AddLogConversation`,
          payload, // 👈 direct payload
          { headers }
        )
      ),
      map((res) => res.data)
    );
  }

  getConversation(projectId: string, rfqId: string, subId: string) {
    return this.http.get<ConversationMessageDto[]>(
      `${this.apiURL}/RFQConversationMessage/conversation`,
      { params: { projectId, rfqId, subcontractorId: subId } }
    );
  }

  addRfqConversationMessage(message: RFQConversationMessage): Observable<RFQConversationMessage> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.post<{ message: string; data: RFQConversationMessage }>(
          `${this.apiURL}/RFQConversationMessage/AddRFQConversationMessage`,
          message,
          { headers }
        )
      ),
      map((res) => res.data) // return the created message
    );
  }
}
