import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectorRef, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { catchError, finalize, firstValueFrom, forkJoin, lastValueFrom, map, Observable, ObservableInput, throwError, timeout } from 'rxjs';
import { Subcontractors, SubcontractorService } from '../../../services/subcontractor.service';
import { Workitem, WorkitemCategory, WorkitemService } from '../../../services/workitem.service';
import { Rfq, RfqService } from '../../../services/rfq.service';
import { projectdetails, projectService } from '../../../services/project.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../confirm-dialog-component/confirm-dialog-component';
import { Location } from '@angular/common';
import { AlertService } from '../../../services/alert.service';
import { TranslateService } from '@ngx-translate/core';
import { MatTableDataSource } from '@angular/material/table';

interface SubcontractorItem {
  subcontractorID: string;
  name: string;
  selected?: boolean;
    location?: string; 
  dueDate?: string;
  category?: string;
  personName?: string;
  phoneNumber1?: string;
  email?: string;
  linkedWorkItemIDs?: string[];
}

@Component({
  selector: 'app-rfq-add',
  standalone: false,
  templateUrl: './rfq-add.html',
  styleUrl: './rfq-add.css',
})
export class RfqAdd {
  projects: any[] = [];
  selectedProject: string = '';
  selectedTab: 'standard' | 'unibouw' | 'uploaded' = 'unibouw';
  globalDueDate: any = '';
  uploadedWorkitems: Workitem[] = [];
  dataSourceWorkitems = new MatTableDataSource<any>();
dataSourceSubcontractors = new MatTableDataSource<any>();
  searchWorkitem: string = '';
searchSubcontractor: string = '';
  uploadedFiles: {
    name: string;
    selected: boolean;
    file?: File;
    source: 'new' | 'project';
    projectDocumentID?: string;
    saving?: boolean;
    saved?: boolean;
    saveError?: boolean;
  }[] = [];
  createdDate: Date = new Date();
  selectedDueDate: string = '';
  standardWorkitems: Workitem[] = [];
  unibouwWorkitems: Workitem[] = [];
  selectedWorkItems: Workitem[] = [];
  subcontractors: SubcontractorItem[] = [];
  showPreview = false;
  previewData: any = null;
  noSubMessage: string = '';
  editedEmailBody: string = '';
  showAll: boolean = false;
  customNote: string = '';
  projectId!: string;
  projectDetails: any;
  rfqIdForEdit: string | null = null;
    selectionsByCategory = new Map<string, Workitem[]>(); // preserve selections per category

  originalRfq: any = null;
  rfqNumber: string = 'N/A';
  createdDateDisplay: string = 'N/A';
  workItemName: string = 'N/A';
  globalDateError = false;
  private lastScrollTop = 0;
  originalRfqSubcontractors: any[] = [];
  projectDocuments: { projectDocumentID: string; fileName: string; selected: boolean }[] = [];
  private skipDraftSave = false;
  originalSubcontractorState: {
    subcontractorID: string;
    dueDate?: string;
    selected: boolean;
    
  }[] = [];
  isLoader: boolean = false;
  allSubcontractors: SubcontractorItem[] = [];
  minDate: string = '';
  private subcontractorsByWorkItem = new Map<string, SubcontractorItem[]>();
private mappingsCache: any[] = [];
private subcontractorsCache: SubcontractorItem[] = [];
  constructor(
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private workitemService: WorkitemService,
    private subcontractorService: SubcontractorService,
    private rfqService: RfqService,
    private http: HttpClient,
    private projectService: projectService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private location: Location,
    private alertService: AlertService,
  ) {}

