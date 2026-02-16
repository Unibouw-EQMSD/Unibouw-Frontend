import { ChangeDetectorRef, Component, ViewChild, ElementRef } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { RfqService, Rfq } from '../../../services/rfq.service';
import { ActivatedRoute } from '@angular/router';
import { projectdetails, projectService } from '../../../services/project.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RfqResponseService } from '../../../services/rfq-response.service';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ReminderService } from '../../../services/reminder.service';
import { registerLocaleData } from '@angular/common';
import localeNl from '@angular/common/locales/nl';
import { Location } from '@angular/common';
import { switchMap, finalize, map } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { UserService } from '../../../services/User.service.';
import { NavigationStart } from '@angular/router';
import { filter, Subscription } from 'rxjs';

interface RfqResponse {
  name: string;
  rating: number;
  documentId: string;
  date: string;
  rfqId: string;
  rfqNumber: string;
  responded: boolean;
  interested: boolean;
  viewed: boolean;
  maybeLater: boolean;
  notInterested: number;
  quote: string;
  actions: string[];
  subcontractorId: string; // << ADD THIS
  quoteAmount?: string;
  dueDate?: Date;
}

interface WorkItem {
  workItemId: string;
  name: string;
  requestsSent: number;
  notResponded: number;
  interested: number;
  notInterested: number;
  viewed: number;
  maybeLater: number;
  open: boolean;
  searchText: string;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  currentStart: number;
  currentEnd: number;
  rfqs: RfqResponse[];
}

interface RFQConversationMessage {
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

export interface RFQConversationMessageAttachment {
  attachmentID: string;
  conversationMessageID: string;
  fileName: string;
  fileExtension: string;
  fileSize: number;
  filePath: string;
  uploadedBy?: string;
  uploadedOn?: string;
  isActive: boolean;
}

// log-conversation.model.ts
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

interface UploadResult {
  res: RFQConversationMessage;
  paths: string[];
}

export const MY_FORMATS = {
  parse: {
    dateInput: 'DD-MM-YYYY',
  },
  display: {
    dateInput: 'DD-MM-YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'DD-MM-YYYY',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
  selector: 'app-view-projects',
  standalone: false,
  templateUrl: './view-projects.html',
  styleUrls: ['./view-projects.css'],
})
export class ViewProjects {
  projectId!: string;
  projectDetails: any;
  projectData?: projectdetails;
  selectedFile!: File;
  rfqId!: string;
  subId!: string;
  dueDate!: Date;
  quoteAmount: string = '';
  groupBy = 'workItem';
  currentPage = 1;
  totalPages = 1;
  searchText = '';
  filteredItems: any[] = [];
  pagedItems: any[] = [];
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100, 200];
  selectedTab = 'response';
  rfqList: any[] = [];
  selectedRfqId: string = '';
  subcontractorGroups: any[] = [];
  rfqCreatedDate: string | Date | null = null;
  displayedColumns: string[] = [
    'number',
    'workitem',
    'rfqSentDate',
    'dueDate',
    'totalSubcontractors',
    'quoteRecieved',
    'status',
    'actions',
  ];
  filteredConvoSubcontractors: any[] = [];
  allPmSubConversationData: any[] = [];

  dataSource = new MatTableDataSource<any>([]);
  isLoading = false;
  isSpinLoading = false;
  rfqs: Rfq[] = []; // <-- Add this line
  duedate: Date | null = null;
  GlobalReminderConfig: any = null;
  reminderDates: string[] = [];
  reminderTime: string = '';
  reminderEmailBody: string = '';
  minDate: Date = new Date();
  maxDate!: Date;
  maxDateTime: string = '';
  dateTimeError = '';
  notesError = '';
  dateTimeTouched = false;
  conversationSearchText = '';
  // convoattachments?: RFQConversationMessageAttachment[];

  convoSubcontractors: { id: string; name: string }[] = [];
  replyingToMessageId: string | null = null;
  replyText = '';
  replySubject = '';
  replyTexts: { [key: string]: string } = {}; // store reply text per message
  replyAttachments: File[] = [];
  isSendingReply = false;
  replyError = '';
  readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  readonly MAX_FILES = 3;
replyCharError: { [id: string]: boolean } = {};
conversationTextError = '';

validateReply(id: string) {
  const text = this.replyTexts[id] || '';
  this.replyCharError[id] = text.length > 5000;
}
  setMaxDueDate(due: Date | string) {
    if (typeof due === 'string') {
      // assume format is "DD-MM-YYYY"
      const [day, month, year] = due.split('-').map(Number);
      this.maxDate = new Date(year, month - 1, day);
    } else {
      this.maxDate = new Date(due); // clone to avoid reference issues
    }
  }

  isAddDisabled(): boolean {
    if (!this.customReminderDates.length) return false;

    const lastDateValue = this.customReminderDates[this.customReminderDates.length - 1];
    if (!lastDateValue) return true; // prevent adding empty rows

    const lastDate = new Date(lastDateValue);

    return lastDate >= this.maxDate;
  }

  @ViewChild('chatMessages') private chatMessages!: ElementRef;
  private scrollToBottom(): void {
    try {
      const el = this.chatMessages.nativeElement;
      el.scrollTop = el.scrollHeight;
    } catch {}
  }

  @ViewChild(MatPaginator)
  set paginator(p: MatPaginator) {
    if (p) {
      this.dataSource.paginator = p;
      p.firstPage();
    }
  }
 @ViewChild('rfqSort') rfqSort!: MatSort;

ngAfterViewInit() {
  // In case the table is already visible at init
  this.applyRfqSorting();
}

ngOnChanges() {
  // optional, only if you use OnChanges
  this.applyRfqSorting();
}

// Call this whenever selectedTab becomes 'rfq' or after dataSource is set/refreshed
private applyRfqSorting(): void {
  if (!this.dataSource || !this.rfqSort) return;

  this.dataSource.sort = this.rfqSort;

  // 1) Normalize values per column (ALWAYS same type)
  this.dataSource.sortingDataAccessor = (row: any, column: string): string | number => {
    switch (column) {
      case 'number':
        // If number can be like "RFQ-12", keep string compare. If it's pure numeric, convert to number.
        return this.normalizeText(row.number);

      case 'workitem':
        return this.normalizeText(row.workItem);

      case 'rfqSentDate':
        return this.normalizeDate(row.rfqSentDate); // number (timestamp)

      case 'dueDate':
        return this.normalizeDate(row.globalDueDate); // number (timestamp)

      case 'totalSubcontractors':
        return this.normalizeNumber(row.rfqSent);

      case 'quoteRecieved': // column id
        return this.normalizeNumber(row.quoteReceived);

      case 'status':
        return this.normalizeText(row.status);

      default:
        return this.normalizeText(row?.[column]);
    }
  };

  // 2) Force a consistent compare for ALL columns (prevents "mixed" results)
  this.dataSource.sortData = (data: any[], sort: MatSort) => {
    const { active, direction } = sort;
    if (!active || direction === '') return data;

    const dir = direction === 'asc' ? 1 : -1;

    return [...data].sort((a, b) => {
      const av = this.dataSource.sortingDataAccessor(a, active);
      const bv = this.dataSource.sortingDataAccessor(b, active);

      // numbers
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }

      // strings (locale compare is more consistent than < > for text)
      const as = String(av ?? '').trim();
      const bs = String(bv ?? '').trim();
      return as.localeCompare(bs) * dir;
    });
  };
}

