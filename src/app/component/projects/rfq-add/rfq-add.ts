import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, HostListener } from '@angular/core';
import { forkJoin, lastValueFrom, Observable, ObservableInput } from 'rxjs';
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
  emailID?: string;
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
  customerNote: string = '';
  projectId!: string;
  projectDetails: any;
  rfqIdForEdit: string | null = null;
  originalRfq: any = null;
  rfqNumber: string = 'N/A';
  createdDateDisplay: string = 'N/A'; // DD/MM/YYYY format for display
  workItemName: string = 'N/A';
  globalDateError = false;
  originalRfqSubcontractors: any[] = [];
  constructor(
    private workitemService: WorkitemService,
    private subcontractorService: SubcontractorService,
    private rfqService: RfqService,
    private http: HttpClient,
    private projectService: projectService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private location: Location
  ) {}

  isLoader: boolean = false;
  // minDate: Date = new Date();
  minDate: string = '';

  ngOnInit() {
    const today = new Date();
    this.minDate = today.toISOString().split('T')[0]; // yyyy-MM-dd

    //SHOW DEFAULT MESSAGE ON PAGE LOAD (Add + Edit mode)
    this.noSubMessage = 'Select a work item to view subcontractors.';

    // Load workitems first, as loadRfqForEdit depends on them
    this.loadCategoriesAndWorkitems().then(() => {
      this.projectId = this.route.snapshot.paramMap.get('projectId') || '';
      this.rfqIdForEdit = this.route.snapshot.paramMap.get('rfqId');

      if (this.projectId) {
        this.loadProjectDetails(this.projectId);
        this.selectedProject = this.projectId;
      }

      if (this.rfqIdForEdit) {
        this.loadRfqForEdit(this.rfqIdForEdit);

        //IMPORTANT: Reset the message again in edit mode
        this.noSubMessage = 'Select a work item to view subcontractors.';
      }
    });

    this.loadProjects();
  }

  goBack(): void {
    this.location.back();
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
    // reset state
    this.selectedTab = 'standard';
    this.selectedWorkItems = [];
    this.subcontractors = [];

    if (!this.projectId) {
      console.error('❌ Project ID missing on cancel');
      return;
    }

    // ✅ ALWAYS go back to the SAME project RFQ tab
    this.router.navigate(['view-projects', this.projectId], { queryParams: { tab: 'rfq' } });
  }

  private normalizeId(id: string | null | undefined): string {
    return (id || '').toUpperCase();
  }

  loadRfqForEdit(rfqId: string) {
    this.rfqIdForEdit = rfqId;
    this.isLoader = true;

    this.rfqService.getRfqById(rfqId).subscribe({
      next: (res: any) => {
        this.originalRfq = res;
        if (!this.originalRfq) {
          this.isLoader = false;
          return;
        }

        this.rfqNumber = this.originalRfq.rfqNumber || 'N/A';
        this.createdDateDisplay = this.formatDateDisplay(this.originalRfq.createdOn);
        this.customerNote = this.originalRfq.customerNote;
        this.selectedProject = this.originalRfq.projectID;

        forkJoin([
          this.rfqService.getWorkItemInfo(rfqId),
          this.rfqService.getRfqSubcontractorDueDates(rfqId),
        ]).subscribe({
          next: ([info, subDates]: [any, any[]]) => {
            // Normalize SubcontractorIDs in API response
            const fixedSubDates = subDates.map((s) => ({
              ...s,
              subcontractorID: s.subcontractorID || s.subcontractorId,
              workItemID: s.WorkItemID || s.workItemID,
              dueDate: s.DueDate || s.dueDate,
            }));

            // Find the work item to select
            const allWorkItems = [...this.unibouwWorkitems, ...this.standardWorkitems];
            const workItemToSelect = allWorkItems.find((w) => w.name === info.workItem);

            if (workItemToSelect) {
              this.selectedWorkItems = [workItemToSelect];
              this.workItemName = workItemToSelect.name;
              this.selectedTab = this.standardWorkitems.some(
                (w) => w.workItemID === workItemToSelect.workItemID
              )
                ? 'standard'
                : 'unibouw';

              this.globalDueDate = ''; // Do NOT force globalDueDate in edit mode

              // 🔑 Normalize WorkItemID for filtering
              const existingSubs = fixedSubDates.filter(
                (s) =>
                  this.normalizeId(s.workItemID) === this.normalizeId(workItemToSelect.workItemID)
              );

              this.loadSubcontractors(workItemToSelect.workItemID, existingSubs);
            } else {
              this.selectedWorkItems = [];
              this.workItemName = info.workItem || 'N/A';
              this.subcontractors = [];
            }

            this.isLoader = false;
          },
          error: (err) => {
            console.error('❌ Error loading linked info for RFQ edit:', err);
            this.isLoader = false;
          },
        });
      },
      error: (err: any) => {
        console.error('❌ Error loading RFQ for edit:', err);
        this.isLoader = false;
      },
    });
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
      // Assign date when selected
      if (!sub.dueDate) {
        sub.dueDate = this.globalDueDate || this.todayForHtml();
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

  // End Helpers
  loadSubcontractors(workItemID: string, existingSubs: any[] = []): Promise<void> {
    this.isLoader = true;

    // Normalize existingSubs from API
    const normalizedExistingSubs = existingSubs.map((s) => ({
      workItemID: s.WorkItemID, // match API field casing
      subcontractorID: s.SubcontractorID,
      dueDate: s.DueDate, // keep original API field
    }));

    return new Promise((resolve, reject) => {
      forkJoin({
        mappings: this.subcontractorService.getSubcontractorWorkItemMappings(),
        subs: this.subcontractorService.getSubcontractors(),
      }).subscribe({
        next: ({ mappings, subs }) => {
          const normalizedWorkItemID = this.normalizeId(workItemID);

          // Map existing subcontractor DueDates
          const rfqDueDateMap = new Map<string, string>();
          normalizedExistingSubs.forEach((s) => {
            const subId = this.normalizeId(s.subcontractorID);
            rfqDueDateMap.set(subId, this.formatDateForHtml(s.dueDate));
          });

          // Linked subcontractor IDs for this work item
          const linkedIds = mappings
            .filter((m) => this.normalizeId(m.workItemID) === normalizedWorkItemID)
            .map((m) => this.normalizeId(m.subcontractorID));

          // Build final subcontractor list
          let mappedSubcontractors = subs.map((s) => {
            const subId = this.normalizeId(s.subcontractorID);
            const rfqDueDate = rfqDueDateMap.get(subId);

            // Check if user already has selection (existing UI) for this sub
            const existingUI = existingSubs.find(
              (e) => this.normalizeId(e.subcontractorID) === subId
            );

            const subcontractorItem = {
              subcontractorID: s.subcontractorID,
              name: s.name,
              // ✅ Fix TS5076: wrap `??` and `||` in parentheses
              selected:
                (existingUI?.selected ?? rfqDueDateMap.has(subId)) || linkedIds.includes(subId),
              dueDate: existingUI?.dueDate ?? rfqDueDate ?? '',
            };

            console.log(
              '🔹 Subcontractor:',
              subcontractorItem.name,
              'dueDate:',
              subcontractorItem.dueDate
            );

            return subcontractorItem;
          });

          // Apply "Show All" toggle
          if (!this.showAll) {
            mappedSubcontractors = mappedSubcontractors.filter(
              (s) => s.selected || linkedIds.includes(this.normalizeId(s.subcontractorID))
            );
          }

          // Sort selected first
          mappedSubcontractors.sort((a, b) => {
            if (a.selected && !b.selected) return -1;
            if (!a.selected && b.selected) return 1;
            return a.name.localeCompare(b.name);
          });

          this.subcontractors = mappedSubcontractors;
          this.noSubMessage = this.subcontractors.length
            ? ''
            : 'No subcontractors linked to this work item.';
          this.isLoader = false;

          resolve();
        },
        error: (err) => {
          console.error('❌ Error loading subcontractors:', err);
          this.noSubMessage = 'Failed to load subcontractors.';
          this.isLoader = false;
          reject(err);
        },
      });
    });
  }

  getNewOrModifiedSubcontractors(): any[] {
    return this.subcontractors.filter((sub) => {
      const originalSub = this.originalRfq?.subcontractors?.find(
        (s: { subcontractorID: string }) => s.subcontractorID === sub.subcontractorID
      );

      const existedBefore = !!originalSub;

      const dueDateChanged =
        existedBefore &&
        sub.dueDate && // check current dueDate exists
        originalSub?.dueDate && // check original dueDate exists
        new Date(sub.dueDate).toISOString() !== new Date(originalSub.dueDate).toISOString();

      return sub.selected && (!existedBefore || dueDateChanged);
    });
  }

  saveSubcontractorWorkItemMappings(
    selectedSubs: any[],
    selectedWorkItems: any[],
    rfqId: string // pass rfqId here
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
              rfqId // pass the rfqId here
            )
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
    if (!selectedSubs.length) return alert('Select at least one subcontractor');
    if (!this.selectedWorkItems.length) return alert('Select at least one work item');
    if (selectedSubs.some((s) => !s.dueDate))
      return alert('Please select a Due Date for all selected subcontractors.');

    this.isLoader = true;
    const now = new Date().toISOString();
    const isUpdate = !!this.rfqIdForEdit;
    const rfqID = this.rfqIdForEdit || '00000000-0000-0000-0000-000000000000';
    const createdBy = this.originalRfq?.createdBy || 'System';
    const emailBodyToUse = editedEmailBody || this.customerNote || '';

    // RFQ main due date = earliest due date among selected subcontractors
    const primaryDueDate = new Date(
      Math.min(...selectedSubs.map((s) => new Date(s.dueDate!).getTime()))
    ).toISOString();

    // Build subcontractor → dueDate map
    const subcontractorDueDates = selectedSubs.map((s) => ({
      subcontractorID: s.subcontractorID,
      dueDate: new Date(s.dueDate!).toISOString().split('T')[0],
    }));

    let subsToEmail: any[] = [];
    if (sendEmail) subsToEmail = this.getNewOrModifiedSubcontractors();

    /* ---------------- STEP 1: SAVE SUBCONTRACTOR–WORKITEM MAPPINGS ---------------- */
    try {
      if (isUpdate) {
        // Update → save each mapping individually
        for (const sub of selectedSubs) {
          for (const work of this.selectedWorkItems) {
            const mapping = subcontractorDueDates.find(
              (d) => d.subcontractorID === sub.subcontractorID
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
                dueDateStr
              )
              .toPromise();
          }
        }
      } else {
        // Create → batch save method
        await this.saveSubcontractorWorkItemMappings(selectedSubs, this.selectedWorkItems, rfqID);
      }
    } catch (err) {
      console.error('Mapping save failed', err);
      alert('Failed to save subcontractor–work item mappings.');
      this.isLoader = false;
      return;
    }

    /* ---------------- STEP 2: BUILD RFQ PAYLOAD ---------------- */
    const rfqPayload = {
      rfqID,
      sentDate: sendEmail ? now : this.originalRfq?.sentDate || null,
      dueDate: primaryDueDate,
      deadLine: primaryDueDate,
      rfqSent: sendEmail ? 1 : this.originalRfq?.rfqSent || 0,
      quoteReceived: this.originalRfq?.quoteReceived || 0,
      customerID: selectedProject.customerID,
      projectID: this.projectId,
      customerNote: emailBodyToUse,
      createdBy,
      modifiedBy: isUpdate ? 'System' : null,
      status: sendEmail ? 'Sent' : 'Draft',
      createdOn: this.originalRfq?.createdOn || now,
      modifiedOn: isUpdate ? now : null,
      GlobalDueDate: this.globalDueDate || primaryDueDate,
      subcontractorsToEmail: subsToEmail.map((s) => s.subcontractorID),
    };

    const subcontractorIds = selectedSubs.map((s) => s.subcontractorID);
    const workItems = this.selectedWorkItems.map((w) => w.workItemID);

    /* ---------------- STEP 3: CALL CREATE / UPDATE ---------------- */
    const request = isUpdate
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

    request.subscribe({
      next: () => {
        alert(sendEmail ? 'RFQ sent successfully!' : 'RFQ saved successfully!');
        this.isLoader = false;
        this.router.navigate(['/view-projects', this.projectId], { queryParams: { tab: 'rfq' } });
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
        if (this.projects.length) {
          this.selectedProject = this.projects[0].projectID;
        }
      },
      error: (err: any) => console.error('Error loading projects:', err),
    });
  }

  private sortWorkItemsAsc(items: Workitem[]): Workitem[] {
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  async loadCategoriesAndWorkitems() {
    try {
      this.isLoader = true;

      const categories: WorkitemCategory[] = await lastValueFrom(
        this.workitemService.getCategories()
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

  /** Simplified safe checker for template bindings */
  isWorkItemSelected(item: Workitem): boolean {
    return this.selectedWorkItems.some((w) => w.workItemID === item.workItemID);
  }

  onWorkitemToggle(item: Workitem, checked: boolean) {
    if (checked) {
      if (!this.selectedWorkItems.some((w) => w.workItemID === item.workItemID)) {
        this.selectedWorkItems.push(item);
      }
    } else {
      this.selectedWorkItems = this.selectedWorkItems.filter(
        (w) => w.workItemID !== item.workItemID
      );
    }

    // ✅ Load only the toggled work item
    this.loadSubcontractors(item.workItemID);
  }

  loadSubcontractorsForSelectedWorkitems() {
    if (!this.selectedWorkItems.length) {
      this.subcontractors = [];
      this.noSubMessage = 'Select a work item to view subcontractors.'; // keep default
      return;
    }

    const observables = this.selectedWorkItems.map((w) =>
      this.rfqService.getSubcontractorsByWorkItem(w.workItemID)
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
        emailID: '',
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
      source.some((src) => src.workItemID === sel.workItemID)
    ).length;
  }

  toggleSelectAll() {
    // Just reload the subcontractors to refresh the list
    if (!this.selectedWorkItems.length) return;

    const workItemID = this.selectedWorkItems[0].workItemID;
    this.loadSubcontractors(
      workItemID,
      this.rfqIdForEdit ? this.subcontractors.filter((s) => s.selected) : undefined
    );
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
      rfqId: this.originalRfq?.rfqNumber || 'RFQ ID will be generated once saved',
      projectName: this.projectDetails?.name || 'N/A',
      workItems: workItemNames, // ✅ MULTIPLE
      dueDate: this.globalDueDate,
      subcontractors: this.selectedSubcontractors.map((s) => s.name),
    };

    // 🔹 Regenerate email body every time
    this.editedEmailBody = `Dear [Subcontractor],

You are invited to submit a quotation for the following work item(s):

${workItemNames.map((w) => `• ${w}`).join('\n')}

Project: ${this.projectDetails?.name}
Due Date: ${this.globalDueDate}
`;

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

    if (!projectName || !projectID) {
      console.error('Project name or ID missing');
      return;
    }

    // Navigate to add-subcontractor with projectID and projectName
    this.router.navigate(['/add-subcontractor', projectID, projectName]);
  }
}