  getDraftKey(): string {
    return this.rfqIdForEdit ? `rfq_edit_state_${this.rfqIdForEdit}` : 'rfq_add_state';
  }
private baseSelectedSubcontractorIds = new Set<string>();
  public saveDraft() {
    if (this.skipDraftSave) return;
    localStorage.setItem(
      this.getDraftKey(),
      JSON.stringify({
        selectedTab: this.selectedTab,
        globalDueDate: this.globalDueDate,
        selectedWorkItems: this.selectedWorkItems.map((w) => w.workItemID),
        subcontractors: this.subcontractors.map((s) => ({
          subcontractorID: s.subcontractorID,
          selected: s.selected,
          dueDate: s.dueDate,
        })),
        uploadedFiles: this.uploadedFiles.map(f => ({ name: f.name, selected: f.selected })),
editedEmailBody: this.editedEmailBody?.trim() ? this.editedEmailBody : null      }),
    );
  }

onTabChange(tab: 'standard' | 'unibouw' | 'uploaded') {
  this.selectedTab = tab;

  // clear search + reset datasource
  this.searchWorkitem = '';
  this.updateWorkitemDatasource();

  // optional: also clear subcontractor search if you want
  // this.searchSubcontractor = '';
  // this.applySubcontractorFilter();
}

private saveScrollPosition() {
  const el = document.scrollingElement || document.documentElement;
  this.lastScrollTop = el.scrollTop || 0;
}

private restoreScrollPosition() {
  setTimeout(() => {
    const el = document.scrollingElement || document.documentElement;
    el.scrollTop = this.lastScrollTop || 0;
  }, 0);
}

applyWorkitemFilter() {
  const value = (this.searchWorkitem || '').trim().toLowerCase();

  let source: any[] = [];
  if (this.selectedTab === 'standard') source = this.standardWorkitems;
  else if (this.selectedTab === 'unibouw') source = this.unibouwWorkitems;
  else source = this.uploadedWorkitems;

  this.dataSourceWorkitems.data = source.filter(item =>
    (item.name || '').toLowerCase().includes(value) ||
    (item.number || '').toLowerCase().includes(value)
  );
}

// 🔍 Subcontractor filter
private searchTimeout: any;

applySubcontractorFilter() {
  clearTimeout(this.searchTimeout);

  this.searchTimeout = setTimeout(() => {
    const value = this.searchSubcontractor.trim().toLowerCase();

    this.dataSourceSubcontractors.data = this.subcontractors.filter(sub =>
      sub.name.toLowerCase().includes(value) ||
      (sub.location || '').toLowerCase().includes(value)
    );
  }, 300);
}

trackBySubId(index: number, item: any) {
  return item.subcontractorID;
}

onSaveDraftClick() {
  this.saveDraft();   // 🔥 manually store draft
  this.onSubmit(false); // existing logic
}

private async restoreDraft(): Promise<void> {
  const key = this.getDraftKey();
  let saved = localStorage.getItem(key);

  // migrate add -> edit if needed
  if (!saved && this.rfqIdForEdit) {
    const addDraft = localStorage.getItem('rfq_add_state');
    if (addDraft) {
      localStorage.setItem(key, addDraft);
      localStorage.removeItem('rfq_add_state');
      saved = addDraft;
    }
  }

  if (!saved) return;

  const state = JSON.parse(saved);

  this.selectedTab = state.selectedTab ?? this.selectedTab;
  this.globalDueDate = state.globalDueDate ?? '';

  if (state.editedEmailBody && state.editedEmailBody.trim() !== '') {
    this.editedEmailBody = state.editedEmailBody;
  }

  if (state.uploadedFiles) {
    // keep only name/selected from draft; keep current objects if you prefer
    this.uploadedFiles = state.uploadedFiles;
  }

  const allWorkItems = [
    ...this.standardWorkitems,
    ...this.unibouwWorkitems,
    ...this.uploadedWorkitems,
  ];

  this.selectedWorkItems = allWorkItems.filter(w =>
    (state.selectedWorkItems || []).includes(w.workItemID)
  );

  // ✅ rebuild subcontractors for ALL selected workitems using mappings
  await this.loadSubcontractorsForSelectedWorkitemsFromMappings();

  // ✅ restore checked + dueDate from draft onto rebuilt list
  const savedSubMap = new Map<string, any>(
    (state.subcontractors || []).map((s: any) => [this.normalizeId(s.subcontractorID), s])
  );

  this.subcontractors.forEach(sub => {
    const savedSub = savedSubMap.get(this.normalizeId(sub.subcontractorID));
    if (savedSub) {
      sub.selected = !!savedSub.selected;
      sub.dueDate = savedSub.dueDate || '';
    }
  });

this.dataSourceSubcontractors.data = this.subcontractors;
  this.cdr.detectChanges();
}

private async loadSubcontractorsForSelectedWorkitemsFromMappings(): Promise<void> {
  if (!this.selectedWorkItems.length) {
    this.subcontractors = [];
    this.dataSourceSubcontractors.data = [];
    return;
  }

  try {
    const { mappings, subs } = await firstValueFrom(
      forkJoin({
        mappings: this.subcontractorService.getSubcontractorWorkItemMappings(),
        subs: this.subcontractorService.getSubcontractors(),
      })
    );

    const selectedWorkItemIds = new Set(
      this.selectedWorkItems.map(w => this.normalizeId(w.workItemID))
    );

    // workitem -> set(subId)
    const allowedSubIds = new Set<string>();
    (mappings || []).forEach((m: any) => {
      const wid = this.normalizeId(m.workItemID);
      if (selectedWorkItemIds.has(wid)) {
        allowedSubIds.add(this.normalizeId(m.subcontractorID));
      }
    });

    const activeOnly = (subs || []).filter((s: any) => s.isActive === true);

    // build linkedWorkItemIDs from mappings
    const filtered = activeOnly
      .filter((s: any) => allowedSubIds.has(this.normalizeId(s.subcontractorID)))
      .map((s: any) => {
        const sid = this.normalizeId(s.subcontractorID);
        const linkedWorkItemIDs = (mappings || [])
          .filter((m: any) => this.normalizeId(m.subcontractorID) === sid)
          .map((m: any) => this.normalizeId(m.workItemID));

        return {
          subcontractorID: s.subcontractorID,
          name: s.name,
          email: s.email,
          location: s.location,
          selected: false,
          dueDate: '',
          linkedWorkItemIDs,
        } as SubcontractorItem;
      });

    this.allSubcontractors = filtered;

    // respect showAll toggle (if showAll, show ALL active subs but still set linkedWorkItemIDs)
    if (this.showAll) {
      this.subcontractors = activeOnly.map((s: any) => {
        const sid = this.normalizeId(s.subcontractorID);
        const linkedWorkItemIDs = (mappings || [])
          .filter((m: any) => this.normalizeId(m.subcontractorID) === sid)
          .map((m: any) => this.normalizeId(m.workItemID));

        return {
          subcontractorID: s.subcontractorID,
          name: s.name,
          email: s.email,
          location: s.location,
          selected: false,
          dueDate: '',
          linkedWorkItemIDs,
        } as SubcontractorItem;
      });
    } else {
      this.subcontractors = [...filtered];
    }

this.dataSourceSubcontractors.data = this.subcontractors;
    this.noSubMessage = this.subcontractors.length
      ? ''
      : this.showAll
        ? 'No subcontractors available.'
        : 'No subcontractors mapped to selected work items.';
  } catch (err) {
    console.error('❌ Error loading subcontractors:', err);
    this.subcontractors = [];
    this.dataSourceSubcontractors.data = [];
  }
}

  async ngOnInit() {
    const today = new Date();
    this.minDate = today.toISOString().split('T')[0];
    this.loadCategoriesAndWorkitems();
    this.projectId = this.route.snapshot.paramMap.get('projectId') || '';
    this.rfqIdForEdit = this.route.snapshot.paramMap.get('rfqId');
    if (this.projectId) {
      this.loadProjectDetails(this.projectId);
      this.loadProjectDocumentsIntoUploadTab(this.projectId);
      this.selectedProject = this.projectId;
    }
    const restoreDraftWhenReady = () => {
    const waitForWorkitems = setInterval(async () => {
  if (this.standardWorkitems.length || this.unibouwWorkitems.length) {
    clearInterval(waitForWorkitems);
    await this.restoreDraft();
  }
}, 50);
    };
    if (this.rfqIdForEdit) {
      await this.loadRfqForEdit(this.rfqIdForEdit);
      restoreDraftWhenReady();
    } else {
      restoreDraftWhenReady();
    }
    this.loadProjects();
  }

