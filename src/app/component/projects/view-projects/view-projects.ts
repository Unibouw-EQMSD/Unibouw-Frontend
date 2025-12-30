import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
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
  projectID: string;
  rfqID: string;
  workItemID?: string | null;
  subcontractorID: string;
  projectManagerID?: string;
  senderType: 'PM' | 'Subcontractor';
  messageText: string;
  subject?: string;
  messageDateTime?: Date;
  status?: string;
  createdBy: string;
  createdOn?: Date;
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
  displayedColumns: string[] = [
    'workitem',
    'rfqSentDate',
    'dueDate',
    'totalSubcontractors',
    'quoteRecieved',
    'status',
    'actions',
  ];
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
  convoSubcontractors: { id: string; name: string }[] = [];

  setMaxDueDate(due: Date | string) {
    if (typeof due === 'string') {
      // assume format is "DD-MM-YYYY"
      const [day, month, year] = due.split('-').map(Number);
      this.maxDate = new Date(year, month - 1, day);
    } else {
      // it's already a Date
      this.maxDate = new Date(due); // clone to avoid reference issues
    }
  }

  @ViewChild(MatPaginator)
  set paginator(p: MatPaginator) {
    if (p) {
      this.dataSource.paginator = p;
      p.firstPage();
    }
  }
  @ViewChild(MatSort)
  set sort(s: MatSort) {
    if (s) {
      this.dataSource.sort = s;

      // Map displayed column names to actual properties
      this.dataSource.sortingDataAccessor = (row, column) => {
        switch (column) {
          case 'workitem':
            return row.workItem;
          case 'rfqSentDate':
            return row.rfqSentDate;
          case 'dueDate':
            return row.dueDate;
          case 'totalSubcontractors':
            return row.subcontractorCount;
          case 'quoteRecieved':
            return row.quoteReceived;
          case 'status':
            return row.status;
          default:
            return '';
        }
      };
    }
  }
  workItems: WorkItem[] = [];

  constructor(
    private rfqService: RfqService,
    private router: Router,
    private rfqResponseService: RfqResponseService,
    private cdr: ChangeDetectorRef,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private projectService: projectService,
    private reminderService: ReminderService,
    private location: Location
  ) {
    registerLocaleData(localeNl);
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['tab'] === 'rfq') {
        this.selectedTab = 'rfq';
        this.loadRfqData(); // reload table
      }
    });

    // Capture the project ID from the route
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
    if (this.projectId) {
      this.loadRfqData();
      this.loadProjectDetails(this.projectId);
      this.loadRfqResponseSummary(this.projectId);
    }
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;

    // Full sorting for all columns
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'workitem':
          return item.workItem?.toLowerCase() || '';
        case 'rfqSentDate':
          return item.rfqSentDate ? new Date(item.rfqSentDate) : new Date(0);
        case 'dueDate':
          return item.dueDate ? new Date(item.dueDate) : new Date(0);
        case 'totalSubcontractors':
          return item.subcontractorCount || 0;
        case 'quoteRecieved':
          return item.quoteReceived || 0;
        case 'status':
          return item.status?.toLowerCase() || '';
        default:
          return '';
      }
    };
  }
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

  reminderType: string = 'default';

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
  loadRfqResponseSummary(projectId: string) {
    /* ===============================
     1️⃣ WORK ITEM GROUPED (FIXED)
     =============================== */

    this.rfqResponseService.getResponsesByProjectId(projectId).subscribe({
      next: (res: any[]) => {
        const workItemMap = new Map<string, any>();

        res.forEach((w) => {
          // 🔹 Create work item ONCE
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

              // counters
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

          // 🔹 Push RFQs (flattened from API response)
          w.subcontractors.forEach((s: any) => {
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
              dueDate: s.dueDate,
              actions: ['pdf', 'chat'],
            });
          });

          // 🔹 Recalculate counters
          workItem.requestsSent = workItem.rfqs.length;
          workItem.notResponded = workItem.rfqs.filter((r: any) => !r.responded).length;
          workItem.interested = workItem.rfqs.filter((r: any) => r.interested).length;
          workItem.notInterested = workItem.rfqs.filter((r: any) => r.notInterested).length;
          workItem.viewed = workItem.rfqs.filter((r: any) => r.viewed).length;
          workItem.maybeLater = workItem.rfqs.filter((r: any) => r.maybeLater).length;
        });

        // 🔹 Final array (ONE accordion per work item)
        this.workItems = Array.from(workItemMap.values());

        // 🔹 Load quote amounts
        this.workItems.forEach((work) => {
          work.rfqs.forEach((rfq: any) => this.loadQuoteAmount(rfq));
        });
      },

      error: (err) => {
        console.error('Error loading work item responses', err);
      },
    });

    /* ===============================
     2️⃣ SUBCONTRACTOR GROUPED (UNCHANGED ✅)
     =============================== */

    this.rfqResponseService.getResponsesByProjectSubcontractors(projectId).subscribe({
      next: (res: any[]) => {
        const grouped = res.reduce((acc: any[], item: any) => {
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
            workItemId: item.workItemId,
            workItemName: item.workItemName,
            rfqId: item.rfqId,
            documentId: item.documentId,
            rfqNumber: item.rfqNumber,
            date: item.date,
            responded: item.responded,
            interested: item.interested,
            notInterested: item.notInterested,
            viewed: item.viewed,
            maybeLater: item.maybeLater,
            subcontractorId: item.subcontractorId,
            rating: 0,
            quoteAmount: '-',
            actions: ['pdf'],
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

        this.subcontractorGroups.forEach((sub) => {
          sub.workItems.forEach((w: any) => this.loadQuoteAmount(w));
        });
      },
      error: (err) => {
        console.error('Error loading subcontractor responses', err);
      },
    });
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

  // In your component
  onDatepickerOpened() {
    document.body.style.overflow = 'hidden';
  }
  onDatepickerClosed() {
    document.body.style.overflow = '';
  }

  markViewed(rfq: any, parent: any) {
    if (rfq.viewed) return;

    this.rfqResponseService
      .markAsViewed(
        rfq.rfqId,
        rfq.subcontractorId,
        rfq.workItemId // 🔥 correct source
      )
      .subscribe({
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
        'Maybe Later' // important: persist "Maybe Later" not only "Viewed"
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

  loadRfqData(): void {
    this.rfqService.getRfqByProjectId(this.projectId).subscribe({
      next: (rfqs: any[]) => {
        const infoRequests = rfqs.map((r) => this.rfqService.getWorkItemInfo(r.rfqID));

        forkJoin(infoRequests).subscribe((infoResults: any[]) => {
          const tableData = rfqs.map((item, index) => {
            const info = infoResults[index] || {};

            return {
              id: item.rfqID,
              customer: item.customerName || '—',
              rfqSentDate: this.formatDate(item.sentDate),
              dueDate: this.formatDate(item.dueDate),
              rfqSent: item.rfqSent || 0,
              quoteReceived: item.quoteReceived || 0,
              quoteAmount: '-',
              workItem: info.workItem || '-',
              subcontractorCount: info.subcontractorCount ?? 0,
              status: item.status || 'N/A',
            };
          });

          // Assign data
          this.dataSource.data = tableData;

          // Assign paginator and sort immediately after data assignment
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;

          // Custom sorting for all columns
          this.dataSource.sortingDataAccessor = (item, property) => {
            switch (property) {
              case 'workitem':
                return item.workItem?.toLowerCase() || '';
              case 'rfqSentDate':
                return item.rfqSentDate ? new Date(item.rfqSentDate) : new Date(0);
              case 'dueDate':
                return item.dueDate ? new Date(item.dueDate) : new Date(0);
              case 'totalSubcontractors':
                return item.subcontractorCount || 0;
              case 'quoteRecieved':
                return item.quoteReceived || 0;
              case 'status':
                return item.status?.toLowerCase() || '';
              default:
                return '';
            }
          };

          // Optional: reset paginator
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
        `${r.name} ${r.rfqId} ${r.quote || ''}`.toLowerCase().includes(term)
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
  downloadQuote(event: Event, documentId: string) {
    event.stopPropagation();

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

  private applyReminderConfig(dueDate: any, config: any) {
    // Helper normalize
    const normalize = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    // Robust date parser
    const parseDate = (input: any): Date | null => {
      if (!input && input !== 0) return null;

      if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

      if (typeof input === 'number') {
        const d = new Date(input);
        return isNaN(d.getTime()) ? null : d;
      }

      if (typeof input === 'string') {
        const trimmed = input.trim();

        // ISO YYYY-MM-DD
        const iso = trimmed.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})$/);
        if (iso) {
          const dt = new Date(trimmed);
          if (!isNaN(dt.getTime())) return dt;
        }

        // dd-mm-yyyy
        const dmy = trimmed.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
        if (dmy) {
          const day = +dmy[1];
          const month = +dmy[2] - 1;
          const year = +dmy[3];
          const dt = new Date(year, month, day);
          if (!isNaN(dt.getTime())) return dt;
        }

        const fallback = new Date(trimmed);
        if (!isNaN(fallback.getTime())) return fallback;
      }

      return null;
    };

    // Parse due date
    const dueObj = parseDate(dueDate);
    if (!dueObj) return false;

    const due = normalize(dueObj);
    const today = normalize(new Date());

    // Extract sequence
    const seqString = (config.reminderSequence ?? config.sequence ?? '').toString();

    const sequenceArray = seqString
      .split(',')
      .map((x: any) => parseInt((x || '').toString().trim(), 10))
      .filter((n: any) => !isNaN(n))
      .sort((a: any, b: any) => b - a);

    // Build reminder dates
    this.reminderDates = sequenceArray
      .map((seq: any) => {
        const d = new Date(due);
        d.setDate(d.getDate() + seq);
        return normalize(d);
      })
      .filter((d: any) => d >= today)
      .sort((a: any, b: any) => a.getTime() - b.getTime())
      .map((d: any) => d.toLocaleDateString('en-CA'));

    // Custom dates start same as default
    this.customReminderDates = this.reminderDates.map((d) => new Date(d));

    // Restore time & email body
    this.reminderTime = config.reminderTime || '08:00';
    this.reminderEmailBody = config.reminderEmailBody || '';

    return true;
  }

  showReminderPopup = false;
  customReminderDates: (Date | null)[] = [];

  openReminderPopup(rfq: any) {
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

        const ok = this.applyReminderConfig(this.dueDate, this.GlobalReminderConfig);
        if (!ok) {
          this.snackBar.open('Invalid due date', 'Close', { duration: 3000 });
          return;
        }

        this.setMaxDueDate(this.dueDate);
        this.reminderType = 'default';
        this.showReminderPopup = true;
      },
    });
  }

  resetReminderPopup() {
    if (!this.GlobalReminderConfig || !this.dueDate) return;

    // this.reminderType = "default";
    this.applyReminderConfig(this.dueDate, this.GlobalReminderConfig);
  }

  closeReminderPopup() {
    this.showReminderPopup = false;
  }

  private _reminderDates: string[] = [];

  get reminderDates1(): string[] {
    return this._reminderDates;
  }

  set reminderDates1(dates: string[]) {
    this._reminderDates = dates;
    if (this.showReminderPopup && dates && dates.length > 0) {
      // ⏳ Trigger after a delay (example 5 sec)
      setTimeout(() => {
        this.sendReminder();
      }, 60000);
    }
  }

  sendReminder() {
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
  conversationDateTime: Date | null = null;
  conversationSubject: string = '';
  conversationText: string = '';
  selectedSubId: string | null = null;
  conversationsData: any[] = [];
  pmSubConversationData: any[] = [];
  subject: string = '';
  messageText: string = '';
  attachments: File[] = [];

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) return;

    for (let i = 0; i < input.files.length; i++) {
      this.attachments.push(input.files[i]);
    }

    // reset input so same file can be selected again
    input.value = '';
  }

  removeFile(index: number) {
    this.attachments.splice(index, 1);
  }

  selectedSubcontractorId: string | null = null;
  selectedIndex: number = 0; // default first item active

  // onSubClick(subId: string, index: number): void {
  //   this.selectedIndex = index;
  //   // show spinner
  //   this.isSpinLoading = true;
  //   // clear old messages
  //   this.pmSubConversationData = [];
  //   // load new conversation
  //   this.loadConversationBySub(subId);

  //   // hide spinner after .4 seconds
  //   setTimeout(() => {
  //     this.isSpinLoading = false;
  //   }, 400);
  // }

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

        // 🔥 Preserve selected subcontractor if possible
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

        // Auto-select first subcontractor & load its conversation
        // if (this.convoSubcontractors.length > 0) {
        //   this.isSpinLoading = true;
        //   this.selectedSubcontractorId = this.convoSubcontractors[0].id;
        //   this.loadConversationBySub(this.selectedSubcontractorId);
        // }

        // Keep selected subcontractor if possible
        // const stillExists = this.convoSubcontractors.find(
        //   (s) => s.id === this.selectedSubcontractorId
        // );

        // if (!stillExists && this.convoSubcontractors.length > 0) {
        //   this.selectedSubcontractorId = this.convoSubcontractors[0].id;
        // }

        // if (this.selectedSubcontractorId) {
        //   this.isSpinLoading = true;
        //   this.loadConversationBySub(this.selectedSubcontractorId);
        // }

        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading conversation subcontractors', err);
        this.isLoading = false;
      },
    });
  }

  loadConversationBySub(subId: string): void {
    if (!subId) {
      this.isSpinLoading = false;
      return;
    }

    this.projectService
      .getConversationByProjectAndSubcontractor(this.projectId, subId)
      .pipe(
        switchMap((res: any[]) => {
          this.conversationsData = res;

          if (!res || res.length === 0) {
            this.pmSubConversationData = [];
            return of([]);
          }

          const draft = res[0];
          return this.projectService.getConversation(
            draft.projectID,
            draft.rfqID,
            draft.subcontractorID
          );
        }),
        finalize(() => (this.isSpinLoading = false))
      )
      .subscribe({
        next: (res) => (this.pmSubConversationData = res),
        error: (err) => {
          console.error('■ Error loading conversation:', err);
          this.isSpinLoading = false;
        },
      });
  }

  setDefaultValues() {
    const now = new Date();
    this.conversationDateTime = new Date();
    this.conversationSubject = '';
    this.conversationType = 'Email';
  }

  openLogConvo() {
    this.setDefaultValues();
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

  saveLogConvo() {
    if (!this.conversationText?.trim() || this.isLoading) return;

    if (!this.conversationsData?.length) {
      alert('No conversation data available.');
      return;
    }

    this.isLoading = true;

    const draftConvo = this.conversationsData[0];

    const payload: LogConversation = {
      projectID: draftConvo.projectID,
      //rfqID: draftConvo.rfqID,
      rfqID: null,
      subcontractorID: draftConvo.subcontractorID,
      projectManagerID: draftConvo.projectManagerID,
      conversationType: this.conversationType || 'Email',
      subject: this.conversationSubject || '',
      message: this.conversationText,
      messageDateTime: this.conversationDateTime ?? new Date(),
    };

    this.projectService
      .createLogConversation(payload)
      .pipe(
        switchMap((res) => {
          this.pmSubConversationData.push({
            ...res,
            messageText: res.message,
            senderType: 'Subcontractor',
            messageDateTime: res.messageDateTime,
          });

          this.pmSubConversationData.sort(
            (a, b) => new Date(a.messageDateTime).getTime() - new Date(b.messageDateTime).getTime()
          );

          // If later you want to send mail, plug it here
          // return this.projectService.sendMail({...});

          return of(true);
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: () => {
          this.afterMessageSent();
          alert('Conversation logged successfully!');
        },
        error: (err) => {
          console.error('Error saving conversation:', err);
          alert('Failed to save conversation. Please try again.');
        },
      });
  }

  sendMessage() {
    if (!this.messageText?.trim() && !this.subject?.trim()) return;

    if (!this.conversationsData?.length) {
      alert('No conversation data available.');
      return;
    }

    this.isLoading = true;

    const draftConvo = this.conversationsData[0];

    const payload: RFQConversationMessage = {
      projectID: draftConvo.projectID,
      rfqID: draftConvo.rfqID,
      workItemID: null,
      subcontractorID: draftConvo.subcontractorID,
      senderType: 'PM',
      messageText: this.messageText,
      subject: this.subject || '',
      createdBy: draftConvo.createdBy,
    };

    this.projectService
      .addRfqConversationMessage(payload)
      .pipe(
        // ⭐ FIX: Explicit return type
        switchMap((res: RFQConversationMessage): Observable<UploadResult> => {
          if (!res.conversationMessageID) {
            throw new Error('ConversationMessageID missing');
          }

          // ✅ IMPORTANT: clone attachments to avoid async clearing
          const filesToUpload = [...this.attachments];

          this.pmSubConversationData.push({
            ...res,
            senderType: 'PM',
            messageDateTime: new Date(res.messageDateTime || new Date()),
          });

          this.pmSubConversationData.sort(
            (a, b) => new Date(a.messageDateTime).getTime() - new Date(b.messageDateTime).getTime()
          );

          return this.projectService
            .uploadAttachmentFiles(res.conversationMessageID, filesToUpload)
            .pipe(
              map((paths: string[]) => ({
                res,
                paths,
              }))
            );
        }),

        switchMap(({ res, paths }) =>
          this.projectService.sendMail({
            subcontractorID: draftConvo.subcontractorID,
            subject: this.subject,
            body: this.messageText,
            attachmentFilePaths: paths,
          })
        ),

        finalize(() => {
          this.isLoading = false;
        })
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

  // Helper method for reset, close, reload
  private afterMessageSent(): void {
    // Reload list and keep active subcontractor
    this.loadConversationSubcontractors(true);
    this.closeLogConvo();
    this.resetLogConvo();
  }
}
