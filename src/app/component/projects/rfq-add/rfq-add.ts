  import { HttpClient, HttpParams } from '@angular/common/http';
  import { Component, HostListener } from '@angular/core';
  import { forkJoin, lastValueFrom, Observable } from 'rxjs';
  import { Subcontractors, SubcontractorService } from '../../../services/subcontractor.service';
  import { Workitem, WorkitemCategory, WorkitemService } from '../../../services/workitem.service';
  import { Rfq, RfqService } from '../../../services/rfq.service';
  import { projectdetails,projectService } from '../../../services/project.service';
  import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../confirm-dialog-component/confirm-dialog-component';


  interface SubcontractorItem {
    subcontractorID: string;
    name: string;
    selected?: boolean;
    dueDate?: string;     // Added for the Date Picker
    category?: string;    // specific fields you might need
    personName?: string;
    phoneNumber1?: string;
    emailID?: string;
  }

  @Component({
    selector: 'app-rfq-add',
    standalone: false,
    templateUrl: './rfq-add.html',
    styleUrl: './rfq-add.css'
  })
  export class RfqAdd {
  projects: any[] = [];
    selectedProject: string = '';
    selectedTab: 'standard' | 'unibouw' = 'unibouw';
      globalDueDate: string = ''; 
  createdDate: Date = new Date();
    selectedDueDate: string = '';
    standardWorkitems: Workitem[] = [];
    unibouwWorkitems: Workitem[] = [];
    selectedWorkItems: Workitem[] = [];
      subcontractors: SubcontractorItem[] = []; 
    showPreview = false;
  previewData: any = null;
  noSubMessage: string = "";
editedEmailBody: string = '';

    // subcontractors: (Subcontractors & { selected?: boolean })[] = [];
    showAll: boolean = false;
    customerNote: string = '';
  projectId!: string;
  projectDetails: any;
  rfqIdForEdit: string | null = null;
    originalRfq: any = null;
    rfqNumber: string = 'N/A';
    createdDateDisplay: string = 'N/A'; // DD/MM/YYYY format for display
    workItemName: string = 'N/A';
    constructor(
      private workitemService: WorkitemService,
      private subcontractorService: SubcontractorService,
      private rfqService: RfqService,
      private http: HttpClient,
      private projectService: projectService,
        private route: ActivatedRoute  ,
        private router: Router,
          private dialog: MatDialog


    ) {}

    isLoader: boolean = false;

  ngOnInit() {
    // ⬅ SHOW DEFAULT MESSAGE ON PAGE LOAD (Add + Edit mode)
    this.noSubMessage = "Select a work item to view subcontractors.";

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

        // ⭐ IMPORTANT: Reset the message again in edit mode
        this.noSubMessage = "Select a work item to view subcontractors.";
      }
    });

    this.loadProjects();
  }

  confirmCancel() {
  const dialogRef = this.dialog.open(ConfirmDialogComponent, {
    width: '350px',

    // ✅ THIS IS THE KEY
    position: {
      top: '10%',
      right:'35%'
    },
    panelClass: 'center-dialog',

    data: {
      title: 'Confirm',
      message: 'Discard all changes?'
    }
  });

  dialogRef.afterClosed().subscribe(result => {
    if (result === true) {
      this.onCancelConfirmed();
    }
  });
}