  ngOnDestroy(): void {
    localStorage.removeItem(this.getDraftKey());
  }

  @HostListener('window:beforeunload')
  onBeforeUnload() {
    this.saveDraft();
  }

  goBack(): void {
    this.location.back();
  }

  private loadProjectDocumentsIntoUploadTab(projectId: string) {
    if (!projectId) return;
    this.rfqService.getProjectDocuments(projectId).subscribe({
      next: (docs: any[]) => {
        this.uploadedFiles = (this.uploadedFiles || []).filter(x => x.source === 'new');
        const projectRows = (docs || []).map(d => ({
          name: d.fileName,
          selected: false,
          source: 'project' as const,
          projectDocumentID: d.projectDocumentID
        }));
        const existingProjectIds = new Set(
          this.uploadedFiles.filter(x => x.source === 'project').map(x => x.projectDocumentID)
        );
        projectRows.forEach(r => {
          if (!existingProjectIds.has(r.projectDocumentID)) {
            this.uploadedFiles.push(r);
          }
        });
        this.uploadedFiles = [...this.uploadedFiles];
        this.cdr.detectChanges();
      },
      error: err => console.error('Failed to load project documents', err)
    });
  }

  confirmCancel() {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      position: { top: '10%', right: '35%' },
      panelClass: 'center-dialog',
      data: {
        title: this.translate.instant('COMMON.CONFIRM'),
        message: this.translate.instant('RFQ_PAGE.DISCARD'),
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result === true) {
        this.onCancelConfirmed();
      }
    });
  }

  hasSelectedSubcontractor(): boolean {
    return this.subcontractors?.some((s) => s.selected);
  }

  onCancelConfirmed() {
    this.skipDraftSave = true;
    localStorage.removeItem(this.getDraftKey());
    this.selectedTab = 'standard';
    this.selectedWorkItems = [];
    this.subcontractors = [];
    if (!this.projectId) {
      console.error('❌ Project ID missing on cancel');
      return;
    }
    this.router.navigate(['view-projects', this.projectId], {
      queryParams: { tab: 'rfq' },
    });
  }

  private normalizeId(id: string | null | undefined): string {
    return (id || '').toUpperCase();
  }

