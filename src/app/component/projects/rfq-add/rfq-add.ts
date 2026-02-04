import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectorRef, Component, HostListener } from '@angular/core';
import { firstValueFrom, forkJoin, lastValueFrom, Observable, ObservableInput } from 'rxjs';
import { Subcontractors, SubcontractorService } from '../../../services/subcontractor.service';
import { Workitem, WorkitemCategory, WorkitemService } from '../../../services/workitem.service';
import { Rfq, RfqService } from '../../../services/rfq.service';
import { projectdetails, projectService } from '../../../services/project.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../confirm-dialog-component/confirm-dialog-component';
import { Location } from '@angular/common';

interface SubcontractorItem {
  subcontractorID: string;
  name: string;
  selected?: boolean;
  dueDate?: string; // Added for the Date Picker
  category?: string; // specific fields you might need
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
  selectedTab: 'standard' | 'unibouw' = 'unibouw';
  globalDueDate: any = '';
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
  originalRfq: any = null;
  rfqNumber: string = 'N/A';
  createdDateDisplay: string = 'N/A'; // DD/MM/YYYY format for display
  workItemName: string = 'N/A';
  globalDateError = false;
  originalRfqSubcontractors: any[] = [];

  private readonly RFQ_DRAFT_KEY = 'rfq_add_state';
  private skipDraftSave = false;
  originalSubcontractorState: {
    subcontractorID: string;
    dueDate?: string;
    selected: boolean;
  }[] = [];

  constructor(
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
  ) {}

  isLoader: boolean = false;
  // minDate: Date = new Date();
  minDate: string = '';

  ngOnInit() {
    localStorage.removeItem('rfqDraft');

    const today = new Date();
    this.minDate = today.toISOString().split('T')[0]; // yyyy-MM-dd

    // Default message
    // this.noSubMessage = 'Select a work item to view subcontractors.';

    // 🔹 Load categories & workitems FIRST
    this.loadCategoriesAndWorkitems();

    // 🔹 Load route params
    this.projectId = this.route.snapshot.paramMap.get('projectId') || '';
    this.rfqIdForEdit = this.route.snapshot.paramMap.get('rfqId');

    if (this.projectId) {
      this.loadProjectDetails(this.projectId);
      this.selectedProject = this.projectId;
    }

    if (this.rfqIdForEdit) {
      this.loadRfqForEdit(this.rfqIdForEdit);
      // this.noSubMessage = 'Select a work item to view subcontractors.';
    }

    // 🔹 Load projects (DO NOT override restored project)
    this.loadProjects();

    /* =====================================================
     🔑 DRAFT RESTORE HOOK (WAIT FOR WORKITEMS)
     ===================================================== */
    const waitForWorkitems = setInterval(() => {
      if (this.standardWorkitems.length || this.unibouwWorkitems.length) {
        clearInterval(waitForWorkitems);

        // 🚫 Do NOT restore in edit mode
        if (this.rfqIdForEdit) return;

        const saved = localStorage.getItem(this.RFQ_DRAFT_KEY);
        if (!saved) return;

        const state = JSON.parse(saved);

        console.log('🟢 RFQ DRAFT FOUND');

        // Restore simple fields
        this.selectedTab = state.selectedTab ?? this.selectedTab;
        this.globalDueDate = state.globalDueDate ?? '';

        // Restore workitems
        const allWorkItems = [...this.standardWorkitems, ...this.unibouwWorkitems];

        this.selectedWorkItems = allWorkItems.filter((w) =>
          state.selectedWorkItems?.includes(w.workItemID),
        );

        // Restore subcontractors per workitem
        this.selectedWorkItems.forEach((wi) => {
          this.loadSubcontractors(wi.workItemID).then(() => {
            this.subcontractors.forEach((sub) => {
              const savedSub = state.subcontractors?.find(
                (s: any) => s.subcontractorID === sub.subcontractorID,
              );
              if (savedSub) {
                sub.selected = savedSub.selected;
                sub.dueDate = savedSub.dueDate;
              }
            });
          });
        });
      }
    }, 50);
  }

  ngOnDestroy(): void {
    localStorage.removeItem(this.RFQ_DRAFT_KEY);
  }