onCancelConfirmed() {
  const projectId =
    this.projects.length ? this.projects[0].projectID : null;

  // reset state
  this.selectedProject = projectId;
  this.selectedTab = 'standard';
  this.selectedWorkItems = [];
  this.subcontractors = [];

  if (projectId) {
this.router.navigate(['view-projects', projectId], {
  queryParams: { tab: 'rfq' }
});  }
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
        this.rfqService.getRfqSubcontractorDueDates(rfqId)
      ]).subscribe({
        next: ([info, subDates]: [any, any[]]) => {

          const fixedSubDates = subDates.map(s => ({
            ...s,
            subcontractorID: s.subcontractorID || s.subcontractorId
          }));

          const allWorkItems = [...this.unibouwWorkitems, ...this.standardWorkitems];
          const workItemToSelect = allWorkItems.find(w => w.name === info.workItem);

        if (workItemToSelect) {
  // ✅ Ensure selectedWorkItems is set correctly
  this.selectedWorkItems = [workItemToSelect];
  this.workItemName = workItemToSelect.name;

  const isStandard = this.standardWorkitems.some(
    w => w.workItemID === workItemToSelect.workItemID
  );
  this.selectedTab = isStandard ? 'standard' : 'unibouw';

 this.globalDueDate = this.formatDateForHtml(this.originalRfq.dueDate);

  // ✅ Pass existing subcontractor due dates
  const existingSubs = fixedSubDates.filter(s => s.workItemID === workItemToSelect.workItemID);
  this.loadSubcontractors(workItemToSelect.workItemID, existingSubs);
}
 else {
  this.workItemName = info.workItem || 'N/A';
  this.selectedWorkItems = [];
  this.subcontractors = [];
}


          // ❌ REMOVE THE WRONG CALL
          // this.loadSubcontractors(res.workitemID, res.subcontractors);

          this.isLoader = false;
        },
        error: (err) => {
          console.error("❌ Error loading linked info for RFQ edit:", err);
          this.isLoader = false;
        }
      });
    },
    error: (err: any) => {
      console.error("❌ Error loading RFQ for edit:", err);
      this.isLoader = false;
    }
  });
}


    // ⭐ New/Modified Helpers
    // formatDateForHtml(dateString: string | null): string {
    //     if (!dateString) return '';
    //     const date = new Date(dateString);
    //     return date.toISOString().split('T')[0];
    // }

    formatDateForHtml(dateString: string | null): string {
  if (!dateString) return '';

  const date = new Date(dateString);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}


    formatDateDisplay(dateString: string | null): string {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        // Returns 'DD/MM/YYYY'
        return date.toLocaleDateString('en-GB'); 
    }
    // End Helpers
loadSubcontractors(
  workItemIDs: string | string[],
  existingSubs?: any[]
): Promise<void> {
  return new Promise((resolve) => {
    this.isLoader = true;

    const ids: string[] = Array.isArray(workItemIDs)
      ? workItemIDs
      : [workItemIDs];

    if (!ids.length) {
      this.subcontractors = [];
      this.noSubMessage = 'Select a work item to view subcontractors.';
      this.isLoader = false;
      resolve();
      return;
    }

    forkJoin({
      mappings: this.subcontractorService.getSubcontractorWorkItemMappings(),
      subs: this.subcontractorService.getSubcontractors()
    }).subscribe({
      next: ({ mappings, subs }) => {
        const normalize = (id: string) => (id || '').toUpperCase();
        const isEditMode = existingSubs && existingSubs.length > 0;

        const selectedWorkItemIds = ids.map(id => normalize(id));

        // 🔗 All subcontractors linked to selected work items
        const linkedIds = mappings
          .filter((m: any) =>
            selectedWorkItemIds.includes(normalize(m.workItemID))
          )
          .map((m: any) => normalize(m.subcontractorID));

        // 🧩 Existing RFQ subcontractors (edit mode)
        const existingMap = new Map<string, string>();
        (existingSubs || []).forEach(s => {
          const exId = normalize(s.subcontractorID || s.subcontractorId);
          existingMap.set(exId, this.formatDateForHtml(s.dueDate));
        });

        let mappedSubcontractors: SubcontractorItem[] = subs.map(s => {
          const id = normalize(s.subcontractorID);
          const isSelected = isEditMode ? existingMap.has(id) : false;

          return {
            subcontractorID: s.subcontractorID,
            name: s.name,
            selected: isSelected,
            dueDate: isSelected
              ? existingMap.get(id)
              : this.globalDueDate || ''
          };
        });

        // 🔍 Filter if showAll is OFF
        if (!this.showAll) {
          mappedSubcontractors = mappedSubcontractors.filter(
            s => s.selected || linkedIds.includes(normalize(s.subcontractorID))
          );
        }

        // 🔼 Selected first, then name
        mappedSubcontractors.sort((a, b) => {
          if (a.selected && !b.selected) return -1;
          if (!a.selected && b.selected) return 1;
          return a.name.localeCompare(b.name);
        });

        this.subcontractors = mappedSubcontractors;

        this.noSubMessage = this.subcontractors.length
          ? ''
          : 'No subcontractors linked to selected work items.';
      },
      error: (err) => {
        console.error(err);
        this.noSubMessage = 'Failed to load subcontractors.';
      },
      complete: () => {
        this.isLoader = false;
        resolve();
      }
    });
  });
}