async loadRfqForEdit(rfqId: string) {
  this.rfqIdForEdit = rfqId;
  this.isLoader = true;

  try {
    const [res, info, subDates]: [any, any[], any[]] = await firstValueFrom(
      forkJoin([
        this.rfqService.getRfqById(rfqId),
        this.rfqService.getRfqWorkItems(rfqId),
        this.rfqService.getRfqSubcontractorDueDates(rfqId),
      ])
    );

    this.originalRfq = res;
    if (!this.originalRfq) return;

    // ================= RFQ BASIC INFO =================
    this.rfqNumber = this.originalRfq.rfqNumber || 'N/A';
    this.createdDateDisplay = this.formatDateDisplay(this.originalRfq.createdOn);
    this.customNote = this.originalRfq.customNote;
    this.editedEmailBody = this.originalRfq.customNote || '';
    this.selectedProject = this.originalRfq.projectID;

    // ================= WORKITEMS =================
    this.selectedWorkItems = info || [];
    this.workItemName = this.selectedWorkItems.map(w => w.name).join(', ');

    // ================= TAB DETECTION =================
    if (this.selectedWorkItems.length) {
      const first = this.selectedWorkItems[0];

      if (this.standardWorkitems.some(w => w.workItemID === first.workItemID)) {
        this.selectedTab = 'standard';
      } else if (this.unibouwWorkitems.some(w => w.workItemID === first.workItemID)) {
        this.selectedTab = 'unibouw';
      } else {
        this.selectedTab = 'uploaded';
      }
    }

    // ================= GLOBAL DUE DATE =================
    let earliestDate = '';
    (subDates || []).forEach((s: any) => {
      const date = s.GlobalDueDate || s.DueDate;
      if (date && (!earliestDate || new Date(date) < new Date(earliestDate))) {
        earliestDate = date;
      }
    });

    this.globalDueDate = earliestDate ? earliestDate.split('T')[0] : '';

    // ================= LOAD MASTER SUBCONTRACTORS (IMPORTANT FIX) =================
    const { mappings, subs } = await firstValueFrom(
      forkJoin({
        mappings: this.subcontractorService.getSubcontractorWorkItemMappings(),
        subs: this.subcontractorService.getSubcontractors(),
      })
    );

    const activeSubs = (subs || []).filter((s: any) => s.isActive === true);

    // 🔥 FIX: ALWAYS STORE FULL LIST HERE (NO FILTERING)
    this.allSubcontractors = activeSubs.map((s: any) => {
      const sid = this.normalizeId(s.subcontractorID);

      return {
        subcontractorID: s.subcontractorID,
        name: s.name,
        email: s.email,
        location: s.location,
        selected: false,
        dueDate: '',
        linkedWorkItemIDs: (mappings || [])
          .filter((m: any) => this.normalizeId(m.subcontractorID) === sid)
          .map((m: any) => this.normalizeId(m.workItemID)),
      };
    });

    console.log('🔥 TOTAL SUBCONTRACTORS LOADED:', this.allSubcontractors.length);

    // ================= FILTER ONLY FOR UI =================
    const selectedWorkItemIds = new Set(
      this.selectedWorkItems.map(w => this.normalizeId(w.workItemID))
    );

    this.subcontractors = this.allSubcontractors.filter(sub =>
      (sub.linkedWorkItemIDs || []).some(id =>
        selectedWorkItemIds.has(this.normalizeId(id))
      )
    );

    console.log('📊 FILTERED FOR UI:', this.subcontractors.length);

    // ================= RESTORE RFQ SELECTION =================
    const rfqMap = new Map<string, any>();

    (subDates || []).forEach((s: any) => {
      const subId = this.normalizeId(s.SubcontractorID || s.subcontractorID);
      rfqMap.set(subId, s);
    });

    this.subcontractors.forEach(sub => {
      const match = rfqMap.get(this.normalizeId(sub.subcontractorID));

      if (match) {
        sub.selected = true;
        sub.dueDate = this.formatDateForHtml(match.DueDate || match.dueDate || '');
      }
    });

    // ================= STATE TRACKING =================
    this.originalSubcontractorState = this.subcontractors.map(s => ({
      subcontractorID: s.subcontractorID,
      selected: !!s.selected,
      dueDate: s.dueDate,
    }));

    this.baseSelectedSubcontractorIds = new Set(
      this.subcontractors
        .filter(s => s.selected)
        .map(s => this.normalizeId(s.subcontractorID))
    );

    // ================= UI UPDATE =================
    this.dataSourceSubcontractors.data = [...this.subcontractors];

    this.noSubMessage = this.subcontractors.length
      ? ''
      : 'No subcontractors mapped to selected work items.';

    this.cdr.detectChanges();

  } catch (err) {
    console.error('❌ Error in loadRfqForEdit:', err);
  } finally {
    this.isLoader = false;
  }
}

  formatDateForHtml(dateStr: string): string {
    if (!dateStr) return '';
    return dateStr.substring(0, 10);
  }
  formatDateDisplay(dateString: string | null): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  }

  onSubcontractorToggle(sub: any) {
    if (sub.selected) {
      this.saveDraft();
      if (!sub.dueDate) {
        sub.dueDate = '';
      }
    } else {
      sub.dueDate = '';
    }
  }

  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (this.uploadedFiles.some((f) => f.source === 'new' && f.name === file.name)) continue;
      this.uploadedFiles.push({ name: file.name, selected: true, file, source: 'new' });
    }
    event.target.value = '';
    this.saveDraft();
  }

  removeUploadedFile(index: number) {
    if (index >= 0 && index < this.uploadedFiles.length) {
      this.uploadedFiles.splice(index, 1);
      this.saveDraft();
    }
  }

  private semanticNumberSort(a: string, b: string): number {
    const aParts = (a || '').split('.').map(Number);
    const bParts = (b || '').split('.').map(Number);
    const len = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < len; i++) {
      const aVal = aParts[i] ?? 0;
      const bVal = bParts[i] ?? 0;
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
    }
    return 0;
  }

  todayForHtml(): string {
    const d = new Date();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

async loadSubcontractors(workItemID: string, existingSubs: any[] = []): Promise<void> {
  console.log('🚀 loadSubcontractors called with:', workItemID);

  this.isLoader = true;

  try {
    const { mappings, subs } = await firstValueFrom(
      forkJoin({
        mappings: this.subcontractorService.getSubcontractorWorkItemMappings(),
        subs: this.subcontractorService.getSubcontractors(),
      }),
    );

    const normalizedWorkItemID = this.normalizeId(workItemID);

    // ✅ Workitem -> subcontractor IDs mapped
    const validSubIds = (mappings || [])
      .filter((m: any) => this.normalizeId(m.workItemID) === normalizedWorkItemID)
      .map((m: any) => this.normalizeId(m.subcontractorID));

    // ✅ Due-date map from existing RFQ mappings (edit mode)
    const rfqDueDateMap = new Map<string, string>();
    (existingSubs || []).forEach((s: any) => {
      const subId = this.normalizeId(s.subcontractorID || s.SubcontractorID);
      const due = s.dueDate || s.DueDate;
      if (subId) rfqDueDateMap.set(subId, this.formatDateForHtml(due));
    });

    const activeOnly = (subs || []).filter((s: any) => s.isActive === true);

    // ✅ Filter + map subcontractors for this workitem
    const filteredSubs: SubcontractorItem[] = activeOnly
      .filter((s: any) => validSubIds.includes(this.normalizeId(s.subcontractorID)))
      .map((s: any) => {
        const sid = this.normalizeId(s.subcontractorID);

        return {
          subcontractorID: s.subcontractorID,
          name: s.name,
          email: s.email,
          location: s.location,
          selected: rfqDueDateMap.has(sid),
          dueDate: rfqDueDateMap.get(sid) ?? '',
          linkedWorkItemIDs: (mappings || [])
            .filter((m: any) => this.normalizeId(m.subcontractorID) === sid)
            .map((m: any) => this.normalizeId(m.workItemID)),
        };
      });

    // ✅ IMPORTANT:
    // If multiple workitems are selected elsewhere, calling this method repeatedly will overwrite.
    // This method is intentionally "single workitem" replacement.
    this.subcontractors = filteredSubs;
this.dataSourceSubcontractors.data = this.subcontractors;
    // If you are using search, re-apply filter so the table doesn't look empty
    if (this.searchSubcontractor?.trim()) {
      this.applySubcontractorFilter();
    }

    this.cdr.detectChanges();
  } catch (err) {
    console.error('❌ Error loading subcontractors:', err);
    this.subcontractors = [];
    this.dataSourceSubcontractors.data = [];
  } finally {
    this.isLoader = false;
  }
}

  getNewOrModifiedSubcontractors() {
    if (!this.rfqIdForEdit) return [];
    return this.subcontractors.filter((current) => {
      if (!current.selected) return false;
      const existedAtCreation = this.originalSubcontractorState.some(
        (o) => this.normalizeId(o.subcontractorID) === this.normalizeId(current.subcontractorID),
      );
      return !existedAtCreation;
    });
  }
  @ViewChild('workitemsWrapper') workitemsWrapper?: ElementRef<HTMLElement>;

  private savedWorkitemsScrollTop = 0;

private saveWorkitemsScroll(): void {
  const el = this.workitemsWrapper?.nativeElement;
  this.savedWorkitemsScrollTop = el ? el.scrollTop : 0;
}

private restoreWorkitemsScroll(): void {
  requestAnimationFrame(() => {
    const el = this.workitemsWrapper?.nativeElement;
    if (el) el.scrollTop = this.savedWorkitemsScrollTop;
  });
}

  saveSubcontractorWorkItemMappings(
    selectedSubs: any[],
    selectedWorkItems: any[],
    rfqId: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!selectedSubs.length || !selectedWorkItems.length) {
        resolve();
        return;
      }
      const calls: Observable<any>[] = [];
      selectedWorkItems.forEach((w) => {
        selectedSubs.forEach((s) => {
          if (!s.dueDate) return;
          calls.push(
            this.rfqService.saveSubcontractorWorkItemMapping(
              w.workItemID,
              s.subcontractorID,
              new Date(s.dueDate).toISOString(),
              rfqId,
            ),
          );
        });
      });
      forkJoin(calls).subscribe({
        next: (res) => {
          console.log('✅ Subcontractor–WorkItem mappings saved', res);
          resolve();
        },
        error: (err) => {
          console.error('❌ Mapping save failed', err);
          reject(err);
        },
      });
    });
  }