  @HostListener('window:beforeunload')
  onBeforeUnload() {
    this.saveDraft();
  }

  goBack(): void {
    this.location.back();
  }

  private restoreDraft() {
    if (this.rfqIdForEdit) return;

    const saved = localStorage.getItem(this.RFQ_DRAFT_KEY);
    if (!saved) return;

    const state = JSON.parse(saved);

    this.selectedTab = state.selectedTab ?? this.selectedTab;
    this.globalDueDate = state.globalDueDate ?? '';

    // restore workitems AFTER they are loaded
    const allWorkItems = [...this.standardWorkitems, ...this.unibouwWorkitems];

    this.selectedWorkItems = allWorkItems.filter((w) =>
      state.selectedWorkItems?.includes(w.workItemID),
    );

    // restore subcontractor state later (after loadSubcontractors)
  }

  private saveDraft() {
    if (this.rfqIdForEdit || this.skipDraftSave) return;

    localStorage.setItem(
      this.RFQ_DRAFT_KEY,
      JSON.stringify({
        selectedTab: this.selectedTab,
        globalDueDate: this.globalDueDate,
        selectedWorkItems: this.selectedWorkItems.map((w) => w.workItemID),
        subcontractors: this.subcontractors.map((s) => ({
          subcontractorID: s.subcontractorID,
          selected: s.selected,
          dueDate: s.dueDate,
        })),
      }),
    );
  }

  confirmCancel() {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',

      // THIS IS THE KEY
      position: {
        top: '10%',
        right: '35%',
      },
      panelClass: 'center-dialog',

      data: {
        title: 'Confirm',
        message: 'Discard all changes?',
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
    // 🛑 stop autosave FIRST
    this.skipDraftSave = true;

    // 🔴 clear draft
    localStorage.removeItem(this.RFQ_DRAFT_KEY);

    // reset state
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
    console.log('🟦 loadRfqForEdit START → RFQ ID:', rfqId);

    this.rfqIdForEdit = rfqId;
    this.isLoader = true;

    try {
      // 🚀 Load all 3 APIs in parallel
      const [res, info, subDates]: [any, any[], any[]] = await firstValueFrom(
        forkJoin([
          this.rfqService.getRfqById(rfqId),
          this.rfqService.getRfqWorkItems(rfqId),
          this.rfqService.getRfqSubcontractorDueDates(rfqId),
        ]),
      );

      this.originalRfq = res;

      if (!this.originalRfq) {
        this.isLoader = false;
        return;
      }

      // Basic RFQ fields
      this.rfqNumber = this.originalRfq.rfqNumber || 'N/A';
      this.createdDateDisplay = this.formatDateDisplay(this.originalRfq.createdOn);
      this.customNote = this.originalRfq.customNote;
      this.selectedProject = this.originalRfq.projectID;

      // ✅ Correct mapping from API response
      const fixedSubDates = subDates.map((s) => ({
        subcontractorID: s.SubcontractorID || '', // ✅ Uppercase from API
        workItemID: s.WorkItemID || '', // ✅ Uppercase from API
        dueDate: s.DueDate || '', // ✅ Uppercase from API
        globalDueDate: s.GlobalDueDate || '', // ✅ Add GlobalDueDate
      }));

      // 🚀 Use work items directly from backend
      this.selectedWorkItems = info;
      this.workItemName = this.selectedWorkItems.map((w) => w.name).join(', ');

      this.cdr.detectChanges();

      if (this.selectedWorkItems.length) {
        const first = this.selectedWorkItems[0];
        this.selectedTab = this.standardWorkitems.some((w) => w.workItemID === first.workItemID)
          ? 'standard'
          : 'unibouw';
      }

      // 🚀 Single-pass to find earliest date (prioritize GlobalDueDate)
      let earliestDate = '';
      for (const s of fixedSubDates) {
        const date = s.globalDueDate || s.dueDate; // ✅ Use globalDueDate first
        if (date && (!earliestDate || new Date(date) < new Date(earliestDate))) {
          earliestDate = date;
        }
      }
      this.globalDueDate = earliestDate ? earliestDate.split('T')[0] : '';
      // Clear subcontractors
      this.subcontractors = [];

      // 🚀 Pre-build lookup map for faster subcontractor filtering
      const subsByWorkItem = new Map<string, any[]>();
      fixedSubDates.forEach((s) => {
        const key = this.normalizeId(s.workItemID);
        if (!subsByWorkItem.has(key)) subsByWorkItem.set(key, []);
        subsByWorkItem.get(key)!.push(s);
      });

      // Load subcontractors in parallel per work item
      await Promise.all(
        this.selectedWorkItems.map((wi) => {
          const subsForWorkItem = subsByWorkItem.get(this.normalizeId(wi.workItemID)) || [];
          return this.loadSubcontractors(wi.workItemID, subsForWorkItem);
        }),
      );

      // 🚀 Use Set for O(1) lookup
      const selectedWorkItemIds = new Set(
        this.selectedWorkItems.map((w) => this.normalizeId(w.workItemID)),
      );
      this.subcontractors = this.subcontractors.filter((sub) =>
        sub.linkedWorkItemIDs?.some((id) => selectedWorkItemIds.has(id)),
      );

      // Take snapshot for original state
      this.originalSubcontractorState = this.subcontractors.map((s) => ({
        subcontractorID: s.subcontractorID,
        selected: !!s.selected,
        dueDate: s.dueDate,
      }));

      this.isLoader = false;
      this.cdr.detectChanges();
      console.log('🟦 loadRfqForEdit COMPLETED');
    } catch (err) {
      console.error('❌ Error in loadRfqForEdit:', err);
      this.isLoader = false;
    }
  }

  formatDateForHtml(dateStr: string): string {
    if (!dateStr) return '';
    // Take first 10 chars (YYYY-MM-DD)
    return dateStr.substring(0, 10);
  }

  formatDateDisplay(dateString: string | null): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    // Returns 'DD/MM/YYYY'
    return date.toLocaleDateString('en-GB');
  }

