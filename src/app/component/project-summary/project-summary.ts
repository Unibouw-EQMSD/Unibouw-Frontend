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
import { HostListener } from '@angular/core';

interface NotInterestedData {
  reason: string;
  comment?: string;
  submitted: boolean;
}

@Component({
  selector: 'app-project-summary',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
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
    date: string | Date;
    amount: number;
    attachmentUrl: string;
    comment?: string;
  }[] = [];
  selectedComment: string = '';
  showCommentModal: boolean = false;
  formSubmitted: boolean = false;
  openDropdown: { id: string | number | null; type: '' | 'maybe' | 'not' } = { id: null, type: '' };

  constructor(
    private route: ActivatedRoute,
    private rfqResponseService: RfqResponseService,
    private fb: FormBuilder,
    private http: HttpClient
  ) {
    registerLocaleData(localeNl);

    this.attachments = this.fb.array<FormControl<File | null>>([
      this.fb.control<File | null>(null),
    ]);
  }
  ngOnInit(): void {
    this.quoteForm = this.fb.group({
      quoteAmount: ['', Validators.required],
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

        // Existing logic — mark as viewed
        if (this.number) {
          this.rfqResponseService.markAsViewed(this.rfqId, this.subId, this.number).subscribe();
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

        if (!res || !res.project) {
          this.errorMsg = 'No project data found.';
          return;
        }

        this.project = res.project;
        this.rfq = res.rfq;

        /* =====================================================
             ✅ DATE HANDLING (TIMEZONE SAFE)
             ===================================================== */

        // TODAY (YYYY-MM-DD)
        const now = new Date();
        this.today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
          now.getDate()
        ).padStart(2, '0')}`;

        // RFQ DUE DATE (DATE ONLY)
        const rawDueDate = this.rfq?.globalDueDate || this.rfq?.dueDate || this.rfq?.DueDate;

        if (rawDueDate) {
          const dateOnly = rawDueDate.split('T')[0];
          this.dueDate = dateOnly;

          const endOfDue = new Date(`${dateOnly}T23:59:59`);
          this.isRfqExpired = new Date() > endOfDue;
        } else {
          this.dueDate = '';
          this.isRfqExpired = false;
        }

        /* ===================================================== */

        this.workItems = res.workItems || [];

        console.log('TODAY:', this.today);
        console.log('RFQ DUE DATE:', this.dueDate);
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

    wi.status = 'Maybe Later';

    this.submitInterest('Maybe Later', wi);

    alert('Your preference has been recorded.');
  }

  confirmNotInterested(wi: any) {
    const reason = wi.notInterested?.reason?.trim();
    const comment = wi.notInterested?.comment?.trim();

    if (!reason) {
      alert('Please select a reason.');
      return;
    }

    if (reason === 'Anders' && !comment) {
      alert('Please enter a reason.');
      return;
    }

    // ✅ Proceed
    this.submitInterest('Not Interested', wi);
    this.closeDropdowns();
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
    if (!submission?.attachmentUrl) {
      alert('No file available to download.');
      return;
    }

    // Create a hidden download link
    const link = document.createElement('a');
    link.href = submission.attachmentUrl;
    link.download = submission.fileName || 'Quote.pdf'; // fallback filename
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  loadPreviousSubmissions() {
    this.rfqResponseService.getPreviousSubmissions(this.rfqId, this.subId).subscribe({
      next: (res: any[]) => {
        // Load backend rows
        const backendData = res.map((r) => ({
          date: r.uploadedOn,
          amount: r.totalQuoteAmount,
          attachmentUrl: r.attachmentUrl || null,
          comment: r.comment,
        }));

        // Load stored file URLs from localStorage
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

  submitInterest(status: string, wi?: any) {
    const target = this.pickWorkItem(wi);
    if (!target) return;

    const key = `rfq_state_${this.rfqId}_${this.subId}_${target.workItemID}`;

    // 🔹 mark viewed
    this.rfqResponseService.markAsViewed(this.rfqId, this.subId, target.workItemID).subscribe();

    // 🔹 per-row state
    target.status = status;
    target.viewed = true;
    target.buttonsDisabled = status === 'Interested';

    // 🔹 expand quote panel
    if (status === 'Interested') {
      this.expandedId = target.workItemID;
    } else if (this.expandedId === target.workItemID) {
      this.expandedId = null;
    }

    // 🔹 reason payload (ONLY for Not Interested)
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
          alert(`Your response "${status}" was recorded successfully!`);

          localStorage.setItem(
            key,
            JSON.stringify({
              status,
              viewed: true,
              buttonsDisabled: target.buttonsDisabled,
              notInterested: reasonPayload,
            })
          );
        },
        error: () => {
          alert('Failed to submit response.');
          target.buttonsDisabled = false;
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
    const totalAmount = Number(quoteAmount || 0);

    // ✅ PER-WORKITEM KEY
    const key = `rfq_prev_submissions_${this.rfqId}_${this.subId}_${target.workItemID}`;
    const previous = JSON.parse(localStorage.getItem(key) || '[]');

    this.rfqResponseService
      .uploadQuoteFile(this.rfqId, this.subId, file, totalAmount, comments)
      .subscribe({
        next: () => {
          alert(this.isQuoteSubmitted ? 'Quote re-submitted!' : 'Quote submitted!');

          this.isQuoteSubmitted = true;
          target.isQuoteSubmitted = true;

          const newSubmission = {
            date: new Date().toISOString(),
            amount: totalAmount,
            attachmentUrl: URL.createObjectURL(file),
            fileName: file.name,
            comment: comments,
          };

          // ✅ SAVE
          previous.unshift(newSubmission);
          localStorage.setItem(key, JSON.stringify(previous));

          // ✅ UPDATE UI IMMEDIATELY
          if (!target.previousSubmissions) {
            target.previousSubmissions = [];
          }
          target.previousSubmissions.unshift(newSubmission);

          // ✅ RESET FORM
          this.quoteForm.reset({ quoteAmount: '', comments: '' });
          this.selectedFiles = [];
          this.formSubmitted = false;

          // ✅ CLEAR FILE INPUT (THIS IS THE KEY FIX)
          if (this.fileInput) {
            this.fileInput.nativeElement.value = '';
          }
          this.rightSectionVisible = false;
          this.hideRightSummaryCard = true;
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