async onSubmit(
  sendEmail: boolean = false,
  editedEmailBody: string = '',
  markAsSent: boolean = false
) {
  if (!this.selectedProject)
    return this.alertService.warning('Select a project first');

  const selectedProject = this.projects.find(p => p.projectID === this.selectedProject);
  if (!selectedProject)
    return this.alertService.warning('Project not found');

  const selectedSubs = this.subcontractors.filter(s => s.selected);

  if (!this.globalDueDate)
    return this.alertService.warning('Please select the Global Due Date');

  if (!selectedSubs.length)
    return this.alertService.warning('Select at least one subcontractor');

  if (this.selectedTab === 'uploaded') {
    const selectedRows = this.uploadedFiles.filter(f => f.selected);
    if (!selectedRows.length)
      return this.alertService.warning('Please select at least one file');
  } else {
    if (!this.selectedWorkItems.length)
      return this.alertService.warning('Select at least one work item');
  }

  if (selectedSubs.some(s => !s.dueDate))
    return this.alertService.warning('Please select Due Date for all subcontractors');

  this.isLoader = true;

  const loaderTimer = setTimeout(() => {
    this.isLoader = false;
    this.alertService.warning('Still processing...');
  }, 60000);

  try {
    const now = new Date().toISOString();
    const isUpdate = !!this.rfqIdForEdit;
    const tempRfqId = '00000000-0000-0000-0000-000000000000';

    const createdBy = this.originalRfq?.createdBy || 'System';
    const defaultIntro = this.translate.instant('RFQ_EMAIL.INTRO');

    const emailBodyToUse =
      (this.editedEmailBody?.trim() ||
        this.customNote?.trim() ||
        defaultIntro ||
        '');

    const rfqIDForPayload = this.rfqIdForEdit || tempRfqId;

    const subcontractorDueDates = selectedSubs.map(s => ({
      subcontractorID: s.subcontractorID,
      dueDate: new Date(s.dueDate!).toISOString().split('T')[0],
    }));

    // ================= SAVE MAPPINGS =================
    if (isUpdate) {
      for (const sub of selectedSubs) {
        for (const work of this.selectedWorkItems) {
          const dueDate = subcontractorDueDates.find(
            d => d.subcontractorID === sub.subcontractorID
          )?.dueDate;

          if (!dueDate) continue;

          await this.rfqService
            .saveOrUpdateRfqSubcontractorMapping(
              rfqIDForPayload,
              sub.subcontractorID,
              work.workItemID,
              dueDate
            )
            .toPromise();
        }
      }
    } else {
      await this.saveSubcontractorWorkItemMappings(
        selectedSubs,
        this.selectedWorkItems,
        rfqIDForPayload
      );
    }

    // ================= STATUS =================
    const sentDateToUse = (sendEmail || markAsSent)
      ? now
      : this.originalRfq?.sentDate || null;

    const finalStatus = markAsSent || sendEmail ? 'Sent' : 'Draft';

    const rfqPayload: any = {
      rfqID: rfqIDForPayload,
      sentDate: sentDateToUse,
      GlobalDueDate: new Date(this.globalDueDate!).toISOString().split('T')[0],
      rfqSent: (markAsSent || sendEmail) ? 1 : (this.originalRfq?.rfqSent || 0),
      quoteReceived: this.originalRfq?.quoteReceived || 0,
      customerID: selectedProject.customerID,
      projectID: selectedProject.projectID,
      customNote: emailBodyToUse,
      createdBy,
      modifiedBy: isUpdate ? 'System' : null,
      status: finalStatus,
      createdOn: this.originalRfq?.createdOn || now,
      modifiedOn: isUpdate ? now : null,
      subcontractorsToEmail: selectedSubs.map(s => s.subcontractorID),
    };

    const subcontractorIds = selectedSubs.map(s => s.subcontractorID);
    const workItems = this.selectedWorkItems.map(w => w.workItemID);

    const request$ = isUpdate
      ? this.rfqService.updateRfq(
          rfqPayload.rfqID!,
          rfqPayload,
          subcontractorIds,
          workItems,
          sendEmail
        )
      : this.rfqService.createRfqSimple(
          rfqPayload,
          subcontractorIds,
          workItems,
          emailBodyToUse,
          sendEmail,
          subcontractorDueDates
        );

    const res: any = await request$.toPromise();

    const finalRfqId =
      this.rfqIdForEdit ||
      res?.data?.rfqID ||
      res?.rfqID ||
      res?.rfqId;

    if (!finalRfqId)
      throw new Error('RFQ ID not returned');

    // ================= DOCUMENT LINKING =================
    const selectedProjectDocIds = this.uploadedFiles
      .filter(f => f.selected && f.source === 'project' && f.projectDocumentID)
      .map(f => String(f.projectDocumentID));

    if (selectedProjectDocIds.length) {
      await this.rfqService
        .linkProjectDocsToRfq(finalRfqId, selectedProjectDocIds)
        .toPromise();
    }

    // ================= NEW FILE UPLOAD (EDIT MODE FIX) =================
    const filesToUpload = this.uploadedFiles
      .filter(f => f.selected && f.source === 'new' && f.file && !f.saved)
      .map(f => f.file as File);

    if (filesToUpload.length) {
      try {
        await firstValueFrom(
          this.rfqService.uploadDocsToRfq(
            finalRfqId,
            this.selectedProject,
            filesToUpload
          ).pipe(
            timeout(120000),
            catchError(err => {
              console.error('Upload failed:', err);
              return throwError(() => err);
            })
          )
        );
        // Mark files as saved after successful upload
        this.uploadedFiles
          .filter(f => f.selected && f.source === 'new' && !f.saved)
          .forEach(f => {
            f.saved = true;
            f.saveError = false;
            f.saving = false;
          });
      } catch (err) {
        this.uploadedFiles
          .filter(f => f.selected && f.source === 'new' && !f.saved)
          .forEach(f => {
            f.saveError = true;
            f.saving = false;
          });
        this.cdr.detectChanges();
        throw err;
      }
    }

    // ================= RELOAD RFQ DOCUMENTS (SHOW ALL FILES) =================
    await firstValueFrom(this.rfqService.getRfqDocuments(finalRfqId).pipe(
      map((docs: any[]) => {
        // Always refresh the UI file list with backend data
        this.uploadedFiles = (docs || []).map(d => ({
          name: d.fileName,
          selected: false,
          source: 'project',
          projectDocumentID: d.projectDocumentID
        }));
        this.cdr.detectChanges();
      })
    ));

    this.alertService.success(
      this.translate.instant(markAsSent || sendEmail ? 'RFQ_TABLE.RFQ_SENT' : 'RFQ_TABLE.RFQ_SAVED')
    );

    localStorage.removeItem(this.getDraftKey());

    this.router.navigate(['/view-projects', this.selectedProject], {
      queryParams: { tab: 'rfq' },
    });

  } catch (err) {
    console.error('RFQ failed', err);
    this.alertService.error(this.translate.instant('RFQ_TABLE.RFQ_FAILED'));
  } finally {
    clearTimeout(loaderTimer);
    this.isLoader = false;
  }
}
  loadProjectDetails(id: string) {
    this.projectService.getProjectById(id).subscribe({
      next: (res) => {
        this.projectDetails = res;
      },
      error: (err) => {
        console.error('❌ Error loading project:', err);
      },
    });
  }


  
  async saveSingleUploadedFile(index: number) {
    const fileObj = this.uploadedFiles[index];
    if (!fileObj || fileObj.source !== 'new' || !fileObj.file) return;
    fileObj.saving = true;
    fileObj.saveError = false;
    try {
      const rfqId = this.rfqIdForEdit;
      const projectId = this.selectedProject;
      if (!rfqId) {
        this.alertService.warning('Please save the RFQ before uploading files');
        fileObj.saving = false;
        return;
      }
      await this.rfqService.uploadDocsToRfq(rfqId, projectId, [fileObj.file]).toPromise();
      fileObj.saved = true;
      this.alertService.success('File uploaded successfully');
    } catch (e) {
      fileObj.saveError = true;
      this.alertService.error('File upload failed');
      console.error('File upload failed:', e);
    } finally {
      fileObj.saving = false;
      this.cdr.detectChanges();
    }
  }

  loadProjects() {
    this.projectService.getProjects().subscribe({
      next: (res: projectdetails[]) => {
        this.projects = res || [];
        if (!this.selectedProject && this.projects.length) {
          this.selectedProject = this.projects[0].projectID;
        }
      },
      error: (err: any) => console.error('Error loading projects:', err),
    });
  }

  private sortWorkItemsAsc(items: Workitem[]): Workitem[] {
    return items.sort((a, b) => this.semanticNumberSort(a.number, b.number));
  }

  async loadCategoriesAndWorkitems() {
    this.isLoader = true;
    try {
      const categories: WorkitemCategory[] = await lastValueFrom(
        this.workitemService.getCategories(),
      );
      const categoryMap = new Map<number, WorkitemCategory>(
        (categories ?? []).map((c) => [Number(c.categoryID), c]),
      );
      const unibouwCategory = categoryMap.get(1);
      const standardCategory = categoryMap.get(2);
      const uploadedCategory = (categories || []).find(
        (c) => c.categoryName?.toLowerCase() === 'uploaded',
      );
      if (!unibouwCategory || !standardCategory) {
        console.error('Required categories not found (categoryID 1 or 2 missing)');
        return;
      }
      const [standard, unibouw] = await lastValueFrom(
        forkJoin([
          this.workitemService.getWorkitems(standardCategory.categoryID, true),
          this.workitemService.getWorkitems(unibouwCategory.categoryID, true),
        ]),
      );
      this.standardWorkitems = this.sortWorkItemsAsc(standard ?? []);
      this.unibouwWorkitems = this.sortWorkItemsAsc(unibouw ?? []);
      // 👇 ADD THIS
this.dataSourceWorkitems.data =
  this.selectedTab === 'standard'
    ? this.standardWorkitems
    : this.unibouwWorkitems;
      if (uploadedCategory) {
        try {
          const uploaded = await lastValueFrom(
            this.workitemService.getWorkitems(uploadedCategory.categoryID, true),
          );
          this.uploadedWorkitems = this.sortWorkItemsAsc(uploaded ?? []);
        } catch (e) {
          console.warn('Failed to load uploaded workitems', e);
        }
      }
    } catch (err) {
      console.error('Error loading categories or workitems:', err);
    } finally {
      this.isLoader = false;
    }
  }

