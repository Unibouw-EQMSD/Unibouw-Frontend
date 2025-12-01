import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { forkJoin, lastValueFrom } from 'rxjs';
import { Subcontractors, SubcontractorService } from '../../../services/subcontractor.service';
import { Workitem, WorkitemCategory, WorkitemService } from '../../../services/workitem.service';
import { Rfq, RfqService } from '../../../services/rfq.service';
import { projectdetails,projectService } from '../../../services/project.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-rfq-add',
  standalone: false,
  templateUrl: './rfq-add.html',
  styleUrl: './rfq-add.css'
})
export class RfqAdd {
 projects: any[] = [];
  selectedProject: string = '';
  selectedTab: 'standard' | 'unibouw' = 'standard';
  selectedDueDate: string = '';
  standardWorkitems: Workitem[] = [];
  unibouwWorkitems: Workitem[] = [];
  selectedWorkItems: Workitem[] = [];
  subcontractors: (Subcontractors & { selected?: boolean })[] = [];
  showAll: boolean = true;
  customerNote: string = '';
projectId!: string;
projectDetails: any;
  constructor(
    private workitemService: WorkitemService,
    private subcontractorService: SubcontractorService,
    private rfqService: RfqService,
    private http: HttpClient,
    private projectService: projectService,
      private route: ActivatedRoute  

  ) {}

  isLoader: boolean = false;

ngOnInit() {
  // Load dropdown projects (in case user opens page without project ID)
  this.loadProjects();

  // Load workitems
  this.loadCategoriesAndWorkitems();

  // Get project ID from route
this.projectId = this.route.snapshot.paramMap.get('projectId') || '';

  // If projectId was passed → auto-fetch project details
  if (this.projectId) {
    this.loadProjectDetails(this.projectId);

    // Also auto-select in your component
    this.selectedProject = this.projectId;
  }
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

  loadSubcontractors(workItemID: string) {
    this.subcontractorService.getSubcontractorWorkItemMappings().subscribe(mappings => {
      this.subcontractorService.getSubcontractors().subscribe(subs => {
        const linkedIds = mappings
          .filter((m: any) => m.workItemID === workItemID)
          .map((m: any) => m.subcontractorID);

        this.subcontractors = subs.map(s => ({
          ...s,
          selected: linkedIds.includes(s.subcontractorID)
        }));
      });
    });
  }

  addSubcontractor() {
    const newName = prompt('Enter subcontractor name:');
    if (newName) {
      const newSub: Subcontractors & { selected?: boolean } = {
        subcontractorID: `temp-${Date.now()}`,
        name: newName,
        category: '',
        personName: '',
        phoneNumber1: '',
        emailID: '',
        selected: true
      };
      this.subcontractors.push(newSub);
    }
  }

  onProjectChange(event: Event) {
    const projectId = (event.target as HTMLSelectElement).value;
    this.selectedProject = projectId;
    this.selectedWorkItems = [];
    this.subcontractors = [];
  }

onSubmit() {
  if (!this.selectedProject) return alert('Select a project first');
  const selectedProject = this.projects.find(p => p.projectID === this.selectedProject);
  if (!selectedProject) return alert('Project not found');

  const selectedSubs = this.subcontractors.filter(s => s.selected);
  if (!selectedSubs.length) return alert('Select at least one subcontractor');
  if (!this.selectedWorkItems.length) return alert('Select at least one work item');

  const now = new Date().toISOString();

  const rfqPayload = {
    sentDate: now,
    dueDate: this.selectedDueDate ? new Date(this.selectedDueDate).toISOString() : now,
    rfqSent: 0,
    quoteReceived: 0,
    customerID: selectedProject.customerID,
    projectID: this.projectId,
    customerNote: this.customerNote || '',
    deadLine: this.selectedDueDate ? new Date(this.selectedDueDate).toISOString() : now,
    createdBy: 'System'
  };

  const subcontractorIds = selectedSubs.map(s => s.subcontractorID);
  const workItemIds = this.selectedWorkItems.map(w => w.workItemID);

  console.log('🚀 RFQ Payload:', rfqPayload);
  console.log('👷 Subcontractors:', subcontractorIds);
  console.log('🧩 Work Items:', workItemIds);

  // 👉 Start Loader
  this.isLoader = true;

  this.rfqService.createRfq(rfqPayload, subcontractorIds, workItemIds).subscribe({
    next: res => {
      console.log('✅ RFQ created successfully', res);
      alert('RFQ created successfully and emails sent!');
      this.isLoader = false;  // 👉 Stop loader
    },
    error: err => {
      console.error('❌ RFQ creation failed', err);
      alert('RFQ creation failed. Check console for details.');
      this.isLoader = false; // 👉 Stop loader on error
    }
  });
}
  

  onCancel() {
    this.selectedProject = this.projects.length ? this.projects[0].projectID : '';
    this.selectedTab = 'standard';
    this.selectedWorkItems = [];
    this.subcontractors = [];
  }
}