// ⭐ MODIFIED: onSubmit to handle both Create and Update (WITHOUT client-side mapping API call)
onSubmit(sendEmail: boolean = false, editedEmailBody: string = '') {
  if (!this.selectedProject) return alert('Select a project first');

  const selectedProject = this.projects.find(p => p.projectID === this.selectedProject);
  if (!selectedProject) return alert('Project not found');

  const selectedSubs = this.subcontractors.filter(s => s.selected);
  if (!selectedSubs.length) return alert('Select at least one subcontractor');
  if (!this.selectedWorkItems.length) return alert('Select at least one work item');
  if (selectedSubs.some(s => !s.dueDate)) return alert('Please select a Due Date for all selected subcontractors.');

  const now = new Date().toISOString();
  const primaryDueDate = new Date(selectedSubs[0].dueDate!).toISOString();

  const isUpdate = !!this.rfqIdForEdit;
  const rfqID = this.rfqIdForEdit || '00000000-0000-0000-0000-000000000000';
  const createdBy = this.originalRfq?.createdBy || 'System';

  // ✅ Ensure email body goes into rfq.CustomerNote
  const emailBodyToUse = editedEmailBody || this.customerNote || '';

  const rfqPayload = {
    rfqID: rfqID,
    sentDate: sendEmail ? now : this.originalRfq?.sentDate || null,
    dueDate: primaryDueDate,
    rfqSent: sendEmail ? 1 : this.originalRfq?.rfqSent || 0,
    quoteReceived: this.originalRfq?.quoteReceived || 0,
    customerID: selectedProject.customerID,
    projectID: this.projectId,
    customerNote: emailBodyToUse, // ✅ important for draft/save
    deadLine: primaryDueDate,
    createdBy: createdBy,
    modifiedBy: isUpdate ? 'System' : null,
    status: sendEmail ? 'Sent' : 'Draft',
    createdOn: this.originalRfq?.createdOn || now,
    modifiedOn: isUpdate ? now : this.originalRfq?.modifiedOn || null,
 GlobalDueDate: this.globalDueDate || primaryDueDate
  };

  const subcontractorIds = selectedSubs.map(s => s.subcontractorID);
  const workItems = this.selectedWorkItems.map(w => w.workItemID);

  this.isLoader = true;

  const request = isUpdate
    ? this.rfqService.updateRfq(
        rfqPayload.rfqID,
        rfqPayload,
        subcontractorIds,
        workItems,
        sendEmail,
        emailBodyToUse
      )
    :this.rfqService.createRfqSimple(
  rfqPayload,
  subcontractorIds,
  workItems,
 emailBodyToUse,     // ✔ correct email body
  sendEmail    );

  request.subscribe({
    next: (res) => {
      alert(sendEmail ? 'RFQ sent successfully!' : 'RFQ saved successfully!');
      this.isLoader = false;
  this.router.navigate(['/view-projects', this.projectId], {
        queryParams: { tab: 'rfq' }
      });    },
    error: (err) => {
      console.error(err);
      alert('RFQ failed!');
      this.isLoader = false;
    }
  });
}

  loadProjectDetails(id: string) {
    this.projectService.getProjectById(id).subscribe({
      next: (res) => {
        this.projectDetails = res;
        console.log("➡ Project Details Loaded:", res);
      },
      error: (err) => {
        console.error("❌ Error loading project:", err);
      }
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
        error: (err: any) => console.error('Error loading projects:', err)
      });
    }

    async loadCategoriesAndWorkitems() {
      try {
        const categories: WorkitemCategory[] = await lastValueFrom(this.workitemService.getCategories());
        const standardCategory = categories.find(c => c.categoryName.toLowerCase() === 'standard');
        const unibouwCategory = categories.find(c => c.categoryName.toLowerCase() === 'unibouw');

        if (!standardCategory || !unibouwCategory) {
          console.error('Required categories not found');
          return;
        }

        forkJoin([
          this.workitemService.getWorkitems(standardCategory.categoryID),
          this.workitemService.getWorkitems(unibouwCategory.categoryID)
        ]).subscribe({
          next: ([standard, unibouw]: [Workitem[], Workitem[]]) => {
            this.standardWorkitems = standard || [];
            this.unibouwWorkitems = unibouw || [];
          },
          error: (err) => console.error('Error loading workitems:', err)
        });
      } catch (err) {
        console.error('Error loading categories:', err);
      }
    }

    /** ✅ Simplified safe checker for template bindings */
   isWorkItemSelected(item: Workitem): boolean {
  return this.selectedWorkItems.some(w => w.workItemID === item.workItemID);
}
 onWorkitemToggle(item: Workitem, checked: boolean) {
  if (checked) {
    if (!this.selectedWorkItems.some(w => w.workItemID === item.workItemID)) {
      this.selectedWorkItems.push(item);
    }
  } else {
    this.selectedWorkItems = this.selectedWorkItems.filter(
      w => w.workItemID !== item.workItemID
    );
  }

  const workItemIds = this.selectedWorkItems.map(w => w.workItemID);

  this.loadSubcontractors(workItemIds);
}



