import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { projectService, projectdetails } from '../../services/project.service';
import { WorkitemService, Workitem } from '../../services/workitem.service';
import { CommonModule } from '@angular/common';
import { RfqResponseService } from '../../services/rfq-response.service';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeNl from '@angular/common/locales/nl';
import { FormsModule } from '@angular/forms';
import { Directive, HostListener, Renderer2 } from '@angular/core';
import { finalize, switchMap, tap } from 'rxjs';
import { MatTooltipModule } from '@angular/material/tooltip';

interface NotInterestedData {
  reason: string;
  comment?: string;
  submitted: boolean;
}

interface LogConversation {
  projectID: string;
  rfqID?: string | null;
  subcontractorID: string;
  projectManagerID: string;
  conversationType: string;
  subject: string;
  message: string;
  messageDateTime: Date;
}

@Component({
  selector: 'app-project-summary',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatTooltipModule],
  templateUrl: './project-summary.html',
  styleUrls: ['./project-summary.css'],
})
export class ProjectSummary implements OnInit {
  project: any = null;
  subcontractor: any = null;
  workItems: any[] = [];
  isLoading = true;
  errorMsg = '';
  selectedWorkItem: any = null;
  rfqId!: string;
  subId!: string;
  number!: string;
  isInterested = false;
  buttonsDisabled = false;
  expandedId: string | number | null = null;
  maxFileSize = 10 * 1024 * 1024; // 10 MB
  fileSizeError = '';
  today = '';
  dueDate = '';
  maybeLaterError = '';
  isRfqExpired = false;
  notInterestedReasons = [
    'Onvoldoende capaciteit / planning zit vol',
    'Geen interesse in het project / past niet binnen strategie',
    'Project is te groot',
    'Project is te klein',
    'Technisch niet passend bij onze expertise',
    'Tijdslijnen zijn te krap',
    'Locatie te ver / logistiek niet rendabel',
    'Te veel concurrentie / lage kans op gunning',
    'Problemen met beschikbaarheid materialen',
    'Negatieve ervaring uit eerdere samenwerking',
    'Andere lopende offertes/projecten hebben voorrang',
    'Anders',
  ];
  rfq: any;
  attachments!: FormArray<FormControl<File | null>>;
  selectedFiles: (File | null)[] = [];
  showQuotePanel = false;
  hideRightSummaryCard = false;
  rightSectionVisible = true;

  isQuoteSubmitted = false;
  quoteForm!: FormGroup;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // Previous submissions
  previousSubmissions: {
    subcontractorName: string;
    date: string | Date;
    amount: number;
    attachmentUrl: string;
    comment?: string;
  }[] = [];
  selectedComment: string = '';
  showCommentModal: boolean = false;
  formSubmitted: boolean = false;
  openDropdown: { id: string | number | null; type: '' | 'maybe' | 'not' } = { id: null, type: '' };
  r: any;
  el: any;

  constructor(
    private route: ActivatedRoute,
    private rfqResponseService: RfqResponseService,
    private projectService: projectService,
    private fb: FormBuilder,
    private http: HttpClient
  ) {
    registerLocaleData(localeNl);

    this.attachments = this.fb.array<FormControl<File | null>>([
      this.fb.control<File | null>(null),
    ]);
  }