updateWorkitemDatasource() {
  if (this.selectedTab === 'standard') {
    this.dataSourceWorkitems.data = [...this.standardWorkitems];
  } else if (this.selectedTab === 'unibouw') {
    this.dataSourceWorkitems.data = [...this.unibouwWorkitems];
  } else {
    this.dataSourceWorkitems.data = [...this.uploadedWorkitems];
  }
}

  isWorkItemSelected(item: Workitem): boolean {
    return this.selectedWorkItems.some((w) => w.workItemID === item.workItemID);
  }

trackByWorkItemId(index: number, item: any) {
  return item.workItemID;
}

async onWorkitemToggle(item: Workitem, checked: boolean) {
  this.saveWorkitemsScroll();

  if (checked) {
    if (!this.selectedWorkItems.some(w => w.workItemID === item.workItemID)) {
      this.selectedWorkItems.push(item);
    }
  } else {
    this.selectedWorkItems = this.selectedWorkItems.filter(w => w.workItemID !== item.workItemID);
  }

  await this.loadSubcontractorsForSelectedWorkitems();

  this.restoreWorkitemsScroll();
}


  getSelectedCount(categoryId: string): number {
    return (this.selectionsByCategory.get(categoryId) || []).length;
  }


async loadSubcontractorsForSelectedWorkitems(): Promise<void> {
  if (!this.selectedWorkItems.length) {
    this.subcontractors = [];
    this.allSubcontractors = [];
    this.dataSourceSubcontractors.data = [];
    return;
  }

  try {
    const subs = await firstValueFrom(
      this.subcontractorService.getSubcontractors()
    );

    const activeSubs = (subs || []).filter(s => s.isActive === true);

    // ✅ BUILD ONLY ONCE
    if (!this.allSubcontractors.length) {
      this.allSubcontractors = activeSubs.map((s: any) => ({
        subcontractorID: s.subcontractorID,
        name: s.name,
        email: s.email,
        location: s.location,
        selected: false,
        dueDate: '',
        linkedWorkItemIDs: s.linkedWorkItemIDs || []
      }));
    }

    const selectedWorkItemIds = new Set(
      this.selectedWorkItems.map(w => this.normalizeId(w.workItemID))
    );

    // ✅ FILTER ONLY (no rebuild)
    this.subcontractors = this.showAll
      ? this.allSubcontractors
      : this.allSubcontractors.filter(sub =>
          (sub.linkedWorkItemIDs || []).some(id =>
            selectedWorkItemIds.has(this.normalizeId(id))
          )
        );

    // ✅ NO ARRAY COPY
    this.dataSourceSubcontractors.data = this.subcontractors;

    this.noSubMessage = this.subcontractors.length
      ? ''
      : this.showAll
        ? 'No subcontractors available.'
        : 'No subcontractors mapped to selected work items.';

  } catch (err) {
    console.error('❌ Error loading subcontractors:', err);
    this.subcontractors = [];
    this.dataSourceSubcontractors.data = [];
  }
}