loadSubcontractorsForSelectedWorkitems() {
  if (!this.selectedWorkItems.length) {
    this.subcontractors = [];
    this.noSubMessage = "Select a work item to view subcontractors."; // keep default
    return;
  }

  const observables = this.selectedWorkItems.map(w =>
    this.rfqService.getSubcontractorsByWorkItem(w.workItemID)
  );

  forkJoin(observables).subscribe({
    next: (results: any[][]) => {
          console.log('Subcontractor results for each work item:', results);

      const merged = results.flat();
      const uniqueSubsMap = new Map<string, any>();
      merged.forEach(sub => {
        if (!uniqueSubsMap.has(sub.subcontractorID)) {
          uniqueSubsMap.set(sub.subcontractorID, { ...sub, selected: false });
        }
      });
      this.subcontractors = Array.from(uniqueSubsMap.values());

      // ✅ Update message: no subcontractors found for selected work items
      if (!this.subcontractors.length) {
        this.noSubMessage = "No subcontractors found for selected work items.";
      } else {
        this.noSubMessage = ""; // clear the message
      }
    },
    error: err => console.error(err)
  });
}

onWorkitemSelect(item: Workitem) {
  // Only allow one selection
  this.selectedWorkItems = [item];

  // Reset subcontractors
  this.subcontractors = [];
  this.noSubMessage = "Loading subcontractors...";

  // ✅ Pass existing subcontractor due dates if in edit mode
  const existingSubs = this.originalRfq
    ? this.originalRfq.subcontractors?.filter((s: any) =>
        s.workItemID === item.workItemID
      )
    : [];

  this.loadSubcontractors(item.workItemID, existingSubs).then(() => {
    this.noSubMessage = this.subcontractors.length
      ? ""
      : "No subcontractors linked to this work item.";
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
          dueDate: this.globalDueDate || '' // default global date
        };
        this.subcontractors.unshift(newSub); // Add to top
      }
    }

    // ✅ 5. Function to apply top date to all rows
    // applyGlobalDate() {
    //   if (this.globalDueDate) {
    //     this.subcontractors.forEach(sub => {
    //       sub.dueDate = this.globalDueDate;
    //     });
    //   }
    // }

 /** Apply the global due date to all listed subcontractors */
applyGlobalDate() {
  if (!this.globalDueDate) return;

  this.subcontractors.forEach(sub => {
    sub.dueDate = this.globalDueDate; // always update listed subcontractor
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
  const source =
    tab === 'unibouw'
      ? this.unibouwWorkitems
      : this.standardWorkitems;

  return this.selectedWorkItems.filter(sel =>
    source.some(src => src.workItemID === sel.workItemID)
  ).length;
}


toggleSelectAll() {
  // Just reload the subcontractors to refresh the list
  if (!this.selectedWorkItems.length) return;

  const workItemID = this.selectedWorkItems[0].workItemID;
  this.loadSubcontractors(workItemID, this.rfqIdForEdit ? this.subcontractors.filter(s => s.selected) : undefined);
}
  get selectedSubcontractors() {
      return (this.subcontractors || []).filter((s: any) => s.selected);
    }
openPreview() {
  if (!this.selectedProject) return alert("Select a project");
  if (!this.selectedWorkItems.length) return alert("Select work item");
  if (!this.selectedSubcontractors.length) return alert("Select subcontractors");

  // 🔹 Map all selected work items
  const workItemNames = this.selectedWorkItems.map(w => w.name);

  // 🔹 Always assign new object (change detection safe)
  this.previewData = {
    rfqId: this.originalRfq?.rfqNumber || 'RFQ ID will be generated once saved',
    projectName: this.projectDetails?.name || 'N/A',
    workItems: workItemNames,   // ✅ MULTIPLE
    dueDate: this.globalDueDate,
    subcontractors: this.selectedSubcontractors.map(s => s.name),
  };

  // 🔹 Regenerate email body every time
  this.editedEmailBody =
`Dear [Subcontractor],

You are invited to submit a quotation for the following work item(s):

${workItemNames.map(w => `• ${w}`).join('\n')}

Project: ${this.projectDetails?.name}
Due Date: ${this.globalDueDate}
`;

  // 🔹 Toggle modal safely
  this.showPreview = false;
  setTimeout(() => {
    this.showPreview = true;
    document.body.style.overflow = "hidden";
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

addSub(){
  this.router.navigate(['/add-subcontractor']);

}

  }