  onSubcontractorToggle(sub: any) {
    if (sub.selected) {
      this.saveDraft();

      // Assign date when selected
      if (!sub.dueDate) {
        sub.dueDate = '';
      }
    } else {
      // Clear date when unselected
      sub.dueDate = '';
    }
  }

  todayForHtml(): string {
    const d = new Date();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  async loadSubcontractors(workItemID: string, existingSubs: any[] = []): Promise<void> {
    this.isLoader = true;

    try {
      const { mappings, subs } = await firstValueFrom(
        forkJoin({
          mappings: this.subcontractorService.getSubcontractorWorkItemMappings(),
          subs: this.subcontractorService.getSubcontractors(),
        }),
      );

      const rfqDueDateMap = new Map<string, string>();
      existingSubs.forEach((s) => {
        const subId = this.normalizeId(s.subcontractorID);
        if (subId) rfqDueDateMap.set(subId, this.formatDateForHtml(s.dueDate));
      });

      // Build new subcontractors for this work item
      const newSubsForWorkItem: SubcontractorItem[] = subs.map((s) => ({
        subcontractorID: String(s.subcontractorID ?? ''),
        name: String(s.name ?? ''),
        email: String(s.email ?? ''),
        selected: rfqDueDateMap.has(this.normalizeId(s.subcontractorID)),
        dueDate: rfqDueDateMap.get(this.normalizeId(s.subcontractorID)) ?? '',
        linkedWorkItemIDs: mappings
          .filter(
            (m) => this.normalizeId(m.subcontractorID) === this.normalizeId(s.subcontractorID),
          )
          .map((m) => this.normalizeId(m.workItemID)),
      }));

      // Merge without duplicates
      newSubsForWorkItem.forEach((sub) => {
        if (
          !this.subcontractors.find((existing) => existing.subcontractorID === sub.subcontractorID)
        ) {
          this.subcontractors.push(sub);
        }
      });

      // IMMEDIATE CHANGE DETECTION
      this.subcontractors = [...this.subcontractors];
      this.cdr.detectChanges(); // Force UI update NOW
    } catch (err) {
      console.error('❌ Error loading subcontractors:', err);
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

      // ✅ ONLY email subcontractors that DID NOT EXIST earlier
      return !existedAtCreation;
    });
  }