applySubcontractorView() {
  const selectedWorkItemIds = new Set(
    this.selectedWorkItems.map(w => this.normalizeId(w.workItemID))
  );

  if (this.showAll) {
    // ✅ SHOW ALL
    this.subcontractors = [...this.allSubcontractors];
    this.noSubMessage = this.subcontractors.length
      ? ''
      : 'No subcontractors available.';
  } else {
    // ✅ FILTER BASED ON SELECTED WORKITEMS
    this.subcontractors = this.allSubcontractors.filter(sub =>
      (sub.linkedWorkItemIDs || []).some(id =>
        selectedWorkItemIds.has(id)
      )
    );

    this.noSubMessage = this.subcontractors.length
      ? ''
      : 'No subcontractors mapped to selected work items.';
  }

  this.dataSourceSubcontractors.data = this.subcontractors;
}

  onWorkitemSelect(item: Workitem) {
    this.selectedWorkItems = [item];
    this.subcontractors = [];
    this.noSubMessage = 'Loading subcontractors...';
    const existingSubs = this.originalRfq
      ? this.originalRfq.subcontractors?.filter((s: any) => s.workItemID === item.workItemID)
      : [];
    this.loadSubcontractors(item.workItemID, existingSubs).then(() => {
      this.noSubMessage = this.subcontractors.length
        ? ''
        : 'No subcontractors linked to this work item.';
    });
  }

  addSubcontractor() {
    const newName = prompt('Enter subcontractor name:');
    if (newName) {
      const newSub: SubcontractorItem = {
        subcontractorID: `temp-${Date.now()}`,
        name: newName,
        category: '',
        personName: '',
        phoneNumber1: '',
        email: '',
        selected: false,
        dueDate: this.globalDueDate || '',
      };
      this.subcontractors.unshift(newSub);
    }
  }

  applyGlobalDate() {
    this.globalDateError = false;
    if (!this.hasSelectedSubcontractor()) {
      this.globalDateError = true;
      this.saveDraft();
      this.globalDueDate = '';
      return;
    }
    if (!this.globalDueDate) return;
    this.subcontractors
      .filter((s) => s.selected)
      .forEach((sub) => {
        sub.dueDate = this.globalDueDate!;
      });
  }

  onProjectChange(event: Event) {
    const projectId = (event.target as HTMLSelectElement).value;
    this.selectedProject = projectId;
    this.selectedWorkItems = [];
    this.subcontractors = [];
    this.loadProjectDocumentsIntoUploadTab(projectId);
  }

  onCancel() {
    this.selectedProject = this.projects.length ? this.projects[0].projectID : '';
    this.selectedTab = 'standard';
    this.selectedWorkItems = [];
    this.subcontractors = [];
  }

  getSelectedCountByTab(tab: 'unibouw' | 'standard' | 'uploaded'): number {
    if (tab === 'uploaded') {
      return this.uploadedFiles.filter((f) => f.selected).length;
    }
    let source: Workitem[];
    if (tab === 'unibouw') source = this.unibouwWorkitems;
    else source = this.standardWorkitems;
    return this.selectedWorkItems.filter((sel) =>
      source.some((src) => src.workItemID === sel.workItemID),
    ).length;
  }

removeFile(index: number, file: any) {
  console.log('DELETE CLICKED:', index, file);

  if (!file) return;

  this.uploadedFiles.splice(index, 1);

  this.uploadedFiles = [...this.uploadedFiles];
  this.dataSourceWorkitems.data = [...this.uploadedFiles];

  this.cdr.detectChanges();

  this.saveDraft();
}