private normalizeText(v: any): string {
  if (v === null || v === undefined || v === '-') return '';
  return String(v).trim().toLowerCase();
}

private normalizeNumber(v: any): number {
  if (v === null || v === undefined || v === '' || v === '-') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
private normalizeDate(v: any): number {
  if (!v || v === '-') return 0;

  // If already Date
  if (v instanceof Date) return v.getTime();

  // Try normal parse first (ISO works)
  const t1 = Date.parse(v);
  if (!Number.isNaN(t1)) return t1;

  // Try dd/MM/yyyy (common case) + also handle:
  // d/M/yyyy, dd-MM-yyyy, and optional time (HH:mm / HH:mm AM|PM)
  if (typeof v === 'string') {
    const s = v.trim();

    const m = s.match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i
    );

    if (m) {
      const dd = +m[1];
      const mm = +m[2] - 1;
      const yy = +m[3];

      let hh = m[4] ? +m[4] : 0;
      const min = m[5] ? +m[5] : 0;
      const ap = m[6]?.toUpperCase();

      if (ap === 'PM' && hh < 12) hh += 12;
      if (ap === 'AM' && hh === 12) hh = 0;

      return new Date(yy, mm, dd, hh, min, 0, 0).getTime();
    }
  }

  return 0;
}

private toTime(value: any): number {
  if (!value || value === '-') return 0;

  // If your backend sends dd/MM/yyyy, Date() may fail. Handle both safely.
  if (typeof value === 'string') {
    // Try ISO/Date-parsable first
    const t1 = Date.parse(value);
    if (!Number.isNaN(t1)) return t1;

    // Try dd/MM/yyyy
    const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) {
      const dd = +m[1], mm = +m[2] - 1, yy = +m[3];
      return new Date(yy, mm, dd).getTime();
    }
  }

  const t2 = new Date(value).getTime();
  return Number.isNaN(t2) ? 0 : t2;
}

  workItems: WorkItem[] = [];
    private navSub?: Subscription;

  constructor(
    private rfqService: RfqService,
    private router: Router,
    private rfqResponseService: RfqResponseService,
    private cdr: ChangeDetectorRef,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private projectService: projectService,
    private reminderService: ReminderService,
    private location: Location,
    private translate: TranslateService,
    public userService: UserService,
  ) {
    registerLocaleData(localeNl);
  }
private setupTabCleanupOnExit(tabKey: string): void {
  this.navSub?.unsubscribe();

  this.navSub = this.router.events
    .pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
    .subscribe((e) => {
      // clear only when leaving this module
      const leavingViewProjects = !e.url.startsWith('/view-projects/');
      if (leavingViewProjects) {
        sessionStorage.removeItem(tabKey);
      }
    });
}
 ngDoCheck(): void {
  if (!this.conversationDateTime) return;

  const selected = new Date(this.conversationDateTime);

  // "Now" in Europe/Amsterdam converted to an absolute Date
  const amsterdamNow = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })
  );

  if (selected.getTime() > amsterdamNow.getTime()) {
    this.dateTimeError = 'Future time selection is not allowed';
    this.conversationDateTime = null;
  } else {
    this.dateTimeError = '';
  }

  }