  saveSubcontractorWorkItemMappings(
    selectedSubs: any[],
    selectedWorkItems: any[],
    rfqId: string, // pass rfqId here
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!selectedSubs.length || !selectedWorkItems.length) {
        resolve();
        return;
      }

      const calls: Observable<any>[] = [];

      selectedWorkItems.forEach((w) => {
        selectedSubs.forEach((s) => {
          if (!s.dueDate) return; // skip if no due date
          calls.push(
            this.rfqService.saveSubcontractorWorkItemMapping(
              w.workItemID,
              s.subcontractorID,
              new Date(s.dueDate).toISOString(),
              rfqId, // pass the rfqId here
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
  // MODIFIED: onSubmit to handle both Create and Update (WITHOUT client-side mapping API call)

  async onSubmit(sendEmail: boolean = false, editedEmailBody: string = '') {
    if (!this.selectedProject) return alert('Select a project first');

    const selectedProject = this.projects.find((p) => p.projectID === this.selectedProject);
    if (!selectedProject) return alert('Project not found');

    const selectedSubs = this.subcontractors.filter((s) => s.selected);
    if (!this.globalDueDate) return alert('Please select the Global Due Date');
    if (!selectedSubs.length) return alert('Select at least one subcontractor');
    if (!this.selectedWorkItems.length) return alert('Select at least one work item');
    if (selectedSubs.some((s) => !s.dueDate))
      return alert('Please select a Due Date for all selected subcontractors.');

    this.isLoader = true;
    const now = new Date().toISOString();
    const isUpdate = !!this.rfqIdForEdit;
    const rfqID = this.rfqIdForEdit || '00000000-0000-0000-0000-000000000000';
    const createdBy = this.originalRfq?.createdBy || 'System';
    const emailBodyToUse = editedEmailBody || this.customNote || '';

    // ✅ RFQ main due date = earliest due date among selected subcontractors
    const primaryDueDate = new Date(
      Math.min(...selectedSubs.map((s) => new Date(s.dueDate!).getTime())),
    )
      .toISOString()
      .split('T')[0]; // keep date only

    // ✅ Map subcontractors → dueDate
    const subcontractorDueDates = selectedSubs.map((s) => ({
      subcontractorID: s.subcontractorID,
      dueDate: new Date(s.dueDate!).toISOString().split('T')[0],
    }));

    let subsToEmail: any[] = [];
    if (sendEmail && this.rfqIdForEdit) {
      // ✅ EDIT MODE → only NEW subcontractors
      subsToEmail = this.getNewOrModifiedSubcontractors();
    }
    /* ---------------- STEP 1: SAVE SUBCONTRACTOR–WORKITEM MAPPINGS ---------------- */
    try {
      if (isUpdate) {
        for (const sub of selectedSubs) {
          for (const work of this.selectedWorkItems) {
            const mapping = subcontractorDueDates.find(
              (d) => d.subcontractorID === sub.subcontractorID,
            );
            const dueDateStr = mapping?.dueDate;
            if (!dueDateStr) {
              alert('Due date missing for subcontractor');
              return;
            }
            await this.rfqService
              .saveOrUpdateRfqSubcontractorMapping(
                rfqID,
                sub.subcontractorID,
                work.workItemID,
                dueDateStr,
              )
              .toPromise();
          }
        }
      } else {
        await this.saveSubcontractorWorkItemMappings(selectedSubs, this.selectedWorkItems, rfqID);
      }
    } catch (err) {
      console.error('Mapping save failed', err);
      alert('Failed to save subcontractor–work item mappings.');
      this.isLoader = false;
      return;
    }

    /* ---------------- STEP 2: BUILD RFQ PAYLOAD ---------------- */
    let sentDateToUse = this.originalRfq?.sentDate || null;
    if (sendEmail) sentDateToUse = now;

    const rfqPayload = {
      rfqID,
      sentDate: sentDateToUse,
      dueDate: primaryDueDate, // earliest subcontractor due date
      GlobalDueDate: new Date(this.globalDueDate!).toISOString().split('T')[0], // USE UI PICK
      rfqSent: sendEmail ? 1 : this.originalRfq?.rfqSent || 0,
      quoteReceived: this.originalRfq?.quoteReceived || 0,
      customerID: selectedProject.customerID,
      projectID: selectedProject.projectID,
      customNote: emailBodyToUse,
      createdBy,
      modifiedBy: isUpdate ? 'System' : null,
      status: sendEmail ? 'Sent' : 'Draft',
      createdOn: this.originalRfq?.createdOn || now,
      modifiedOn: isUpdate ? now : null,
      subcontractorsToEmail: subsToEmail.map((s) => s.subcontractorID),
    };

    console.log('🟦 RFQ PAYLOAD BEFORE SUBMIT:', rfqPayload);

    const subcontractorIds = selectedSubs.map((s) => s.subcontractorID);
    const workItems = this.selectedWorkItems.map((w) => w.workItemID);

    /* ---------------- STEP 3: CALL CREATE / UPDATE ---------------- */
    const request = isUpdate
      ? this.rfqService.updateRfq(
          rfqPayload.rfqID!,
          rfqPayload,
          subcontractorIds,
          workItems,
          sendEmail,
        )
      : this.rfqService.createRfqSimple(
          rfqPayload,
          subcontractorIds,
          workItems,
          emailBodyToUse,
          sendEmail,
          subcontractorDueDates,
        );

    request.subscribe({
      next: () => {
        alert(sendEmail ? 'RFQ sent successfully!' : 'RFQ saved successfully!');
        localStorage.removeItem(this.RFQ_DRAFT_KEY);
        this.isLoader = false;
        this.router.navigate(['/view-projects', this.selectedProject], {
          queryParams: { tab: 'rfq' },
        });
      },
      error: (err) => {
        console.error('RFQ failed', err);
        alert('RFQ failed!');
        this.isLoader = false;
      },
    });
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
  loadProjects() {
    this.projectService.getProjects().subscribe({
      next: (res: projectdetails[]) => {
        this.projects = res || [];
        // Only set selectedProject if not already chosen
        if (!this.selectedProject && this.projects.length) {
          this.selectedProject = this.projects[0].projectID;
        }
      },
      error: (err: any) => console.error('Error loading projects:', err),
    });
  }

  private sortWorkItemsAsc(items: Workitem[]): Workitem[] {
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  async loadCategoriesAndWorkitems1() {
    try {
      this.isLoader = true;

      const categories: WorkitemCategory[] = await lastValueFrom(
        this.workitemService.getCategories(),
      );
      const standardCategory = categories.find((c) => c.categoryName.toLowerCase() === 'standard');
      const unibouwCategory = categories.find((c) => c.categoryName.toLowerCase() === 'unibouw');

      if (!standardCategory || !unibouwCategory) {
        console.error('Required categories not found');
        this.isLoader = false;
        return;
      }

      forkJoin([
        this.workitemService.getWorkitems(standardCategory.categoryID),
        this.workitemService.getWorkitems(unibouwCategory.categoryID),
      ]).subscribe({
        next: ([standard, unibouw]: [Workitem[], Workitem[]]) => {
          this.standardWorkitems = this.sortWorkItemsAsc(standard || []);
          this.unibouwWorkitems = this.sortWorkItemsAsc(unibouw || []);
        },
        error: (err) => {
          console.error('Error loading workitems:', err);
          this.isLoader = false;
        },
        complete: () => {
          this.isLoader = false;
        },
      });
    } catch (err) {
      console.error('Error loading categories:', err);
      this.isLoader = false;
    }
  }

  async loadCategoriesAndWorkitems() {
    this.isLoader = true;

    try {
      const categories: WorkitemCategory[] = await lastValueFrom(
        this.workitemService.getCategories(),
      );

      // Create a map for easy lookup by categoryID
      //const categoryMap = new Map((categories ?? []).map((c) => [c.categoryID, c]));

      // const unibouwCategory = categoryMap.get('1');
      // const standardCategory = categoryMap.get('2');

      // const categoryMap = new Map<number, Category>(
      //   (categories ?? []).map((c) => [c.categoryID, c]),
      // );

      const categoryMap = new Map<number, WorkitemCategory>(
        (categories ?? []).map((c) => [Number(c.categoryID), c]),
      );

      const unibouwCategory = categoryMap.get(1);
      const standardCategory = categoryMap.get(2);

      // Validate required category IDs
      if (!unibouwCategory || !standardCategory) {
        console.error('Required categories not found (categoryID 1 or 2 missing)');
        return;
      }

      const [standard, unibouw] = await lastValueFrom(
        forkJoin([
          this.workitemService.getWorkitems(standardCategory.categoryID),
          this.workitemService.getWorkitems(unibouwCategory.categoryID),
        ]),
      );

      this.standardWorkitems = this.sortWorkItemsAsc(standard ?? []);
      this.unibouwWorkitems = this.sortWorkItemsAsc(unibouw ?? []);
    } catch (err) {
      console.error('Error loading categories or workitems:', err);
    } finally {
      this.isLoader = false;
    }
  }

  /** Simplified safe checker for template bindings */
  isWorkItemSelected(item: Workitem): boolean {
    return this.selectedWorkItems.some((w) => w.workItemID === item.workItemID);
  }

  private subcontractorsByWorkItem = new Map<string, SubcontractorItem[]>();

  onWorkitemToggle(item: Workitem, checked: boolean) {
    const normalizedWorkItemID = this.normalizeId(item.workItemID);

    if (checked) {
      this.saveDraft();

      // Add to selected work items if not already present
      if (!this.selectedWorkItems.some((w) => w.workItemID === item.workItemID)) {
        this.selectedWorkItems.push(item);
      }

      // Load subcontractors for this work item
      this.loadSubcontractors(item.workItemID).then(() => {
        // Store only subcontractors linked to this work item
        const subsForCurrentWorkItem = this.subcontractors
          .filter((sub) => sub.linkedWorkItemIDs?.includes(normalizedWorkItemID))
          .map((sub) => ({ ...sub }));

        this.subcontractorsByWorkItem.set(normalizedWorkItemID, subsForCurrentWorkItem);

        // Merge all subcontractors from selected work items
        const mergedSubs = Array.from(this.subcontractorsByWorkItem.values()).flat();

        // Deduplicate by subcontractorID
        const uniqueSubsMap = new Map<string, any>();
        mergedSubs.forEach((sub) => {
          const subId = this.normalizeId(sub.subcontractorID);
          if (!uniqueSubsMap.has(subId)) {
            uniqueSubsMap.set(subId, { ...sub });
          } else {
            const existing = uniqueSubsMap.get(subId);
            existing.selected = existing.selected || sub.selected;
            if (!existing.dueDate && sub.dueDate) existing.dueDate = sub.dueDate;
          }
        });

        this.subcontractors = Array.from(uniqueSubsMap.values());
      });
    } else {
      // Remove from selected work items
      this.selectedWorkItems = this.selectedWorkItems.filter(
        (w) => w.workItemID !== item.workItemID,
      );

      // Remove subcontractors linked to this work item only
      const subsToRemove = this.subcontractorsByWorkItem.get(normalizedWorkItemID) || [];
      const subsToRemoveIds = subsToRemove.map((sub) => this.normalizeId(sub.subcontractorID));

      this.subcontractors = this.subcontractors.filter((sub) => {
        const subId = this.normalizeId(sub.subcontractorID);
        // Keep if not in removal list OR still used in another work item
        const usedInOtherWorkItem = Array.from(this.subcontractorsByWorkItem.entries()).some(
          ([wid, subs]) =>
            wid !== normalizedWorkItemID &&
            subs.some((s) => this.normalizeId(s.subcontractorID) === subId),
        );
        return !subsToRemoveIds.includes(subId) || usedInOtherWorkItem;
      });

      // Remove from the map
      this.subcontractorsByWorkItem.delete(normalizedWorkItemID);
    }
  }

  loadSubcontractorsForSelectedWorkitems() {
    if (!this.selectedWorkItems.length) {
      this.subcontractors = [];
      // this.noSubMessage = 'Select a work item to view subcontractors.'; // keep default
      return;
    }

    const observables = this.selectedWorkItems.map((w) =>
      this.rfqService.getSubcontractorsByWorkItem(w.workItemID),
    );

    forkJoin(observables).subscribe({
      next: (results: any[][]) => {
        console.log('Subcontractor results for each work item:', results);

        const merged = results.flat();
        const uniqueSubsMap = new Map<string, any>();
        merged.forEach((sub) => {
          if (!uniqueSubsMap.has(sub.subcontractorID)) {
            uniqueSubsMap.set(sub.subcontractorID, { ...sub, selected: false });
          }
        });
        this.subcontractors = Array.from(uniqueSubsMap.values());

        // ✅ Update message: no subcontractors found for selected work items
        if (!this.subcontractors.length) {
          this.noSubMessage = 'No subcontractors found for selected work items.';
        } else {
          this.noSubMessage = ''; // clear the message
        }
      },
      error: (err) => console.error(err),
    });
  }

  onWorkitemSelect(item: Workitem) {
    // Only allow one selection
    this.selectedWorkItems = [item];

    // Reset subcontractors
    this.subcontractors = [];
    this.noSubMessage = 'Loading subcontractors...';

    // Pass existing subcontractor due dates if in edit mode
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
        dueDate: this.globalDueDate || '', // default global date
      };
      this.subcontractors.unshift(newSub); // Add to top
    }
  }

  /* Apply the global due date to all listed subcontractors */

  applyGlobalDate() {
    // Reset error
    this.globalDateError = false;

    // No subcontractor selected → show error & revert date
    if (!this.hasSelectedSubcontractor()) {
      this.globalDateError = true;
      this.saveDraft();

      // 🔥 IMPORTANT: revert the picked date
      this.globalDueDate = '';

      return;
    }

    // No date → nothing to apply
    if (!this.globalDueDate) return;

    // ✅ Apply date to all selected subcontractors
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
  }

  onCancel() {
    this.selectedProject = this.projects.length ? this.projects[0].projectID : '';
    this.selectedTab = 'standard';
    this.selectedWorkItems = [];
    this.subcontractors = [];
  }

  getSelectedCountByTab(tab: 'unibouw' | 'standard'): number {
    const source = tab === 'unibouw' ? this.unibouwWorkitems : this.standardWorkitems;

    return this.selectedWorkItems.filter((sel) =>
      source.some((src) => src.workItemID === sel.workItemID),
    ).length;
  }

  toggleSelectAll() {
  if (!this.selectedWorkItems.length) return;

  const workItemID = this.selectedWorkItems[0].workItemID;
  const wid = this.normalizeId(workItemID);

  if (this.showAll) {
    // ✅ checked -> show all subs for this work item (reload full list)
    this.loadSubcontractors(workItemID);
    return;
  }

  // ✅ unchecked -> show ONLY subs mapped to this work item
  this.subcontractors = (this.subcontractors || []).filter(sub =>
    (sub.linkedWorkItemIDs || []).includes(wid)
  );

  // optional: if none mapped, show message
  this.noSubMessage = this.subcontractors.length ? '' : 'No subcontractors mapped to this work item.';
}
  get selectedSubcontractors() {
    return (this.subcontractors || []).filter((s: any) => s.selected);
  }

  openPreview() {
    if (!this.selectedProject) return alert('Select a project');
    if (!this.selectedWorkItems.length) return alert('Select work item');
    if (!this.selectedSubcontractors.length) return alert('Select subcontractors');

    // 🔹 Map all selected work items
    const workItemNames = this.selectedWorkItems.map((w) => w.name);

    // 🔹 Always assign new object (change detection safe)
    this.previewData = {
      rfqId: this.originalRfq?.rfqNumber || 'RFQ ID will be generated after RFQ save.',
      projectName: this.projectDetails?.name || 'N/A',
      workItems: workItemNames, // ✅ MULTIPLE
      dueDate: this.globalDueDate,
      subcontractors: this.selectedSubcontractors.map((s) => s.name),
    };

    // 🔹 Regenerate email body every time
    this.editedEmailBody = `You are invited to submit a quotation for the following details:`;

    // 🔹 Toggle modal safely
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

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.showPreview) this.closePreview();
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
}
