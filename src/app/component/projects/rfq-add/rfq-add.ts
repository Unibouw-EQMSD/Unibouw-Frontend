  import { HttpClient, HttpParams } from '@angular/common/http';
  import { Component, HostListener } from '@angular/core';
  import { forkJoin, lastValueFrom, Observable } from 'rxjs';
  import { Subcontractors, SubcontractorService } from '../../../services/subcontractor.service';
  import { Workitem, WorkitemCategory, WorkitemService } from '../../../services/workitem.service';
  import { Rfq, RfqService } from '../../../services/rfq.service';
  import { projectdetails,projectService } from '../../../services/project.service';
  import { ActivatedRoute, Router } from '@angular/router';


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
        private router: Router

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
 loadRfqForEdit(rfqId: string) {
  this.rfqIdForEdit = rfqId;
  this.isLoader = true;

  this.rfqService.getRfqById(rfqId).subscribe({
    next: (res: any) => {
      this.originalRfq = res.data;

      if (!this.originalRfq) {
        this.isLoader = false;
        return;
      }

      // Set header fields
      this.rfqNumber = this.originalRfq.rfqNumber || 'N/A';
      this.createdDateDisplay = this.formatDateDisplay(this.originalRfq.createdOn);
      this.customerNote = this.originalRfq.customerNote;
      this.selectedProject = this.originalRfq.projectID;

      forkJoin([
        this.rfqService.getWorkItemInfo(rfqId),
        this.rfqService.getRfqSubcontractorDueDates(rfqId)
      ]).subscribe({
        next: ([info, subDates]: [any, any[]]) => {

          // 🔥 FIX: Normalize existing subcontractor IDs
          const fixedSubDates = subDates.map(s => ({
            ...s,
            subcontractorID: s.subcontractorID || s.subcontractorId  // <-- FIX
          }));

          const allWorkItems = this.unibouwWorkitems.concat(this.standardWorkitems);
          const workItemToSelect = allWorkItems.find(w => w.name === info.workItem);

          if (workItemToSelect) {
            this.selectedWorkItems = [workItemToSelect];
            this.workItemName = workItemToSelect.name;

            const isStandard = this.standardWorkitems.some(
              w => w.workItemID === workItemToSelect.workItemID
            );
            this.selectedTab = isStandard ? 'standard' : 'unibouw';

            this.globalDueDate = this.formatDateForHtml(this.originalRfq.dueDate);

            // 🔥 FIX: Pass the corrected subcontractor list
            this.loadSubcontractors(workItemToSelect.workItemID, fixedSubDates);

          } else {
            this.workItemName = info.workItem || 'N/A';
            this.selectedWorkItems = [];
            this.subcontractors = [];
          }

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
    formatDateForHtml(dateString: string | null): string {
        if (!dateString) return '';
        const date = new Date(dateString);
        // Returns 'YYYY-MM-DD' for HTML input type="date"
        return date.toISOString().split('T')[0];
    }

    formatDateDisplay(dateString: string | null): string {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        // Returns 'DD/MM/YYYY'
        return date.toLocaleDateString('en-GB'); 
    }
    // End Helpers
loadSubcontractors(workItemID: string, existingSubs?: any[]) {
  this.isLoader = true;

  forkJoin({
    mappings: this.subcontractorService.getSubcontractorWorkItemMappings(),
    subs: this.subcontractorService.getSubcontractors()
  }).subscribe(({ mappings, subs }) => {
    const isEditMode = existingSubs && existingSubs.length > 0;

    const normalize = (id: string) => (id || "").toUpperCase();

    const linkedIds = mappings
      .filter((m: any) => normalize(m.workItemID) === normalize(workItemID))
      .map((m: any) => normalize(m.subcontractorID));

    const existingMap = new Map<string, string>();
    (existingSubs || []).forEach(s => {
      const exId = normalize(s.subcontractorID || s.subcontractorId);
      existingMap.set(exId, this.formatDateForHtml(s.dueDate));
    });

    let mappedSubcontractors = subs.map(s => {
      const id = normalize(s.subcontractorID);

      const isSelected = isEditMode
        ? existingMap.has(id)
        : linkedIds.includes(id);

      return {
        subcontractorID: s.subcontractorID,
        name: s.name,
        selected: isSelected,
        dueDate: isSelected
          ? (isEditMode ? existingMap.get(id) : this.globalDueDate)
          : '',
      } as SubcontractorItem;
    });
mappedSubcontractors = mappedSubcontractors.sort((a, b) => {
  if (a.selected && !b.selected) return -1;
  if (!a.selected && b.selected) return 1;
  return a.name.localeCompare(b.name);
});
    console.log('Mapped subcontractors:', mappedSubcontractors);

    // 🔥 Always assign full list first (important)
    this.subcontractors = mappedSubcontractors;

    // 🔥 Apply filtering after 1 tick → checkbox states preserved
    setTimeout(() => {
  if (!this.showAll) {
    this.subcontractors = mappedSubcontractors.filter(s =>
      s.selected || linkedIds.includes(normalize(s.subcontractorID))
    );
  }

  // Update noSubMessage based on filtered list
  this.noSubMessage = this.subcontractors.length
    ? ''
    : isEditMode
      ? "No subcontractors linked to this work item."
      : "No subcontractors linked to this work item.";
}, 0);
    this.noSubMessage = mappedSubcontractors.length
      ? ''
      : isEditMode
        ? "No subcontractors linked to this work item."
        : "Select a work item to view subcontractors.";

    this.isLoader = false;
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
    projectID: this.selectedProject,
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
  const workItemIds = this.selectedWorkItems.map(w => w.workItemID);

  this.isLoader = true;

  const request = isUpdate
    ? this.rfqService.updateRfq(
        rfqPayload.rfqID,
        rfqPayload,
        subcontractorIds,
        workItemIds,
        sendEmail,
        emailBodyToUse
      )
    :this.rfqService.createRfqSimple(
  rfqPayload,
  subcontractorIds,
  workItemIds,
 emailBodyToUse,     // ✔ correct email body
  sendEmail    );

  request.subscribe({
    next: (res) => {
      alert(sendEmail ? 'RFQ sent successfully!' : 'RFQ saved successfully!');
      this.isLoader = false;
      this.router.navigate(['/view-projects', this.projectId]);
    },
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

    /** Toggle work item selection */
    onWorkitemSelect(item: Workitem) {
      const index = this.selectedWorkItems.findIndex(w => w.workItemID === item.workItemID);
      if (index === -1) {
        this.selectedWorkItems.push(item);
        this.loadSubcontractors(item.workItemID);
      } else {
        this.selectedWorkItems.splice(index, 1);
      }
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
          selected: true,
          dueDate: this.globalDueDate || ''
        };
        this.subcontractors.unshift(newSub); // Add to top
      }
    }

    // ✅ 5. Function to apply top date to all rows
    applyGlobalDate() {
      if (this.globalDueDate) {
        this.subcontractors.forEach(sub => {
          sub.dueDate = this.globalDueDate;
        });
      }
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

  const selectedProject = this.projects.find(p => p.projectID === this.selectedProject);

  const workItem = this.selectedWorkItems[0];

  // preview fields
  this.previewData = {
    rfqId: this.originalRfq?.rfqNumber || 'RFQ ID will be generated once saved',
    projectName: selectedProject?.name ?? '',
    workItemName: workItem.name,
    dueDate: this.globalDueDate ,
    subcontractors: this.selectedSubcontractors.map(s => s.name),
  };

  // CLEAN email body text (no leading spaces)
  this.editedEmailBody = 
`Dear Subcontractor,

You have been invited to participate in a Quote Request (RFQ). 

Please indicate your interest for the following work item:`; 

  this.showPreview = true;
  document.body.style.overflow = "hidden";
}

  closePreview() {
      this.showPreview = false;
      document.body.style.overflow = '';
    }

  @HostListener('document:keydown.escape')
    onEsc() {
      if (this.showPreview) this.closePreview();
    }

// confirmAndSend() {
//   if (!this.previewData) return;

//   const sendEmail = true; // user confirmed send

//   // Prepare updated RFQ payload
//   const rfqPayload = {
//     ...this.previewData.rfq,                 // original RFQ data
//     CustomerNote: this.previewData.emailBody, // overwrite with edited body
//     Status: sendEmail ? 'Sent' : this.previewData.rfq.Status,
//     RfqSent: sendEmail ? 1 : this.previewData.rfq.RfqSent
//   };

//   // Ensure subcontractorIds and workItemIds exist
//   const subcontractorIds = this.previewData.subcontractorIds || [];
//   const workItemIds = this.previewData.workItemIds || [];

//   this.rfqService.updateRfq(
//     rfqPayload,        // payload containing rfqID
//     subcontractorIds,  // array of subcontractor IDs
//     workItemIds,       // array of work item IDs
//     sendEmail          // optional, defaults to true
//   ).subscribe({
//     next: () => {
//       alert('RFQ sent successfully!');
//       this.closePreview();
//     },
//     error: (err) => {
//       console.error('Error sending RFQ:', err);
//       alert('Failed to send RFQ. Check console for details.');
//     }
//   });
// }


addSub(){
  this.router.navigate(['/add-subcontractor']);

}

  }