ngOnInit(): void {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  this.maxDateTime = `${yyyy}-${mm}-${dd}T${hh}:${min}`;

  this.projectId = this.route.snapshot.paramMap.get('id') || '';
  const tabKey = `activeTab_viewProjects_${this.projectId}`;

  // ✅ read tab from URL first (used when coming from cancel -> tab=rfq)
  const tabFromUrl = this.route.snapshot.queryParamMap.get('tab');

  if (tabFromUrl === 'rfq' || tabFromUrl === 'response' || tabFromUrl === 'conversation') {
    this.selectedTab = tabFromUrl;
  } else {
    // ✅ fallback to session storage for refresh behavior
    const savedTab = sessionStorage.getItem(tabKey);
    this.selectedTab = savedTab || 'response';
  }

  if (this.projectId) {
    this.loadProjectDetails(this.projectId);
    this.loadRfqResponseSummary(this.projectId);

    if (this.selectedTab === 'rfq') {
      this.loadRfqData();
    } else if (this.selectedTab === 'conversation') {
      this.loadConversationSubcontractors();
    }
  }

  this.setupTabCleanupOnExit(tabKey);

  // ✅ optional: remove tab param after using it (prevents it forcing RFQ tab on refresh)
  if (tabFromUrl) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
 setActiveTab(tab: string): void {
  this.selectedTab = tab;

  const tabKey = `activeTab_viewProjects_${this.projectId}`;
  sessionStorage.setItem(tabKey, tab);
}
ngOnDestroy(): void {
  this.navSub?.unsubscribe();
}
//   ngAfterViewInit() {
//   this.dataSource.sort = this.sort;
//   this.dataSource.paginator = this.paginator;

//   this.dataSource.sortingDataAccessor = (row, property) => {
//     switch (property) {

//       case 'number':
//         const match = row.number?.match(/\d+/);
//         return match ? parseInt(match[0], 10) : 0;

//       case 'rfqSentDate':
//         return row.rfqSentDate && row.rfqSentDate !== '-'
//           ? new Date(row.rfqSentDate).getTime()
//           : 0;

//       case 'dueDate':
//         return row.globalDueDate
//           ? new Date(row.globalDueDate).getTime()
//           : 0;

//       case 'totalSubcontractors':
//         return row.rfqSent || 0;

//       case 'quoteRecieved':
//         return row.quoteReceived || 0;

//       case 'status':
//         return row.status?.toLowerCase() || '';

//       case 'workitem':
//         return row.workItem?.toLowerCase() || '';

//       default:
//         return (row as any)[property];
//     }
//   };
// }

  goBack(): void {
    this.location.back();
  }

  startAutoReminderWatcher() {
    setInterval(() => {
      this.checkAndTriggerReminder();
    }, 60000); // check every 60 seconds
  }

  checkAndTriggerReminder() {
    this.sendReminder();
  }

  loadProjectDetails(id: string) {
    // this.isLoading = true;
    this.projectService.getProjectById(id).subscribe({
      next: (res) => {
        this.projectDetails = res;
        // this.isLoading = false;
      },
      error: (err) => {
        console.error('■ Error fetching project details:', err);
        //  this.isLoading = false;
      },
    });
  }

  private requestsSentByRfqId = new Map<string, number>();

private buildRequestsSentLookup(projectId: string) {
  return this.rfqResponseService.getResponsesByProjectId(projectId).pipe(
    map((res: any[]) => {
      const mapByRfq = new Map<string, number>();

      (res || []).forEach((w: any) => {
        const rfqId = String(w.rfqId ?? w.rfqID ?? w.rfqId); // adjust if your API key differs
        const count = (w.subcontractors || []).length;

        if (rfqId) mapByRfq.set(rfqId, count);
      });

      this.requestsSentByRfqId = mapByRfq;
      return mapByRfq;
    })
  );
}

 loadRfqResponseSummary(projectId: string) {
  /* ===============================
     1️⃣ WORK ITEM GROUPED (NO LOOKUP)
     Uses backend-provided s.dueDate
     =============================== */
this.rfqResponseService.getResponsesByProjectId(projectId).subscribe({
  next: (res: any[]) => {
    const workItemMap = new Map<string, any>();

    res.forEach((w) => {
      if (!workItemMap.has(w.workItemId)) {
        workItemMap.set(w.workItemId, {
          workItemId: w.workItemId,
          name: w.workItemName,
          open: false,
          searchText: '',
          pageSize: 10,
          currentPage: 1,
          totalPages: 1,
          currentStart: 1,
          currentEnd: 10,
          requestsSent: 0,
          notResponded: 0,
          interested: 0,
          notInterested: 0,
          viewed: 0,
          maybeLater: 0,
          rfqs: [],
        });
      }

      const workItem = workItemMap.get(w.workItemId);

      (w.subcontractors || []).forEach((s: any) => {
        workItem.rfqs.push({
          subcontractorId: s.subcontractorId,
          rfqId: s.rfqId,
          workItemId: w.workItemId,
          documentId: s.documentId,
          rfqNumber: w.rfqNumber,
          name: s.name,
          rating: s.rating || 0,
          date: s.date || '—',
          responded: s.responded,
          interested: s.interested,
          notInterested: s.notInterested,
          viewed: s.viewed,
          maybeLater: s.maybeLater,
          quote: s.quote || '—',
          quoteAmount: '-',
          dueDate: s.dueDate || '—', // <- DIRECT MAPPING
          createdOn: s.createdOn,
          actions: s.documentId ? ['pdf', 'chat'] : ['chat'],
        });
      });

      workItem.requestsSent = workItem.rfqs.length;
      workItem.notResponded = workItem.rfqs.filter((r: any) => !r.responded).length;
      workItem.interested = workItem.rfqs.filter((r: any) => r.interested).length;
      workItem.notInterested = workItem.rfqs.filter((r: any) => r.notInterested).length;
      workItem.viewed = workItem.rfqs.filter((r: any) => r.viewed).length;
      workItem.maybeLater = workItem.rfqs.filter((r: any) => r.maybeLater).length;
    });

    this.workItems = Array.from(workItemMap.values());
        console.log('Work rfqs sample:', this.workItems?.[0]?.rfqs?.[0]);


    // Load quote amounts
    this.workItems.forEach((work) => {
      work.rfqs.forEach((rfq: any) => this.loadQuoteAmount(rfq));
    });
  },
  error: (err) => {
    console.error('Error loading work item responses', err);
  },
});
console.log('Work rfqs sample:', this.workItems?.[0]?.rfqs?.[0]);
console.log('Subcontractor workItems sample:', this.subcontractorGroups?.[0]?.workItems?.[0]);
  /* ===============================
     2️⃣ SUBCONTRACTOR GROUPED (NO LOOKUP)
     Uses backend-provided item.dueDate
     NOTE: your backend method GetRfqResponsesByProjectSubcontractorAsync
     must return dueDate; otherwise this will show '—'
     =============================== */
this.rfqResponseService.getResponsesByProjectSubcontractors(projectId).subscribe({
  next: (res: any[]) => {
    const grouped = (res || []).reduce((acc: any[], item: any) => {
      let group = acc.find((g) => g.subcontractorId === item.subcontractorId);

      if (!group) {
        group = {
          subcontractorId: item.subcontractorId,
          subcontractorName: item.subcontractorName,
          open: false,
          searchText: '',
          workItems: [],
          requestsSent: 0,
          notResponded: 0,
          interested: 0,
          notInterested: 0,
          viewed: 0,
          maybeLater: 0,
        };
        acc.push(group);
      }

      group.workItems.push({
        workItemId: item.workItemId ? String(item.workItemId) : null,
        workItemName: item.workItemName,
        rfqId: item.rfqId ? String(item.rfqId) : null,
        documentId: item.documentId ? String(item.documentId) : null,
        rfqNumber: item.rfqNumber,
        date: item.date,
        responded: item.responded,
        interested: item.interested,
        notInterested: item.notInterested,
        viewed: item.viewed,
        maybeLater: item.maybeLater,
        dueDate: item.dueDate || '—',    // <- DIRECT MAPPING
        createdOn: item.createdOn,
        subcontractorId: item.subcontractorId ? String(item.subcontractorId) : null,
        rating: 0,
        quoteAmount: item.quoteAmount ?? item.quote ?? '-',
        actions: item.documentId ? ['pdf'] : [],
      });

      group.requestsSent = group.workItems.length;
      group.notResponded = group.workItems.filter((w: any) => !w.responded).length;
      group.interested = group.workItems.filter((w: any) => w.interested).length;
      group.notInterested = group.workItems.filter((w: any) => w.notInterested).length;
      group.viewed = group.workItems.filter((w: any) => w.viewed).length;
      group.maybeLater = group.workItems.filter((w: any) => w.maybeLater).length;

      return acc;
    }, []);

    this.subcontractorGroups = grouped;
    console.log('Subcontractor workItems sample:', this.subcontractorGroups?.[0]?.workItems?.[0]);

    this.subcontractorGroups.forEach((sub) => {
      sub.workItems.forEach((w: any) => this.loadQuoteAmount(w));
    });
  },
  error: (err) => {
    console.error('Error loading subcontractor responses', err);
  },
});
}

  getFilteredSubWorkItems(sub: any) {
  const term = (sub.searchText || '').trim().toLowerCase();
  let list = sub.workItems || [];

  if (term) {
    list = list.filter((w: any) =>
      `${w.workItemName || ''} ${w.rfqNumber || ''} ${w.quoteAmount || ''}`
        .toLowerCase()
        .includes(term),
    );
  }

  return list;
}

  isBellEnabled(rfq: any): boolean {
    const amt = rfq.quoteAmount;

    // TRUE only when NO valid quote is submitted
    const noValidQuote = !amt || amt === '-' || isNaN(Number(amt));

    return (
      noValidQuote && // enable only if no quote uploaded
      !rfq.notInterested && // disable if Not Interested
      (rfq.viewed || rfq.interested || rfq.maybeLater) // must have engagement
    );
  }

 isPdfEnabled(rfqs: any): boolean {
    const amt = rfqs.quoteAmount;

    // Disable when "-", empty, null, undefined, or not a number
    if (!amt || amt === '-' || isNaN(Number(amt))) {
      return false;
    }

    return true;
  }

hasAnyRfqResponses(): boolean {
  // Work-item grouping: workItems -> rfqs (via getFilteredRfqs)
  const hasInWorkItems =
    (this.workItems || []).some(work =>
      (this.getFilteredRfqs(work) || []).some(rfq => !!rfq?.responded || !!rfq?.documentId)
    );

  // Subcontractor grouping: subcontractorGroups -> workItems
  const hasInSubcontractors =
    (this.subcontractorGroups || []).some(sub =>
      (sub.workItems || []).some((w: { responded: any; documentId: any; }) => !!w?.responded || !!w?.documentId)
    );

  return hasInWorkItems || hasInSubcontractors;
}
  onDatepickerOpened() {
    document.body.style.overflow = 'hidden';
  }
  onDatepickerClosed() {
    document.body.style.overflow = '';
  }

  markViewed(rfq: any, parent: any) {
    if (rfq.viewed) return;

    this.rfqResponseService.markAsViewed(rfq.rfqId, rfq.subcontractorId, rfq.workItemId).subscribe({
      next: () => {
        rfq.viewed = true;

        // Update parent summary ONLY if parent has workItems (subcontractor view)
        if (parent.workItems) {
          parent.viewed = parent.workItems.filter((w: any) => w.viewed).length;
        }

        this.cdr.detectChanges();
      },
      error: () => console.error('Failed to mark viewed'),
    });
  }

  markMaybeLater(work: WorkItem, rfq: any) {
    // 1) Immediate local update so UI reflects change right away
    const wasViewed = !!rfq.viewed;
    rfq.maybeLater = true;
    rfq.interested = false;
    rfq.notInterested = false;

    // ensure viewed tick also shows
    if (!wasViewed) {
      rfq.viewed = true;
    }

    // Immediately refresh summary counts (so header numbers update)
    this.refreshWorkItemCounts(work);

    // Force change detection immediately (UI update)
    this.cdr.detectChanges();

    // 2) Persist the response on the server as "Maybe Later"
    // Use an API that accepts the status string (your backend expects status = "Maybe Later")
    // I assume you have a method like rfqResponseService.submitResponse(rfqId, subcontractorId, workItemId, status)
    this.rfqResponseService
      .submitRfqResponse(
        rfq.rfqId,
        rfq.subcontractorId,
        work.workItemId,
        'Maybe Later', // important: persist "Maybe Later" not only "Viewed"
      )
      .subscribe({
        next: (res: any) => {
          // backend accepted — make sure counts are consistent (optional refresh)
          // Keep local UI as-is or optionally refresh from server
          this.refreshWorkItemCounts(work);
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Failed to save Maybe Later status', err);
          this.snackBar.open('Failed to mark Maybe Later. Try again.', 'Close', { duration: 3000 });
        },
      });
  }

  refreshWorkItemCounts(work: WorkItem) {
    work.requestsSent = work.rfqs.length;
    work.notResponded = work.rfqs.filter((r) => !r.responded).length;
    work.interested = work.rfqs.filter((r) => r.interested).length;
    work.notInterested = work.rfqs.filter((r) => r.responded && !r.interested).length;

    work.viewed = work.rfqs.filter((r) => r.viewed).length;
    work.maybeLater = work.rfqs.filter((r) => r.maybeLater).length; // <--- add this
  }

  triggerViewOnLoad() {
    if (!this.workItems?.length) return;

    this.workItems.forEach((work) => {
      work.rfqs.forEach((rfq) => {});
    });
  }

onTabChange(tab: string) {
  this.selectedTab = tab;

  if (tab === 'rfq') {
    setTimeout(() => this.applyRfqSorting()); // ensures ViewChild exists after *ngIf render
  }
}


  loadRfqData(): void {
  forkJoin({
    rfqs: this.rfqService.getRfqByProjectId(this.projectId),
    reqMap: this.buildRequestsSentLookup(this.projectId),
  }).subscribe({
    next: ({ rfqs, reqMap }: { rfqs: any[]; reqMap: Map<string, number> }) => {
      const infoRequests = rfqs.map((r) => this.rfqService.getWorkItemInfo(r.rfqID));

      forkJoin(infoRequests).subscribe((infoResults: any[]) => {
        const tableData = rfqs.map((item, index) => {
          const info = infoResults[index] || {};
          const rfqId = String(item.rfqID);

          return {
            id: item.rfqID,
            number: item.rfqNumber,
            customer: item.customerName || '—',
            rfqSentDate: item.sentDate ? this.formatDate(item.sentDate) : '-',
globalDueDate: this.formatDate(item.globalDueDate),
            // ✅ this is the “requestsSent” computed like your summary
            rfqSent: reqMap.get(rfqId) ?? 0,

            quoteReceived: item.quoteReceived || 0,
            quoteAmount: '-',
            workItem: info.workItem || '-',
            status: item.status || 'N/A',
          };
        });

        this.dataSource.data = tableData;
        this.dataSource.paginator = this.paginator;
        // this.dataSource.sort = this.sort;

        // this.dataSource.sortingDataAccessor = (row, property) => {
        //   switch (property) {
        //     case 'totalSubcontractors':
        //       return row.requestsSent || 0; // ✅ sort by requestsSent
        //     default:
        //       return (row as any)[property];
        //   }
        // };

        this.paginator.firstPage();
      });
    },
    error: () => {
      this.dataSource.data = [];
    },
  });
}

  deleteRfq(rfqId: string) {
    if (!confirm('Are you sure you want to delete this RFQ?')) return;

    this.rfqService.deleteRfq(rfqId).subscribe({
      next: () => {
        alert('RFQ deleted successfully.');
        this.dataSource.data = this.dataSource.data.filter((r: any) => r.id !== rfqId);
      },
      error: (err) => {
        alert(err?.error?.message || 'Unable to delete RFQ.');
      },
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB'); // dd/MM/yyyy
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = filterValue;
  }

  onAction(action: string, element: Rfq) {
    if (action === 'View') {
      alert(`Viewing RFQ: ${element.customerName}`);
    } else if (action === 'Download') {
      alert(`Downloading RFQ: ${element.customerName}`);
    }
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagedItems();
    }
  }

  onPageSizeChange() {
    this.currentPage = 1; // reset to first page
    this.totalPages = Math.ceil(this.filteredItems.length / this.pageSize) || 1;

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    this.updatePagedItems();
  }

  getFilteredRfqs(work: WorkItem) {
    const term = (work.searchText || '').trim().toLowerCase();
    let list = work.rfqs;
    if (term) {
      list = list.filter((r) =>
        `${r.name} ${r.rfqId} ${r.quote || ''}`.toLowerCase().includes(term),
      );
    }

    work.totalPages = Math.max(1, Math.ceil(list.length / (work.pageSize || 10)));
    if (!work.currentPage) work.currentPage = 1;
    if (work.currentPage > work.totalPages) work.currentPage = work.totalPages;

    const start = (work.currentPage - 1) * work.pageSize;
    const end = start + work.pageSize;
    work.currentStart = start + 1;
    work.currentEnd = Math.min(list.length, end);

    return list.slice(start, end);
  }

  updatePagedItems() {
    // If you want a flat paged list across all workItems
    const allRfqs = this.workItems.flatMap((w) => w.rfqs);
    this.totalPages = Math.max(1, Math.ceil(allRfqs.length / this.pageSize));

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.pagedItems = allRfqs.slice(start, end);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagedItems();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagedItems();
    }
  }

  enableEdit(item: any) {
    item.isEditingDueDate = true;
  }

  onDateChange(item: any, newDate: Date) {
    item.dueDate = newDate;
  }

  loadQuoteAmount(rfq: any) {
    if (!rfq.subcontractorId || !rfq.workItemId) {
      rfq.quoteAmount = '-';
      return;
    }

    this.rfqResponseService
      .getQuoteAmount(rfq.rfqId, rfq.subcontractorId, rfq.workItemId)
      .subscribe({
        next: (res: any) => {
          rfq.quoteAmount = res?.quoteAmount ?? '-';
        },
        error: (err) => {
          console.error('❌ Error fetching quote amount:', err);
          rfq.quoteAmount = '-';
        },
      });
  }
downloadQuote(event: Event, documentId: string | null | undefined) {
  event.stopPropagation();

  if (!documentId || documentId === 'null' || documentId === 'undefined') {
    alert('No file uploaded for this document.');
    return;
  }

  this.rfqResponseService.downloadQuote(documentId).subscribe({
    next: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Quote.pdf';
      a.click();
      URL.revokeObjectURL(url);
    },
    error: (err) => {
      console.error('Download error:', err);
      alert('No file uploaded for this document.');
    },
  });
}

  formatDateForApi(date: any): string {
    if (!date) return '';
    const d = new Date(date);
    const localISOTime = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
    return localISOTime;
  }

  addRfq() {
    this.router.navigate(['/add-rfq', this.projectId]);
  }

  editRfq(rfqId: string) {
    this.router.navigate(['/add-rfq', this.projectId, { rfqId: rfqId }]);
  }