  @HostListener('mousemove', ['$event'])
  onMove(e: MouseEvent) {
    // store cursor position as CSS variables on the hovered element
    this.r.setStyle(this.el.nativeElement, '--tt-x', `${e.clientX}px`);
    this.r.setStyle(this.el.nativeElement, '--tt-y', `${e.clientY}px`);
  }
  ngOnInit(): void {
    this.quoteForm = this.fb.group({
      quoteAmount: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[0-9.,]+$/), // only numbers, dot, comma
        ],
      ],
      comments: ['', Validators.required],
    });

    this.route.queryParams.subscribe((params) => {
      this.rfqId = params['rfqId'];
      this.subId = params['subId'];
      this.number = params['number']; // RFQ number, not WorkItemID

      if (this.rfqId && this.subId) {
        // Restore previous state
        const stateKey = `rfq_state_${this.rfqId}_${this.subId}_${this.number}`;
        const savedState = localStorage.getItem(stateKey);
        if (savedState) {
          const state = JSON.parse(savedState);
          this.buttonsDisabled = state.buttonsDisabled ?? false;
          this.isInterested = state.isInterested ?? false;
          this.isQuoteSubmitted = state.isQuoteSubmitted ?? false;
          if (state.selectedFileNames?.length > 0) {
            this.selectedFiles = state.selectedFileNames.map((name: string) => ({ name } as File));
          }
        }

        // Load project first
        this.loadProjectSummary(this.rfqId);
        this.loadPreviousSubmissions();
      } else {
        this.isLoading = false;
        this.errorMsg = 'Missing required parameters (rfqId or subId).';
      }
    });
  }

  openQuotePanel() {
    this.showQuotePanel = true;
    this.rightSectionVisible = true; // show right section when opening
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  loadProjectSummary(rfqId: string) {
    this.isLoading = true;

    const workItemIdsParam = this.route.snapshot.queryParamMap.get('workItemIds');
    const workItemIds = workItemIdsParam ? workItemIdsParam.split(',') : [];

    this.rfqResponseService.getProjectSummary(rfqId, this.subId, workItemIds).subscribe({
      next: (res: any) => {
        this.isLoading = false;

        if (!res?.project) {
          this.errorMsg = 'No project data found.';
          return;
        }

        this.project = res.project;
        this.rfq = res.rfq;
        this.workItems = res.workItems || [];

        /* ================= DATE HANDLING ================= */

        const now = new Date();
        this.today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
          now.getDate()
        ).padStart(2, '0')}`;

        const rawDueDate = this.rfq?.globalDueDate || this.rfq?.dueDate || this.rfq?.DueDate;

        if (rawDueDate) {
          const dateOnly = rawDueDate.split('T')[0];
          this.dueDate = dateOnly;
          this.isRfqExpired = new Date() > new Date(`${dateOnly}T23:59:59`);
        }

        /* ================= RESTORE STATE ================= */

        this.workItems.forEach((w: any) => {
          const stateKey = `rfq_state_${this.rfqId}_${this.subId}_${w.workItemID}`;
          const savedState = localStorage.getItem(stateKey);

          if (savedState) {
            const state = JSON.parse(savedState);

            // ✅ RESTORE EXACT FLAGS (NO INFERENCE)
            w.isQuoteSubmitted = !!state.isQuoteSubmitted;
            w.isInterested = !!state.isInterested;
            w.status = state.status || w.status;
            w.viewed = !!state.viewed;
            // w.buttonsDisabled = !!state.buttonsDisabled;

            if (state.notInterested) {
              w.notInterested = {
                reason: state.notInterested.reason || '',
                comment: state.notInterested.comment || '',
                submitted: false,
              };
            }

            // ✅ Restore chevron only if interested
            if (w.isInterested) {
              this.expandedId = w.workItemID;
            }
          } else {
            // Defaults (important for first load)
            w.isQuoteSubmitted = false;
            w.isInterested = false;
          }

          /* ===== Restore previous submissions ===== */
          const subKey = `rfq_prev_submissions_${this.rfqId}_${this.subId}_${w.workItemID}`;
          w.previousSubmissions = JSON.parse(localStorage.getItem(subKey) || '[]');
          if (w.previousSubmissions.length > 0) {
            w.isQuoteSubmitted = true; // ← THIS IS THE CRITICAL LINE
          }
          /* ===== Mark as viewed (server-side) ===== */
          this.rfqResponseService.markAsViewed(this.rfqId, this.subId, w.workItemID).subscribe();
        });
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMsg = 'Failed to load project summary.';
        console.error(err);
      },
    });
  }

  toggleRow(wi: any) {
    this.expandedId = this.expandedId === wi.workItemID ? null : wi.workItemID;
  }

  toggleInterestDropdown(wi: any, type: 'maybe' | 'not', ev: MouseEvent) {
    ev.stopPropagation();

    // ✅ INIT NOT INTERESTED MODEL
    if (type === 'not' && !wi.notInterested) {
      wi.notInterested = {
        reason: '',
        comment: '',
        submitted: false,
      };
      wi.notInterestedError = '';
    }

    this.openDropdown =
      this.openDropdown.id === wi.workItemID && this.openDropdown.type === type
        ? { id: null, type: '' }
        : { id: wi.workItemID, type };
  }

  isOpen(wi: any, type: 'maybe' | 'not') {
    return this.openDropdown.id === wi.workItemID && this.openDropdown.type === type;
  }

  closeDropdowns() {
    this.openDropdown = { id: null, type: '' };
  }

  // Outside click: close
  @HostListener('document:click')
  onDocClick() {
    this.closeDropdowns();
  }

  confirmMaybeLater(wi: any) {
    this.maybeLaterError = '';

    if (this.isRfqExpired) {
      this.maybeLaterError = 'This RFQ link has expired.';
      return;
    }

    if (!wi.maybeLaterDate) {
      this.maybeLaterError = 'Please select a date.';
      return;
    }

    if (wi.maybeLaterDate < this.today) {
      this.maybeLaterError = 'Date cannot be in the past.';
      return;
    }

    if (wi.maybeLaterDate > this.dueDate) {
      this.maybeLaterError = 'Date must be on or before RFQ due date.';
      return;
    }

    // ✅ Set status BEFORE calling submitInterest
    wi.status = 'Maybe Later';

    this.submitInterest('Maybe Later', wi);

    const workItemName = wi?.name || '';
    const rfqNumber = this.rfq?.rfqNumber || '';
    const maybeLaterDate = wi.maybeLaterDate;

    const message = `
Maybe Later – Confirmation

RFQ Number     : ${rfqNumber}
Work Item Name : ${workItemName}
Follow-up Date : ${maybeLaterDate}
`.trim();

    const payload: LogConversation = {
      projectID: this.project?.projectID,
      rfqID: this.rfqId ?? null,
      subcontractorID: this.subId,
      projectManagerID: this.project?.projectManagerID,
      conversationType: 'Email',
      subject: 'Marked as Maybe Later',
      message,
      messageDateTime: new Date(),
    };

    if (!payload.projectID || !payload.projectManagerID) {
      alert('Project data not loaded yet. Please try again.');
      return;
    }

    this.isLoading = true;

    this.projectService
      .createLogConversation(payload)
      .pipe(
        tap((res) => console.log('Log conversation saved:', res)),
        finalize(() => (this.isLoading = false))
      )
      .subscribe({
        next: () => {
          // ✅ Set status BEFORE calling submitInterest
          wi.status = 'Maybe Later';

          console.log('🔵 Maybe Later confirmed - Status set to:', wi.status);

          this.submitInterest('Maybe Later', wi);
          this.closeDropdowns();
        },
        error: (err) => {
          console.error('Error saving conversation:', err);
          alert('Failed to save conversation. Please try again.');
        },
      });

    // ✅ Close dropdown after submission
    // this.closeDropdowns();
  }

  confirmNotInterested(wi: any): void {
    const reason = wi?.notInterested?.reason?.trim();
    const comment = wi?.notInterested?.comment?.trim();
    const workItemName = wi?.name || '';
    const rfqNumber = this.rfq?.rfqNumber || '';

    // Validations
    if (!reason) {
      alert('Please select a reason.');
      return;
    }

    if (reason === 'Anders' && !comment) {
      alert('Please enter a reason.');
      return;
    }

    const message = `
Not Interested – Confirmation

RFQ Number     : ${rfqNumber}
Work Item Name : ${workItemName}
Reason         : ${reason}
Comment        : ${comment || 'No additional comments provided.'}
`.trim();

    const payload: LogConversation = {
      projectID: this.project?.projectID,
      rfqID: this.rfqId ?? null,
      subcontractorID: this.subId,
      projectManagerID: this.project?.projectManagerID,
      conversationType: 'Email',
      subject: 'Marked as Not Interested',
      message,
      messageDateTime: new Date(),
    };

    if (!payload.projectID || !payload.projectManagerID) {
      alert('Project data not loaded yet. Please try again.');
      return;
    }

    this.isLoading = true;

    this.projectService
      .createLogConversation(payload)
      .pipe(
        tap((res) => console.log('Log conversation saved:', res)),
        finalize(() => (this.isLoading = false))
      )
      .subscribe({
        next: () => {
          //alert('Conversation logged successfully!');

          // ✅ Set status BEFORE calling submitInterest
          wi.status = 'Not Interested';

          console.log('🔴 Not Interested confirmed - Status set to:', wi.status);

          this.submitInterest('Not Interested', wi);
          this.closeDropdowns();
        },
        error: (err) => {
          console.error('Error saving conversation:', err);
          alert('Failed to save conversation. Please try again.');
        },
      });
  }

  addMore() {
    this.attachments.push(this.fb.control(null));
  }

  onFileSelected(event: any) {
    this.fileSizeError = '';

    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // ❌ SIZE CHECK
    if (file.size > this.maxFileSize) {
      this.fileSizeError = 'File size must not exceed 10 MB.';
      event.target.value = ''; // reset input
      return;
    }

    // ✅ VALID FILE
    this.selectedFiles = [file];
  }

  removeFile(inputRef: HTMLInputElement) {
    this.selectedFiles = []; // clear the array
    inputRef.value = ''; // clear the input
  }

  openCommentModal(comment: string | null | undefined) {
    this.selectedComment = comment ?? 'No comments available.';
    this.showCommentModal = true;
  }

  closeCommentModal() {
    this.showCommentModal = false;
    this.selectedComment = '';
  }
  downloadSubmission(submission: any) {
    const rfqId = this.rfqId || 'RFQ';

    const subcontractor = (
      submission.subcontractorName ||
      this.previousSubmissions.find((s) => s.subcontractorName)?.subcontractorName ||
      'Subcontractor'
    ).replace(/\s+/g, '_');

    const today = new Date();
    const yyyymmdd =
      today.getFullYear() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');

    const ext = submission.fileName?.split('.').pop() || 'pdf';

    const fileName = `${rfqId}_${subcontractor}_${yyyymmdd}.${ext}`;

    const link = document.createElement('a');
    link.href = submission.attachmentUrl;
    link.download = fileName;
    link.click();
  }

  loadPreviousSubmissions() {
    this.rfqResponseService.getPreviousSubmissions(this.rfqId, this.subId).subscribe({
      next: (res: any[]) => {
        const backendData = res.map((r) => ({
          date: r.UploadedOn, // ✅
          amount: r.TotalQuoteAmount ?? null, // optional
          attachmentUrl: r.AttachmentUrl, // ✅
          comment: r.Comment ?? null,
          fileName: r.FileName, // ✅ IMPORTANT
          subcontractorName: r.SubcontractorName, // ✅ THIS FIXES DOWNLOAD
        }));

        const key = `rfq_prev_submissions_${this.rfqId}_${this.subId}`;
        const localData = JSON.parse(localStorage.getItem(key) || '[]');

        this.previousSubmissions = [...backendData, ...localData];
      },
      error: () => console.warn('Failed to load previous submissions.'),
    });
  }

  private pickWorkItem(wi?: any) {
    if (wi) this.selectedWorkItem = wi;
    return this.selectedWorkItem;
  }

  getButtonClass(wi: any, buttonType: 'interested' | 'maybe' | 'not'): string {
    const baseClass = buttonType === 'interested' ? 'btn-pill--primary' : 'btn-pill--outline';

    // Check if this button's status matches the work item's current status
    if (buttonType === 'interested' && wi.status === 'Interested') {
      return `${baseClass} active-interest`;
    }
    if (buttonType === 'maybe' && wi.status === 'Maybe Later') {
      return `${baseClass} active-interest`;
    }
    if (buttonType === 'not' && wi.status === 'Not Interested') {
      return `${baseClass} active-interest`;
    }

    return baseClass;
  }

  // Update your submitInterest method to ensure status is saved
  submitInterest(status: string, wi?: any) {
    const target = this.pickWorkItem(wi);
    if (!target) return;

    // mark viewed
    this.rfqResponseService.markAsViewed(this.rfqId, this.subId, target.workItemID).subscribe();

    // per-row state
    target.status = status;
    target.viewed = true;
    target.buttonsDisabled = status === 'Interested';

    // ✅ track interest per work item
    target.isInterested = status === 'Interested';

    // expand quote panel automatically only if Interested
    if (status === 'Interested') {
      this.expandedId = target.workItemID;
    } else if (this.expandedId === target.workItemID) {
      this.expandedId = null;
    }

    const reasonPayload =
      status === 'Not Interested'
        ? {
            reason: target.notInterested?.reason || '',
            comment: target.notInterested?.comment || '',
          }
        : null;

    this.rfqResponseService
      .submitRfqResponse(this.rfqId, this.subId, target.workItemID, status, reasonPayload, null)
      .subscribe({
        next: () => {
          if (status === 'Maybe Later') {
            alert(
              'Your preference has been recorded. You may respond any time before the due date.'
            );
          } else {
            alert(`Your response "${status}" was recorded successfully!`);
          }
          const key = `rfq_state_${this.rfqId}_${this.subId}_${target.workItemID}`;
          localStorage.setItem(
            key,
            JSON.stringify({
              status, // ✅ IMPORTANT: Save the status
              viewed: true,
              buttonsDisabled: target.buttonsDisabled,
              isInterested: target.isInterested,
              notInterested: reasonPayload,
            })
          );
        },
        error: () => {
          alert('Failed to submit response.');
          target.buttonsDisabled = false;
          target.isInterested = false; // rollback on error
        },
      });
  }

  submitQuoteFile(wi?: any) {
    const target = this.pickWorkItem(wi);
    if (!target) return;

    this.formSubmitted = true;

    if (this.quoteForm.invalid) {
      alert('Please fill all required fields.');
      return;
    }

    const file = this.selectedFiles[0];
    if (!file) return;

    const { quoteAmount, comments } = this.quoteForm.getRawValue();
    const trimmedComment = comments?.trim();
    const totalAmount = Number(quoteAmount || 0);

    const key = `rfq_prev_submissions_${this.rfqId}_${this.subId}_${target.workItemID}`;
    const previous = JSON.parse(localStorage.getItem(key) || '[]');

    this.rfqResponseService
      .uploadQuoteFile(this.rfqId, this.subId, target.workItemID, file, totalAmount, comments)
      .subscribe({
        next: (res: any) => {
          alert(this.isQuoteSubmitted ? 'Quote re-submitted!' : 'Quote submitted!');

          this.isQuoteSubmitted = true;
          target.isQuoteSubmitted = true;

          const newSubmission = {
            date: new Date().toISOString(),
            amount: totalAmount,
            documentId: res.documentId,
            attachmentUrl: URL.createObjectURL(file),
            fileName: file.name,
            comment: comments,
          };

          previous.unshift(newSubmission);
          localStorage.setItem(key, JSON.stringify(previous));

          target.previousSubmissions ??= [];
          target.previousSubmissions.unshift(newSubmission);

          // ✅ CREATE LOG CONVERSATION ONLY IF COMMENT EXISTS
          if (trimmedComment) {
            const message = `
Quote Submitted

RFQ Number     : ${this.rfq?.rfqNumber || ''}
Work Item Name : ${target?.name || ''}
Quote Amount   : ${new Intl.NumberFormat('nl-NL', {
              style: 'currency',
              currency: 'EUR',
            }).format(totalAmount)}
Comment        : ${trimmedComment}
`.trim();

            const payload: LogConversation = {
              projectID: this.project?.projectID,
              rfqID: this.rfqId ?? null,
              subcontractorID: this.subId,
              projectManagerID: this.project?.projectManagerID,
              conversationType: 'Email',
              subject: 'Quote Submitted',
              message,
              messageDateTime: new Date(),
            };

            if (payload.projectID && payload.projectManagerID) {
              this.projectService.createLogConversation(payload).subscribe({
                next: (res) => console.log('Quote comment logged successfully:', res),
                error: (err) => console.error('Failed to log quote comment:', err),
              });
            }
          }

          // ✅ RESET FORM
          this.quoteForm.reset({ quoteAmount: '', comments: '' });
          this.selectedFiles = [];
          this.formSubmitted = false;

          if (this.fileInput) {
            this.fileInput.nativeElement.value = '';
          }

          this.rightSectionVisible = false;
          this.hideRightSummaryCard = true;
        },
        error: () => {
          alert('Failed to upload quote');
        },
      });
  }

  statusClass(status?: string) {
    if (!status) return '';
    const s = status.toLowerCase();
    if (s.includes('progress')) return 'in-progress';
    if (s.includes('delay')) return 'delayed';
    if (s.includes('cancel')) return 'cancelled';
    return 'in-progress';
  }

  checkLinkValidity() {
    if (!this.rfq) {
      console.warn('RFQ not loaded yet.');
      return;
    }

    const now = new Date();
    const dueDate = new Date(this.rfq.globalDueDate || this.rfq.dueDate);

    console.log('Checking validity:', dueDate);

    if (now > dueDate) {
      this.buttonsDisabled = true;
      alert('This RFQ link has expired. You can no longer respond.');
    }
  }
}