private mergeSubcontractorState(
  source: SubcontractorItem[],
  existing: SubcontractorItem[]
): SubcontractorItem[] {

  const existingMap = new Map<string, SubcontractorItem>(
    (existing || []).map(s => [
      this.normalizeId(s.subcontractorID),
      s
    ])
  );

  return (source || []).map(s => {
    const old = existingMap.get(this.normalizeId(s.subcontractorID));

    return {
      ...s,
      selected: old?.selected ?? false,
      dueDate: old?.dueDate ?? '',
    };
  });
}

private isMappedToSelectedWorkItems(sub: SubcontractorItem): boolean {
  const selectedWorkItemIds = new Set(
    this.selectedWorkItems.map(w => this.normalizeId(w.workItemID))
  );

  return (sub.linkedWorkItemIDs || []).some(id =>
    selectedWorkItemIds.has(this.normalizeId(id))
  );
}


async toggleSelectAll(): Promise<void> {
  console.log('🔥 SHOW ALL TOGGLED:', this.showAll);

  // 🚨 IMPORTANT: ensure base list exists
  if (!this.allSubcontractors || this.allSubcontractors.length === 0) {
    console.log('⚠️ allSubcontractors empty → rebuilding...');
    await this.buildAllSubcontractorsForEdit(); // 🔥 MUST
  }

  const selectedWorkItemIds = new Set(
    this.selectedWorkItems.map(w => this.normalizeId(w.workItemID))
  );

  if (this.showAll) {
    console.log('✅ Showing ALL subcontractors:', this.allSubcontractors.length);

    this.subcontractors = [...this.allSubcontractors];
    this.noSubMessage = this.subcontractors.length
      ? ''
      : 'No subcontractors available.';
  } else {
    console.log('🔍 Filtering subcontractors by workitems');

    this.subcontractors = this.allSubcontractors.filter(sub =>
      (sub.linkedWorkItemIDs || []).some(id =>
        selectedWorkItemIds.has(this.normalizeId(id))
      )
    );

    this.noSubMessage = this.subcontractors.length
      ? ''
      : 'No subcontractors mapped to selected work items.';
  }

  console.log('📊 FINAL SUBCONTRACTORS:', this.subcontractors.length);

  this.dataSourceSubcontractors.data = [...this.subcontractors];
  this.cdr.detectChanges();
}

private async buildAllSubcontractorsForEdit(): Promise<void> {
  try {
    const { mappings, subs } = await firstValueFrom(
      forkJoin({
        mappings: this.subcontractorService.getSubcontractorWorkItemMappings(),
        subs: this.subcontractorService.getSubcontractors(),
      })
    );

    const activeSubs = (subs || []).filter((s: any) => s.isActive === true);

    // Map of existing RFQ subcontractors (already selected ones)
    const existingMap = new Map<string, SubcontractorItem>(
      (this.subcontractors || []).map(s => [
        this.normalizeId(s.subcontractorID),
        s
      ])
    );

    // ✅ Build FULL dataset with mappings
    this.allSubcontractors = activeSubs.map((s: any) => {
      const sid = this.normalizeId(s.subcontractorID);

      const linkedWorkItemIDs = (s.WorkItemIDs || []).map((id: any) =>
  this.normalizeId(id)
);

      const existing = existingMap.get(sid);

      return {
        subcontractorID: s.subcontractorID,
        name: s.name,
        email: s.email,
        location: s.location,
        selected: existing?.selected ?? false,
        dueDate: existing?.dueDate ?? '',
        linkedWorkItemIDs
      };
    });

    // ✅ Apply current view (respect showAll toggle)
    this.applySubcontractorView();

    this.cdr.detectChanges();

  } catch (err) {
    console.error('❌ Error building all subcontractors:', err);
    this.allSubcontractors = [];
  }
}

  get selectedSubcontractors() {
    return (this.subcontractors || []).filter((s: any) => s.selected);
  }

  // The key: only set default intro if editedEmailBody is null/undefined (never overwrite a draft or typed value)
async openPreview() {
  if (!this.selectedProject) {
    return this.alertService.warning(this.translate.instant('Select a project'));
  }

  if (!this.selectedWorkItems.length) {
    return this.alertService.warning(this.translate.instant('Select work item'));
  }

  if (!this.selectedSubcontractors.length) {
    return this.alertService.warning(this.translate.instant('Select subcontractors'));
  }

  const t = await firstValueFrom(
    this.translate.get([
      'RFQ_EMAIL.INTRO',
      'RFQ_EMAIL.RFQ_ID_PENDING'
    ])
  );

  const workItemNames = this.selectedWorkItems.map(w => w.name);

  this.previewData = {
    rfqId: this.originalRfq?.rfqNumber || t['RFQ_EMAIL.RFQ_ID_PENDING'],
    projectName: this.projectDetails?.name || 'N/A',
    workItems: workItemNames,
    dueDate: this.globalDueDate,
    subcontractors: this.selectedSubcontractors.map(s => s.name),
  };

  /**
   * ✅ PRIORITY FIX:
   * 1. Keep existing editedEmailBody (draft / user typed)
   * 2. Else use backend customNote (edit mode)
   * 3. Else fallback to default intro
   */
  if (!this.editedEmailBody || this.editedEmailBody.trim() === '') {
    this.editedEmailBody =
      this.customNote ||                // from backend (edit RFQ)
      t['RFQ_EMAIL.INTRO'] || '';      // default text
  }

  // Open modal
  this.showPreview = false;
  setTimeout(() => {
    this.showPreview = true;
    document.body.style.overflow = 'hidden';
  }, 0);
} 

  closePreview() {
    this.showPreview = false;
    document.body.style.overflow = '';
  }

 addSub() {
    const projectName = this.projectDetails?.name;
    const projectID = this.projectDetails?.projectID;
    const projectCode = this.projectDetails?.number;

    if (!projectName || !projectID) {
      console.error('Project name or ID missing');
      return;
    }

    // Navigate to add-subcontractor with projectID and projectName
 this.router.navigate(
    ['/add-subcontractor', projectID, projectName, projectCode],
    {
      queryParams: { rfqId: this.rfqIdForEdit } // ✅ pass it only if edit mode
    }
  );  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.showPreview) this.closePreview();
  }
}