private applyReminderConfig(dueDate: any, createdDate: any, config: any) {
  const normalize = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const parseDate = (input: any): Date | null => {
  if (!input && input !== 0) return null;
  if (typeof input === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(input)) {
    // "DD-MM-YYYY" → "YYYY-MM-DD"
    const [day, month, year] = input.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const d = input instanceof Date ? input : new Date(input);
  return isNaN(d.getTime()) ? null : d;
};

  const dueObj = parseDate(dueDate);
  const createdObj = parseDate(createdDate);
  console.log('[applyReminderConfig] raw input:', {
    dueDate, createdDate, dueObj, createdObj
  });

  if (!dueObj || !createdObj) {
    console.warn('[applyReminderConfig] Invalid due or created date:', { dueObj, createdObj });
    return false;
  }

  const due = normalize(dueObj);
  const created = normalize(createdObj);
  console.log('[applyReminderConfig] Normalized:', { due, created });

  const seqString = (config.reminderSequence ?? config.sequence ?? '').toString();
  const sequenceArray = seqString
    .split(',')
    .map((x: any) => parseInt((x || '').toString().trim(), 10))
    .filter((n: any) => !isNaN(n))
    .sort((a: any, b: any) => b - a);

  console.log('[applyReminderConfig] Sequence array:', sequenceArray);

  this.reminderDates = sequenceArray
    .map((seq: any) => {
      const d = new Date(due);
      d.setDate(d.getDate() + seq);
      const norm = normalize(d);
      console.log(`[applyReminderConfig] Offset ${seq}: ${norm.toISOString().slice(0, 10)}`);
      return norm;
    })
    .filter((d: any) => {
      const keep = d >= created && d < due;
      if (!keep) {
        console.log(`[applyReminderConfig] Removing date ${d.toISOString().slice(0, 10)} (outside valid range)`);
      }
      return keep;
    })
    .sort((a: any, b: any) => a.getTime() - b.getTime())
    .map((d: any) => d.toLocaleDateString('en-CA'));

  console.log('[applyReminderConfig] Final reminderDates:', this.reminderDates);

  this.customReminderDates = this.reminderDates.map((d) => new Date(d));
  this.reminderTime = config.reminderTime || '08:00';
  this.reminderEmailBody = config.reminderEmailBody || '';
  return true;
}

  // helper function
  formatDateForBackend(dateStr: string | Date): string | null {
    if (!dateStr) return null;

    if (dateStr instanceof Date) {
      return dateStr.toISOString().split('T')[0]; // "yyyy-MM-dd"
    }

    // If it's a string in "dd-MM-yyyy"
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-based
    const year = parseInt(parts[2], 10);

    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return null; // invalid date check

    return date.toISOString().split('T')[0];
  }

  showReminderPopup = false;
  reminderType: string = 'default';
  customReminderDates: (Date | null)[] = [];

  isDueDatePast = false;

  openReminderPopup(rfq: any) {
      console.log('[openReminderPopup] called', rfq);

    this.rfqCreatedDate = rfq.createdOn ?? rfq.createdDate ?? null; // use your actual field name

    //Check for due date past
    this.isDueDatePast = false; // reset first
    if (rfq.dueDate) {
      // Convert "DD-MM-YYYY" → Date
      const [day, month, year] = rfq.dueDate.split('-').map(Number);
      const dueDate = new Date(year, month - 1, day);

      // Normalize today's date (remove time)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      this.isDueDatePast = dueDate < today;
    } else {
      this.isDueDatePast = false;
    }

    this.reminderService.getGlobalReminderConfig().subscribe({
      next: (res) => {
        const config = Array.isArray(res) && res.length > 0 ? res[0] : null;
        if (!config) {
          this.snackBar.open('No reminder configuration found', 'Close', { duration: 3000 });
          return;
        }

        this.GlobalReminderConfig = JSON.parse(JSON.stringify(config));
        this.selectedRfqId = rfq.rfqId;
        this.subId = rfq.subcontractorId;

        this.dueDate = rfq.dueDate;

const ok = this.applyReminderConfig(this.dueDate, this.rfqCreatedDate, this.GlobalReminderConfig);        
if (!ok) {
          this.snackBar.open('Invalid due date', 'Close', { duration: 3000 });
          return;
        }

        this.setMaxDueDate(this.dueDate);
        this.reminderType = 'default';
        console.log('About to show popup');

        this.showReminderPopup = true;
      },
    });
  }

resetReminderPopup() {
  if (!this.GlobalReminderConfig || !this.dueDate || !this.rfqCreatedDate) return;

  this.applyReminderConfig(this.dueDate, this.rfqCreatedDate, this.GlobalReminderConfig);

  if (!this.reminderEmailBody || !this.reminderEmailBody.trim()) {
    this.emailBodyError = true;
  } else {
    this.emailBodyError = false;
  }
}


  closeReminderPopup() {
    this.showReminderPopup = false;
  }

  emailBodyError = false;

  //Delete this later
  sendReminder1() {
    // Email body validation
    if (!this.reminderEmailBody || !this.reminderEmailBody.trim()) {
      this.emailBodyError = true;
      return;
    }

    this.emailBodyError = false;

    if (!this.selectedRfqId || !this.subId) {
      alert('Missing RFQ or Subcontractor information.');
      return;
    }

    this.isLoading = true; //  Start loader

    this.rfqResponseService
      .sendReminder(this.subId, this.selectedRfqId, this.reminderEmailBody)
      .subscribe({
        next: (result) => {
          if (result.success) {
            this.snackBar.open('Reminder sent.', 'Close', { duration: 2000 });
            alert('Reminder sent.');
          } else {
            this.snackBar.open('Reminder sending failed.', 'Close', { duration: 2000 });
            alert('Reminder sending failed.');
          }
        },
        error: (error) => {
          alert('Failed to send reminder: ' + (error?.error || error));
        },
        complete: () => {
          this.isLoading = false;
          this.showReminderPopup = false;
        },
      });
  }

  formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`; // yyyy-MM-dd
  }

  sendReminder() {
    // Email body validation
    if (!this.reminderEmailBody || !this.reminderEmailBody.trim()) {
      this.emailBodyError = true;
      return;
    }

    this.emailBodyError = false;
    this.isLoading = true;

    // Decide reminderDates based on reminderType
    let reminderDatesToSend: string[] = [];

    if (this.reminderType === 'default') {
      reminderDatesToSend = this.reminderDates;
    } else if (this.reminderType === 'custom') {
      reminderDatesToSend = this.customReminderDates
        .filter((d): d is Date => d !== null)
        .map((d) => this.formatDateLocal(d));
    }

    const payload = {
      reminderType: this.reminderType,
      reminderDates: reminderDatesToSend,
      reminderTime: this.reminderTime,
      reminderEmailBody: this.reminderEmailBody,
      dueDate: this.dueDate ? this.formatDateForBackend(this.dueDate) : null,
      rfqId: this.selectedRfqId,
      subcontractorID: this.subId,
    };

    console.log('Reminder Payload:', payload);

    // Example API call
    this.rfqResponseService.rfqReminder(payload).subscribe({
      next: () => {
        this.isLoading = false;
        this.closeReminderPopup();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error sending reminder:', err);
      },
    });
  }

  // Remove a custom reminder date
  removeCustomDate(index: number) {
    if (this.customReminderDates.length === 1) {
      this.snackBar.open('At least one reminder date is required', 'Close', {
        duration: 2000,
      });
      return;
    }

    this.customReminderDates.splice(index, 1);
  }

  // Add a new custom reminder date
  addCustomDate() {
    this.customReminderDates.push(null);
  }

  //------------ Conversation -----------------
  showLogConvoPopup = false;
  conversationType: string = 'Email';
conversationDateTime: string | null = null;
  conversationSubject: string = '';
  conversationText: string = '';
  selectedSubId: string | null = null;
  conversationsData: any[] = [];
  pmSubConversationData: any[] = [];
  subject: string = '';
  messageText: string = '';
  attachments: File[] = [];

  // onFileSelected(event: Event) {
  //   const input = event.target as HTMLInputElement;

  //   if (!input.files || input.files.length === 0) return;

  //   for (let i = 0; i < input.files.length; i++) {
  //     this.attachments.push(input.files[i]);
  //   }

  //   // reset input so same file can be selected again
  //   input.value = '';
  // }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    // Check total files limit
    if (this.attachments.length + input.files.length > this.MAX_FILES) {
      alert(`You can attach a maximum of ${this.MAX_FILES} files per message.`);
      input.value = '';
      return;
    }

    for (const file of Array.from(input.files)) {
      if (file.size > this.MAX_FILE_SIZE) {
        //alert(`"${file.name}" exceeds the 10 MB limit.`);
        const message =
          input.files.length === 1
            ? 'The selected file exceeds the maximum allowed size of 10 MB.'
            : 'One or more selected files exceed the maximum allowed size of 10 MB.';

        alert(message);
        continue;
      }
      this.attachments.push(file);
    }

    // Reset input so same file can be selected again
    input.value = '';
  }

  removeFile(index: number) {
    this.attachments.splice(index, 1);
  }

  selectedSubcontractorId: string | null = null;
  selectedIndex: number = 0; // default first item active

  onSubClick(subId: string, index: number): void {
    if (this.selectedSubcontractorId === subId) return;

    this.selectedIndex = index;
    this.selectedSubcontractorId = subId;
    this.isSpinLoading = true;
    this.pmSubConversationData = [];
    this.loadConversationBySub(subId);
  }

  loadConversationSubcontractors(force = false) {
    // Prevent reload unless forced
    if (!force && this.convoSubcontractors.length > 0) {
      return;
    }
    this.isLoading = true;

    this.rfqResponseService.getSubcontractorsByLatestMessage(this.projectId).subscribe({
      next: (res: any[]) => {
        this.convoSubcontractors = res.map((item) => ({
          id: item.subcontractorID,
          name: item.subcontractorName,
        }));

        if (this.convoSubcontractors.length === 0) {
          this.isLoading = false;
          return;
        }

        // Preserve selected subcontractor if possible
        const existingIndex = this.selectedSubcontractorId
          ? this.convoSubcontractors.findIndex((s) => s.id === this.selectedSubcontractorId)
          : -1;

        if (existingIndex >= 0) {
          this.selectedIndex = existingIndex;
        } else {
          this.selectedIndex = 0;
          this.selectedSubcontractorId = this.convoSubcontractors[0].id;
        }

        this.isSpinLoading = true;
        this.loadConversationBySub(this.selectedSubcontractorId!);

        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading conversation subcontractors', err);
        this.isLoading = false;
      },
    });
  }

  filterConversations(): void {
    const search = this.conversationSearchText.trim().toLowerCase();

    if (!search) {
      this.pmSubConversationData = [...this.allPmSubConversationData];
      return;
    }

    this.pmSubConversationData = this.allPmSubConversationData.filter((convo) => {
      // Search in message text, subject, and sender type
      const textMatch =
        convo.messageText?.toLowerCase().includes(search) ||
        convo.subject?.toLowerCase().includes(search) ||
        convo.senderType?.toLowerCase().includes(search);

      // Search in attachment filenames
      const attachmentMatch = convo.convoattachments?.some((att: any) =>
        att.fileName?.toLowerCase().includes(search),
      );

      return textMatch || attachmentMatch;
    });
  }
  clearConversationSearch(): void {
    this.conversationSearchText = '';
    this.pmSubConversationData = [...this.allPmSubConversationData];
  }

  getWebPath(path: string): string {
    return path ? path.replace(/\\/g, '/') : '';
  }

  loadConversationBySub(subId: string): void {
    if (!subId) return;

    this.isSpinLoading = true;
    console.log('[LOAD] Loading conversation for Sub:', subId);

    this.projectService
      .getConversationByProjectAndSubcontractor(this.projectId, subId)
      .pipe(
        switchMap((initialConvos: any[]) => {
          console.log('[API-1] Initial Convos:', initialConvos);

          this.conversationsData = initialConvos ?? [];

          if (!initialConvos || initialConvos.length === 0) {
            console.warn('[API-1] No initial conversations found');
            this.pmSubConversationData = [];
            return of([]);
          }

          // 🔐 Build attachment lookup map
          const attachmentMap = new Map<string, any[]>();

          initialConvos.forEach((ic) => {
            const id = ic.conversationMessageID ?? ic.messageID;
            console.log('[MAP] IC ID:', id, 'Attachments:', ic.attachments);

            if (id) {
              attachmentMap.set(String(id), [...(ic.attachments ?? [])]);
            }
          });

          console.log('[MAP] Attachment Map Keys:', Array.from(attachmentMap.keys()));

          const draft = initialConvos[0];

          console.log('[API-2 CALL PARAMS]', {
            projectID: draft.projectID,
            rfqID: draft.rfqID,
            subcontractorID: draft.subcontractorID,
          });

          return this.projectService
            .getConversation(
              draft.projectID,
              draft.rfqID ?? '00000000-0000-0000-0000-000000000000',
              draft.subcontractorID,
            )
            .pipe(
              map((fullConvos: any[]) => {
                console.log('[API-2] Full Conversations:', fullConvos);
                console.log(
                  '[API-2] Full Convo IDs:',
                  fullConvos.map((fc) => fc.conversationMessageID),
                );

                // ✅ BUILD PARENT MESSAGE LOOKUP MAP
                const parentMap = new Map<string, any>();
                fullConvos.forEach((fc) => {
                  const id = fc.conversationMessageID ?? fc.messageID;
                  if (id) {
                    parentMap.set(String(id), fc);
                  }
                });

                return (fullConvos ?? []).map((fc) => {
                  const fcId = fc.conversationMessageID ?? fc.messageID;
                  const safeId = fcId ? String(fcId) : undefined;

                  const original = initialConvos.find((ic) => ic.conversationMessageID === safeId);

                  console.log('[MERGE]', {
                    safeId,
                    foundOriginal: !!original,
                    attachmentCount: original?.attachments?.length ?? 0,
                  });

                  const pmID =
                    fc.projectManagerID &&
                    fc.projectManagerID !== '00000000-0000-0000-0000-000000000000'
                      ? fc.projectManagerID
                      : undefined;

                  // ✅ MAP PARENT MESSAGE DATA
                  let parentData = {};
                  if (fc.subcontractorMessageID) {
                    const parent = parentMap.get(String(fc.subcontractorMessageID));

                    if (parent) {
                      console.log('[PARENT FOUND]', {
                        parentID: fc.subcontractorMessageID,
                        parentSender: parent.senderType,
                        parentDateTime: parent.messageDateTime,
                        parentText: parent.messageText?.substring(0, 50),
                      });

                      parentData = {
                        parentSenderName:
                          parent.senderType === 'PM'
                            ? 'Project Manager'
                            : parent.subcontractorName || 'Subcontractor',

                        // ✅ ONLY CHANGE: Use parseParentDate for reply message times
                        parentMessageDateTime: parent.messageDateTime
                          ? this.parseParentDate(parent.messageDateTime)
                          : undefined,

                        parentMessageText: parent.messageText || parent.message || '(No text)',
                      };
                    } else {
                      console.warn('[PARENT NOT FOUND]', fc.subcontractorMessageID);
                    }
                  }
                  return {
                    conversationMessageID: safeId,
                    subcontractorMessageID: fc.subcontractorMessageID ? String(fc.subcontractorMessageID) : undefined,

                    projectID: this.projectId,
                    rfqID: fc.rfqID ?? null,
                    workItemID: null,
                    subcontractorID: subId,

                    projectManagerID: pmID,
                    senderType: fc.senderType,
                    conversationType: fc.conversationType,
                    messageText: fc.messageText,
                    subject: fc.subject ?? null,

                    messageDateTime: fc.messageDateTime ? new Date(fc.messageDateTime) : undefined,

                    status: 'Active',
                    createdBy: null,
                    createdOn: null,

                    // ✅ FINAL attachment logic
                    convoattachments: original?.attachments?.length
                      ? [...original.attachments]
                      : [],

                    // ✅ ADD PARENT MESSAGE DATA
                    ...parentData,
                  };
                });
              }),
            );
        }),
        finalize(() => {
          console.log('[LOAD] Conversation loading completed');
          this.isSpinLoading = false;
        }),
      )
      .subscribe({
        next: (res: any[]) => {
          this.allPmSubConversationData = res ?? [];
          this.pmSubConversationData = [...this.allPmSubConversationData];

          console.log(
            '[FINAL RESULT]',
            this.pmSubConversationData.map((c) => ({
              id: c.conversationMessageID,
              parentID: c.subcontractorMessageID,
              parentSender: c.parentSenderName,
              parentDateTime: c.parentMessageDateTime,
              attachments: c.convoattachments?.length ?? 0,
            })),
          );

          setTimeout(() => this.scrollToBottom(), 0);
        },
        error: (err) => {
          this.isSpinLoading = false;
          console.error('[ERROR] Loading conversation failed:', err);
        },
      });
  }

  cleanMessage(message: string): string {
    if (!message) return '';

    // Remove common attachment patterns
    return message.replace(/image\s*\(\d+\)\.png/gi, '').trim();
  }

  trackByMessageId(index: number, convo: any): string {
    return convo.id;
  }
  setDefaultValues() {
    const now = new Date();
this.conversationDateTime = this.getAmsterdamDateTimeLocalString(new Date());
this.dateTimeTouched = true;
    this.conversationSubject = '';
    this.conversationType = 'Email';
  }

  openLogConvo() {
    this.setDefaultValues();

    if (!this.conversationsData?.length && this.pmSubConversationData?.length) {
      this.conversationsData = [...this.pmSubConversationData];
    }

    this.showLogConvoPopup = true;
  }

  closeLogConvo() {
    this.showLogConvoPopup = false;
    this.setDefaultValues();
    this.conversationType = 'Email';
    this.conversationSubject = '';
    this.conversationText = '';
  }

  resetLogConvo() {
    this.setDefaultValues();
    this.conversationType = 'Email';
    this.conversationSubject = '';
    this.conversationText = '';
  }

public getAmsterdamDateTimeLocalString(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';

  // Returns e.g. 2026-02-06T14:09
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

  getLocalTime(dateUtc: string | Date | null | undefined): string {
    if (!dateUtc) {
      return '';
    }

    try {
      let date: Date;

      if (typeof dateUtc === 'string') {
        // ✅ If no timezone info, assume UTC
        if (!dateUtc.includes('Z') && !dateUtc.includes('+') && !dateUtc.includes('-', 10)) {
          date = new Date(dateUtc + 'Z');
        } else {
          date = new Date(dateUtc);
        }
      } else {
        date = new Date(dateUtc);
      }

      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateUtc);
        return '';
      }

      // ✅ No timeZone parameter = uses user's local timezone
      return date.toLocaleString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('Date parsing error:', dateUtc, error);
      return '';
    }
  }
 saveLogConvo() {
    console.log("started");

    this.dateTimeError = '';
    this.notesError = '';

    if ((this.conversationText || '').length > 5000) {
        this.notesError = this.translate.instant('VALIDATION.TEXT_LIMIT');
        console.log("Blocked: text too long");
        return;
    }
    if (!this.conversationText?.trim()) {
        this.notesError = this.translate.instant('VALIDATION.NOTES_ERROR');
        console.log("Blocked: empty notes");
        return;
    }
    if (!this.dateTimeTouched) {
        this.dateTimeError = this.translate.instant('VALIDATION.DATE_TIME_REQUIRED');
        console.log("Blocked: date not touched");
        return;
    }

    const selectedDate = new Date(this.conversationDateTime!);
    const now = new Date();
    if (selectedDate > now) {
        this.dateTimeError = 'Communication date cannot be in the future.';
        console.log("Blocked: selected date in future");
        return;
    }
    if (this.isLoading) {
        console.log("Blocked: already loading");
        return;
    }
    if (!this.conversationsData?.length) {
        alert('No conversation data available.');
        console.log("Blocked: no conversation data");
        return;
    }

    this.isLoading = true;

    const draftConvo = this.conversationsData[0];

    // 🔹 Convert local → UTC
    const messageDateUtc = new Date(
      Date.UTC(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        selectedDate.getHours(),
        selectedDate.getMinutes(),
        selectedDate.getSeconds(),
        selectedDate.getMilliseconds(),
      ),
    );

    const payload: LogConversation = {
      projectID: draftConvo.projectID,
      rfqID: null,
      subcontractorID: draftConvo.subcontractorID,
      projectManagerID: draftConvo.projectManagerID,
      conversationType: this.conversationType || 'Email',
      subject: this.conversationSubject || '',
      message: this.conversationText,
      messageDateTime: messageDateUtc,
    };

    this.projectService
      .createLogConversation(payload)
      .pipe(
        switchMap((res) => {
          const localDate = res.messageDateTime ? new Date(res.messageDateTime) : new Date();

          this.pmSubConversationData.push({
            ...res,
            messageText: res.message,
            senderType: 'Subcontractor',
            messageDateTime: localDate,
          });

          setTimeout(() => this.scrollToBottom(), 0);
          return of(true);
        }),
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: () => {
          this.afterMessageSent();
          //alert('Conversation logged successfully!');
        },
        error: (err) => {
          console.error('Error saving conversation:', err);
          alert('Failed to save conversation. Please try again.');
        },
      });
  }

  private parseParentDate(dateInput: string | Date | null | undefined): Date | undefined {
    if (!dateInput) {
      return undefined;
    }

    try {
      if (dateInput instanceof Date) {
        return dateInput;
      }

      // Backend sends Amsterdam time as string (e.g., "2026-01-27T08:48:00")
      // We need to parse it as UTC to avoid timezone shift
      if (typeof dateInput === 'string') {
        const dateStr = dateInput.trim();

        // If no timezone indicator, treat as UTC (like your saveLogConvo does)
        if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.match(/-\d{2}:\d{2}$/)) {
          return new Date(dateStr + 'Z');
        }

        return new Date(dateStr);
      }

      return new Date(dateInput);
    } catch (error) {
      console.error('Error parsing parent date:', dateInput, error);
      return undefined;
    }
  }

  showInvalid = false;
  sendMessage() {
    // Trim inputs
    const subjectTrimmed = this.subject?.trim();
    const messageTrimmed = this.messageText?.trim();

    // ✅ Validate empty inputs
    if (!subjectTrimmed || !messageTrimmed) {
      this.showInvalid = true; // keeps your current CSS logic
      return;
    } else {
      this.showInvalid = false;
    }

    // ✅ Validate message length
    if (messageTrimmed.length > 5000) {
      alert('Message is too long. Please shorten your message.');
      return;
    }

    if (!this.conversationsData?.length) {
      alert('No conversation data available.');
      return;
    }

    this.isLoading = true;
    const draftConvo = this.conversationsData[0];

    const payload: RFQConversationMessage = {
      projectID: draftConvo.projectID,
      subcontractorID: draftConvo.subcontractorID,
      senderType: 'PM',
      messageText: this.messageText,
      subject: this.subject || '',
      createdBy: draftConvo.createdBy,
    };

    this.projectService
      .addRfqConversationMessage(payload)
      .pipe(
        switchMap((res: RFQConversationMessage): Observable<UploadResult> => {
          if (!res.conversationMessageID) {
            throw new Error('ConversationMessageID missing');
          }

          // Clone attachments
          const filesToUpload = [...this.attachments];

          this.pmSubConversationData.push({
            ...res,
            senderType: 'PM',
            messageDateTime: new Date(res.messageDateTime || new Date()),
          });

          this.pmSubConversationData.sort(
            (a, b) => new Date(a.messageDateTime).getTime() - new Date(b.messageDateTime).getTime(),
          );

          return this.projectService
            .uploadAttachmentFiles(res.conversationMessageID, filesToUpload)
            .pipe(
              map((paths: string[]) => ({
                res,
                paths,
              })),
            );
        }),
        switchMap(({ res, paths }) =>
          this.projectService.sendMail({
            subcontractorID: draftConvo.subcontractorID,
            projectID: draftConvo.projectID,
            subject: this.subject,
            body: this.messageText,
            attachmentFilePaths: paths,
          }),
        ),
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: () => {
          this.messageText = '';
          this.subject = '';
          this.attachments = [];
          this.afterMessageSent();
          alert('Conversation logged successfully!');
        },
        error: (err) => {
          console.error('Error sending message:', err);
          alert('Failed to save conversation. Please try again.');
        },
      });
  }

  onInputChange(): void {
    //this.showInvalid = !this.subject?.trim() || !this.messageText?.trim();
    this.showInvalid = false;
  }

  startReply(convo: RFQConversationMessage) {
    console.log('▶ startReply clicked');
    console.log('Convo object received:', convo);

    if (!convo.conversationMessageID) {
      console.error('❌ conversationMessageID is undefined or null', 'Full convo:', convo);
      return;
    }

    console.log('✅ conversationMessageID:', convo.conversationMessageID);

    this.replyingToMessageId = convo.conversationMessageID;
    console.log('replyingToMessageId set to:', this.replyingToMessageId);

    this.replyTexts[convo.conversationMessageID] = '';
    console.log('replyTexts initialized:', this.replyTexts);

    this.replyAttachments = [];
    console.log('replyAttachments reset');

    this.replySubject = 'Re: ' + (convo.subject || '');
    console.log('replySubject set to:', this.replySubject);

    this.replyError = '';
  }

  // Helper method for reset, close, reload
  private afterMessageSent(): void {
    // Reload list and keep active subcontractor
    this.loadConversationSubcontractors(true);
    this.closeLogConvo();
    this.resetLogConvo();
  }

  cancelReply() {
    if (this.replyingToMessageId) {
      delete this.replyTexts[this.replyingToMessageId];
      this.replyingToMessageId = null;
      this.replyAttachments = [];
      this.replyError = '';
    }
  }

  getReplyText(id: string): string {
    return this.replyTexts[id] ?? '';
  }

  setReplyText(id: string, text: string) {
    this.replyTexts[id] = text;
  }

  onReplyFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    // Check total files limit
    if (this.replyAttachments.length + input.files.length > this.MAX_FILES) {
      alert(`You can attach a maximum of ${this.MAX_FILES} files per message.`);
      input.value = '';
      return;
    }

    for (const file of Array.from(input.files)) {
      if (file.size > this.MAX_FILE_SIZE) {
        //alert(`"${file.name}" exceeds the 10 MB limit.`);
        const message =
          input.files.length === 1
            ? 'The selected file exceeds the maximum allowed size of 10 MB.'
            : 'One or more selected files exceed the maximum allowed size of 10 MB.';

        alert(message);
        continue;
      }
      this.replyAttachments.push(file);
    }

    input.value = '';
  }

  removeReplyFile(index: number) {
    this.replyAttachments.splice(index, 1);
  }

  sendReply(convo: RFQConversationMessage) {
    const parentId = convo.conversationMessageID;
    const replyText = this.replyTexts[parentId!] ?? '';

    if (!replyText.trim()) {
      this.replyError = this.translate.instant('VALIDATION.REPLY_ERROR');
      return;
    }
if (replyText.length > 5000) {
  this.replyCharError[String(parentId)] = true;
  return;
}
    this.isSendingReply = true;
    this.replyError = '';

    const formData = new FormData();
    formData.append('subcontractorMessageID', String(parentId));
    formData.append('message', replyText);
    formData.append('subject', this.replySubject);

    this.replyAttachments.forEach((file) => formData.append('attachments', file));

    this.rfqService
      .replyToConversation(formData)
      .pipe(
        finalize(() => {
          // ONLY stop loader here
          this.isSendingReply = false;
        }),
      )
      .subscribe({
        next: (reply: any) => {
          // ✅ SUCCESS → API returned 200
          // alert('Reply sent successfully!');

          if (!reply) {
            // Handles rare 204 safely (no UI update)
            window.location.reload();
            return;
          }

          const normalizedReply: RFQConversationMessage = {
            conversationMessageID: String(reply.conversationMessageID ?? reply.messageID),
            subcontractorMessageID: String(parentId),
            projectID: reply.projectID,
            subcontractorID: reply.subcontractorID,
            senderType: reply.senderType,
            messageText: reply.messageText,
            subject: reply.subject,

            messageDateTime: reply.messageDateTime ? new Date(reply.messageDateTime) : new Date(),
            status: reply.status,
            createdBy: reply.createdBy,
            createdOn: reply.createdOn,
          };

          const index = this.pmSubConversationData.findIndex(
            (m) => String(m.conversationMessageID) === String(parentId),
          );

          if (index === -1) {
            this.pmSubConversationData.push(normalizedReply);
          } else {
            this.pmSubConversationData.splice(index + 1, 0, normalizedReply);
          }

          this.cancelReply();
          window.location.reload();
        },
        error: (err) => {
          console.error('❌ Error sending reply:', err);
          this.replyError = 'Email failed. Reply saved as draft.';
        },
      });
  }

  getParentMessage(parentId: any) {
    if (parentId === null || parentId === undefined || parentId === '') {
      return undefined;
    }

    const pid = String(parentId);

    return (this.pmSubConversationData || []).find(
      (m: any) => String(m.conversationMessageID) === pid,
    );
  }
}
