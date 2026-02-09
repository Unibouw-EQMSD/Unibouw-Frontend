// ProjectSummary.ts (FULL updated version)
// Changes:
// - Remove incorrect "global" restore using RFQ number key
// - Restore/save button state PER workItemID only
// - Persist MaybeLater date + NotInterested reason/comment so UI stays after refresh

import { Component, ElementRef, OnInit, ViewChild, HostListener } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { projectService } from '../../services/project.service';
import { CommonModule, registerLocaleData } from '@angular/common';
import localeNl from '@angular/common/locales/nl';
import { FormsModule } from '@angular/forms';
import { finalize, tap } from 'rxjs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { RfqResponseService } from '../../services/rfq-response.service';

interface NotInterestedData {
  reason: string;
  comment?: string;
  submitted: boolean;
}

interface LogConversation {
  projectID: string;
  subcontractorID: string;
  conversationType: string;
  subject: string;
  message: string;
  messageDateTime?: Date | null;
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

  // These are global flags; keep if you need them elsewhere, but do NOT use them to restore per-row status
  isInterested = false;
  buttonsDisabled = false;
  isQuoteSubmitted = false;

  expandedId: string | number | null = null;

  maxFileSize = 10 * 1024 * 1024;
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

  quoteForm!: FormGroup;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  previousSubmissions: {
    subcontractorName: string;
    date: string | Date;
    amount: number;
    attachmentUrl: string;
    comment?: string;
    fileName?: string;
  }[] = [];

  selectedComment: string = '';
  showCommentModal: boolean = false;
  formSubmitted: boolean = false;

  openDropdown: { id: string | number | null; type: '' | 'maybe' | 'not' } = { id: null, type: '' };

  // (You had these but not initialized; leaving as-is)
  r: any;
  el: any;

  constructor(
    private route: ActivatedRoute,
    private rfqResponseService: RfqResponseService,
    private projectService: projectService,
    private fb: FormBuilder,
    private http: HttpClient,
  ) {
    registerLocaleData(localeNl);

    this.attachments = this.fb.array<FormControl<File | null>>([this.fb.control<File | null>(null)]);
  }

  @HostListener('mousemove', ['$event'])
  onMove(e: MouseEvent) {
    if (!this.r || !this.el) return;
    this.r.setStyle(this.el.nativeElement, '--tt-x', `${e.clientX}px`);
    this.r.setStyle(this.el.nativeElement, '--tt-y', `${e.clientY}px`);
  }

