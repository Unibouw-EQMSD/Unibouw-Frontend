import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, switchMap, from, Observable, of, forkJoin } from 'rxjs';
import { environment } from '../../environments/environment';
import { MsalService } from '@azure/msal-angular';
import { AppConfigService } from './app.config.service';
import { RFQConversationMessageAttachment } from '../component/projects/view-projects/view-projects';

export interface projectdetails {
  projectID: string;
  company?: string;
  number: string;
  name: string;
  customerID?: string;
  customerName: string;
  startDate?: string;
  completionDate?: string;
  status: string;
  active?: boolean;
  editItem?: boolean;
  personName?: string;
  personRole?: string;
}

export interface RFQConversationMessage {
  conversationMessageID?: string;
  subcontractorMessageID?: string;
  projectID: string;
  subcontractorID: string;
  senderType: 'PM' | 'Subcontractor';
  messageText: string;
  subject?: string;
  messageDateTime?: Date;
  status?: string;
  createdBy: string;
  createdOn?: Date;
  tags?: string[];
}

// log-conversation.model.ts
export interface LogConversation {
  projectID: string;
  subcontractorID: string;
  conversationType: string;
  subject: string;
  message: string;
  messageDateTime?: Date | null;
}

export interface SendMailRequest {
  subcontractorID: string;
  projectID: string;
  subject: string;
  body: string; // message body (HTML or text)
  attachmentFilePaths?: string[]; // optional
}

interface UploadAttachmentResponse {
  filePath: string;
}

export type SenderType = 'PM' | 'Subcontractor';

export interface ConversationMessageDto {
  Attachments: RFQConversationMessageAttachment[] | undefined;
  attachments?: RFQConversationMessageAttachment[]; // <-- FIXED
  messageID: string;
  senderType: SenderType;
  messageText: string;
  messageDateTime: string;
  subject?: string;

  conversationMessageID?: string;
  projectManagerID?: string | null;
  subcontractorMessageID?: string;
  parentID: any;
  rfqID?: string | null;

  conversationType?: string;
}

@Injectable({ providedIn: 'root' })
export class projectService {
  apiURL: string = '';
  getprojectsurl: string = '';

  constructor(
    private http: HttpClient,
    private msalService: MsalService,
    private appConfigService: AppConfigService,
  ) {
    this.apiURL = this.appConfigService.getConfig().apiURL;
    this.getprojectsurl = this.apiURL + '/Projects';
  }

  private async getHeaders(): Promise<HttpHeaders> {
    const accounts = this.msalService.instance.getAllAccounts();

    // 🔐 If not logged in yet, send request without auth
    if (!accounts.length) {
      return new HttpHeaders({
        Accept: '*/*',
      });
    }

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
        this.http.get<{ data: projectdetails }>(`${this.getprojectsurl}/${id}`, { headers }),
      ),
      map((res) => res.data), // ✅ extract data before returning
    );
  }

  getProjects(): Observable<projectdetails[]> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<{ count: number; data: projectdetails[] }>(
          this.getprojectsurl, // ✅ only use getprojectsurl
          { headers },
        ),
      ),
      map((res) =>
        (res.data || []).map((it) => ({
          projectID: it.projectID,
          company: it.company || '',
          number: it.number || '',
          name: it.name || '',
          customerName: it.customerName || '',
          customerID: it.customerID || '',
          startDate: it.startDate || '',
          completionDate: it.completionDate || '',
          status: it.status || '',
          active: it.active ?? true,
          editItem: false,
          personName: it.personName || '',
          personRole: it.personRole || '',
        })),
      ),
    );
  }

  getConversationByProjectAndSubcontractor(
    projectId: string,
    subcontractorId: string,
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
          },
        ),
      ),
      map((res) => res.data), //extract messages list
    );
  }

  createLogConversation(payload: LogConversation): Observable<LogConversation> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.post<{ message: string; data: LogConversation }>(
          `${this.apiURL}/RFQConversationMessage/AddLogConversation`,
          payload, // 👈 direct payload
          { headers },
        ),
      ),
      map((res) => res.data),
    );
  }

  getConversation(projectId: string, rfqId: string, subId: string) {
    return this.http.get<ConversationMessageDto[]>(
      `${this.apiURL}/RFQConversationMessage/conversation`,
      { params: { projectId, rfqId, subcontractorId: subId } },
    );
  }

  addRfqConversationMessage(message: RFQConversationMessage): Observable<RFQConversationMessage> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.post<{ message: string; data: RFQConversationMessage }>(
          `${this.apiURL}/RFQConversationMessage/AddRFQConversationMessage`,
          message,
          { headers },
        ),
      ),
      map((res) => res.data), // return the created message
    );
  }

  sendMail(payload: SendMailRequest): Observable<boolean> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.post<{ success: boolean }>(`${this.apiURL}/Email/send-mail`, payload, {
          headers,
        }),
      ),
      map((res) => res.success),
    );
  }

  uploadAttachmentFiles(conversationMessageId: string, files: File[]): Observable<string[]> {
    if (!files || files.length === 0) {
      return of([]);
    }

    return from(this.getHeaders()).pipe(
      switchMap((headers) => {
        const uploadRequests = files.map((file) => {
          const formData = new FormData();
          formData.append('file', file); // ✅ backend expects "file"

          return this.http
            .post<UploadAttachmentResponse>(
              `${this.apiURL}/RFQConversationMessage/AddAttachmentAsync/${conversationMessageId}`,
              formData,
              { headers },
            )
            .pipe(
              map((res) => res.filePath), // ✅ return uploaded file path
            );
        });

        // ✅ wait for all uploads & return string[]
        return forkJoin(uploadRequests);
      }),
    );
  }
}