  ngOnInit(): void {
    this.quoteForm = this.fb.group({
      quoteAmount: ['', [Validators.required, Validators.pattern(/^[0-9.,]+$/)]],
comments: ['', [Validators.required, Validators.maxLength(200)]],    });

    this.route.queryParams.subscribe((params) => {
      this.rfqId = params['rfqId'];
      this.subId = params['subId'];
      this.number = params['number'];

      if (this.rfqId && this.subId) {
        // ✅ DO NOT restore interest/buttons state using RFQ number key.
        // Interest is per workItemID and will be restored inside loadProjectSummary().

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
    this.rightSectionVisible = true;
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

        // ================= DATE HANDLING =================
        const now = new Date();
        this.today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
          now.getDate(),
        ).padStart(2, '0')}`;

        const rawDueDate = this.rfq?.globalDueDate || this.rfq?.dueDate || this.rfq?.DueDate;
        if (rawDueDate) {
          const dateOnly = rawDueDate.split('T')[0];
          this.dueDate = dateOnly;
          this.isRfqExpired = new Date() > new Date(`${dateOnly}T23:59:59`);
        }

        // ================= RESTORE STATE (PER WORK ITEM) =================
        this.workItems.forEach((w: any) => {
  const stateKey = `rfq_state_${this.rfqId}_${this.subId}_${w.workItemID}`;
const savedState = localStorage.getItem(stateKey);

if (savedState) {
  const state = JSON.parse(savedState);

  // restore status + viewed
  w.status = state.status || w.status || '';
  w.viewed = state.viewed ?? true;

  // ✅ restore disabled state (fallback: disable if status is Interested)
  w.buttonsDisabled =
    state.buttonsDisabled ?? (String(w.status).toLowerCase() === 'interested');

  // ✅ restore interested flag (fallback: true if status is Interested)
  w.isInterested =
    state.isInterested ?? (String(w.status).toLowerCase() === 'interested');

  // restore maybe later date
  w.maybeLaterDate = state.maybeLaterDate || w.maybeLaterDate || '';

  // restore not interested
  if (state.notInterested) {
    w.notInterested = {
      reason: state.notInterested.reason || '',
      comment: state.notInterested.comment || '',
      submitted: false,
    };
  }
} else {
  // defaults for first-time load
  w.status = w.status || '';
  w.viewed = !!w.viewed;
  w.buttonsDisabled = false;
  w.isInterested = false;
  w.maybeLaterDate = '';
  w.notInterested = w.notInterested || { reason: '', comment: '', submitted: false };
}

// expand only if interested
if (w.isInterested) {
  this.expandedId = w.workItemID;
}
console.log('RESTORE KEY PARTS', {
  rfqId: this.rfqId,
  subId: this.subId,
  workItemID: w.workItemID,
  workItemId: w.workItemId,
});

          // ===== Restore previous submissions per work item =====
          const subKey = `rfq_prev_submissions_${this.rfqId}_${this.subId}_${w.workItemID}`;
          w.previousSubmissions = JSON.parse(localStorage.getItem(subKey) || '[]');
          if (w.previousSubmissions.length > 0) {
            w.isQuoteSubmitted = true;
          }

          // ===== Mark as viewed (server-side) =====
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

    if (type === 'not' && !wi.notInterested) {
      wi.notInterested = { reason: '', comment: '', submitted: false } as NotInterestedData;
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

    wi.status = 'Maybe Later';

    const workItemName = wi?.name || '';
    const rfqNumber = this.rfq?.rfqNumber || '';
    const maybeLaterDate = wi.maybeLaterDate;

    const formattedDate = maybeLaterDate
      ? new Date(maybeLaterDate).toLocaleDateString('en-GB').replace(/\//g, '-')
      : '';

    const message = `
Maybe Later – Confirmation

RFQ Number     : ${rfqNumber}
Work Item Name : ${workItemName}
Follow-up Date : ${formattedDate}
`.trim();

    const payload: LogConversation = {
      projectID: this.project?.projectID,
      subcontractorID: this.subId,
      conversationType: 'Email',
      subject: 'Marked as Maybe Later',
      message,
      messageDateTime: null as any,
    };

    if (!payload.projectID) {
      alert('Project data not loaded yet. Please try again.');
      return;
    }

    this.isLoading = true;

    this.projectService
      .createLogConversation(payload)
      .pipe(
        tap((res) => console.log('Log conversation saved:', res)),
        finalize(() => (this.isLoading = false)),
      )
      .subscribe({
        next: () => {
          wi.status = 'Maybe Later';
          this.submitInterest('Maybe Later', wi);
          this.closeDropdowns();
        },
        error: (err) => {
          console.error('Error saving conversation:', err);
          alert('Failed to save conversation. Please try again.');
        },
      });
  }

  confirmNotInterested(wi: any): void {
    const reason = wi?.notInterested?.reason?.trim();
    let comment = wi?.notInterested?.comment?.trim();
    const workItemName = wi?.name || '';
    const rfqNumber = this.rfq?.rfqNumber || '';

    if (!reason) {
      alert('Please select a reason.');
      return;
    }
    if (reason !== 'Anders') {
      wi.notInterested.comment = '';
      comment = '';
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
${reason === 'Anders' ? `Comment        : ${comment}` : ''}
`.trim();

    const payload: LogConversation = {
      projectID: this.project?.projectID,
      subcontractorID: this.subId,
      conversationType: 'Email',
      subject: 'Marked as Not Interested',
      message,
      messageDateTime: null as any,
    };

    if (!payload.projectID) {
      alert('Project data not loaded yet. Please try again.');
      return;
    }

    this.isLoading = true;

    this.projectService
      .createLogConversation(payload)
      .pipe(
        tap((res) => console.log('Log conversation saved:', res)),
        finalize(() => (this.isLoading = false)),
      )
      .subscribe({
        next: () => {
          wi.status = 'Not Interested';
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

    if (file.size > this.maxFileSize) {
      this.fileSizeError = 'File size must not exceed 10 MB.';
      event.target.value = '';
      return;
    }

    this.selectedFiles = [file];
  }

  removeFile(inputRef: HTMLInputElement) {
    this.selectedFiles = [];
    inputRef.value = '';
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
          date: r.UploadedOn,
          amount: r.TotalQuoteAmount ?? null,
          attachmentUrl: r.AttachmentUrl,
          comment: r.Comment ?? null,
          fileName: r.FileName,
          subcontractorName: r.SubcontractorName,
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

    if (buttonType === 'interested' && wi.status === 'Interested') return `${baseClass} active-interest`;
    if (buttonType === 'maybe' && wi.status === 'Maybe Later') return `${baseClass} active-interest`;
    if (buttonType === 'not' && wi.status === 'Not Interested') return `${baseClass} active-interest`;

    return baseClass;
  }

  submitInterest(status: string, wi?: any) {
    const target = this.pickWorkItem(wi);
    if (!target) return;

    // mark viewed
    this.rfqResponseService.markAsViewed(this.rfqId, this.subId, target.workItemID).subscribe();

    // set state for UI
    target.status = status;
    target.viewed = true;

    // only disable buttons when Interested (as your old logic)
    target.buttonsDisabled = status === 'Interested';
    target.isInterested = status === 'Interested';

    // expand quote panel only if Interested
    if (status === 'Interested') {
      this.expandedId = target.workItemID;
    } else if (this.expandedId === target.workItemID) {
      this.expandedId = null;
    }

    const reasonPayload =
      status === 'Not Interested'
        ? { reason: target.notInterested?.reason || '', comment: target.notInterested?.comment || '' }
        : null;

    this.rfqResponseService
      .submitRfqResponse(this.rfqId, this.subId, target.workItemID, status, reasonPayload, null)
      .subscribe({
        next: () => {
          if (status === 'Maybe Later') {
            alert('Your preference has been recorded. You may respond any time before the due date.');
          } else {
            alert(`Your response "${status}" was recorded successfully!`);
          }

          // ✅ SAVE PER WORK ITEM
          const key = `rfq_state_${this.rfqId}_${this.subId}_${target.workItemID}`;
          localStorage.setItem(
            key,
            JSON.stringify({
              status,
              viewed: true,
              buttonsDisabled: target.buttonsDisabled,
              isInterested: target.isInterested,
              notInterested: reasonPayload,
              maybeLaterDate: target.maybeLaterDate || null,
            }),
          );
        },
        error: () => {
          alert('Failed to submit response.');
          target.buttonsDisabled = false;
          target.isInterested = false;
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
          alert(target.isQuoteSubmitted ? 'Quote re-submitted!' : 'Quote submitted!');

          target.isQuoteSubmitted = true;

          const newSubmission = {
            date: new Date().toISOString(),
            amount: totalAmount,
            documentId: res.documentId,
            attachmentUrl: URL.createObjectURL(file),
            fileName: file.name,
            comment: comments,
            subcontractorName: this.subcontractor?.name || 'Subcontractor',
          };

          previous.unshift(newSubmission);
          localStorage.setItem(key, JSON.stringify(previous));

          target.previousSubmissions ??= [];
          target.previousSubmissions.unshift(newSubmission);

          if (trimmedComment) {
            const message = `
Quote Submitted

RFQ Number     : ${this.rfq?.rfqNumber || ''}
Work Item Name : ${target?.name || ''}
Quote Amount   : ${new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(totalAmount)}
Comment        : ${trimmedComment}
`.trim();

            const payload: LogConversation = {
              projectID: this.project?.projectID,
              subcontractorID: this.subId,
              conversationType: 'Email',
              subject: 'Quote Submitted',
              message,
              messageDateTime: null as any,
            };

            if (payload.projectID) {
              this.projectService.createLogConversation(payload).subscribe({
                next: (r) => console.log('Quote comment logged successfully:', r),
                error: (err) => console.error('Failed to log quote comment:', err),
              });
            }
          }

          this.quoteForm.reset({ quoteAmount: '', comments: '' });
          this.selectedFiles = [];
          this.formSubmitted = false;

          if (this.fileInput) this.fileInput.nativeElement.value = '';

          this.rightSectionVisible = false;
          this.hideRightSummaryCard = true;
        },
        error: () => alert('Failed to upload quote'),
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

    const dueDate = new Date(this.rfq.globalDueDate || this.rfq.dueDate);

    if (new Date() > dueDate) {
      this.buttonsDisabled = true;
      alert('This RFQ link has expired. You can no longer respond.');
    }
  }
}