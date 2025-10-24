import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { WorkitemService,Workitem, WorkitemCategory } from '../../services/workitem.service';
import { SubcontractorService } from '../../services/subcontractor.service';

@Component({
  selector: 'app-add-subcontractor',
  standalone: false,
  templateUrl: './add-subcontractor.html',
  styleUrl: './add-subcontractor.css'
})
export class AddSubcontractor {
subcontractorForm: FormGroup;
  countries = ['Afghanistan', 'India', 'USA', 'Germany', 'Netherlands'];
 workitems: Workitem[] = [];
  selectedWorkitems: Workitem[] = [];
categories: WorkitemCategory[] = [
    { categoryId: '5ADD8834-7116-48A2-95BD-7C5914145D35', categoryName: 'Standard' },
    { categoryId: 'A5D5BF39-BBFC-42C4-88E7-3342091E9770', categoryName: 'Unibouw' }
  ];
  attachments: File[] = [];
  uploadedFileName: string = '';
uploadedFileType: string = '';
uploadedFilePath: string = '';
 showPopup = false;
  popupMessage = '';
  popupError = false;
  selectedCategoryId: string = '';  
  constructor(private fb: FormBuilder,private workItemService: WorkitemService,private subcontractorService: SubcontractorService) {
    this.subcontractorForm = this.fb.group({
      name: [''],
      location: [''],
      country: [''],
      registeredDate: [''],
      email: [''],
      status: ['Active'],
      officeAddress: [''],
      billingAddress: [''],
      sameAsOffice: [false],
      attachments: [null]
    });
  }

  ngOnInit() {
if (this.categories.length > 0) {
    this.selectedCategoryId = this.categories[0].categoryId;
    this.loadWorkitems();
  } }

  // Load workitems for selected category
   loadWorkitems() {
  if (!this.selectedCategoryId) {
    this.workitems = [];
    this.selectedWorkitems = [];
    return;
  }

  this.workItemService.getWorkitems(this.selectedCategoryId).subscribe(items => {
    this.workitems = items || [];

    // Keep selected items only if they exist in the new list
    this.selectedWorkitems = this.selectedWorkitems.filter(sw =>
      this.workitems.some(w => w.id === sw.id)
    );
  });
}


selectCategory(categoryId: string) {
    this.selectedCategoryId = categoryId;
    this.selectedWorkitems = [];   // clear selected items for new category
    this.workitems = [];           // clear current workitems
    this.loadWorkitems();
  }

  toggleWorkitem(event: any, item: Workitem) {
    if (event.target.checked) {
      this.selectedWorkitems.push(item);
    } else {
      this.selectedWorkitems = this.selectedWorkitems.filter(w => w.id !== item.id);
    }
  }
addMoreFiles() {
  // optional: trigger file input click programmatically
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = (event: any) => {
    const file: File = event.target.files[0];
    if (file) this.attachments.push(file);
  };
  input.click();
}
 onFileSelected(event: any) {
  const file: File = event.target.files[0];
  if (file) {
    this.attachments.push(file);
    this.uploadedFileName = file.name;
    this.uploadedFileType = file.type;
    this.uploadedFilePath = `uploads/${file.name}`; // Example placeholder path
  }
  this.subcontractorForm.patchValue({ attachments: this.attachments });
}

onSubmit() {
  if (this.subcontractorForm.valid) {
    const formValue = this.subcontractorForm.value;

    const payload = {
      erpId: formValue.erpId || "ERP-SUB-001",
      name: formValue.name,
      rating: formValue.rating || 0,
      contactPerson: formValue.contactPerson || "",
      emailId: formValue.email,
      phoneNumber1: formValue.phoneNumber1 ? Number(formValue.phoneNumber1) : null,
      phoneNumber2: formValue.phoneNumber2 ? Number(formValue.phoneNumber2) : null,
      location: formValue.location,
      country: formValue.country,
      officeAdress: formValue.officeAddress,
      billingAddress: formValue.billingAddress,
      registeredDate: formValue.registeredDate,
      isActive: formValue.status === 'Active',
      createdBy: "nitish.ra@flatworldsolutions.com",

      attachments: {
        fileName: this.uploadedFileName || "N/A",
        fileType: this.uploadedFileType || "N/A",
        filePath: this.uploadedFilePath || "N/A",
        uploadedBy: "nitish.ra@flatworldsolutions.com"
      },

      // ✅ Send all selected work items as array
      subcontractorWorkItemMappings: this.selectedWorkitems.map(item => ({
        workItemId: item.id,
        categoryId: this.selectedCategoryId
      }))
    };

    console.log("✅ Final payload:", payload);

    this.subcontractorService.createSubcontractor(payload).subscribe({
      next: res => {
        this.showPopupMessage('Subcontractor created successfully!');
        this.onCancel();
      },
      error: err => {
        this.showPopupMessage('Failed to create Subcontractor. Please try again.', true);
      }
    });
  } else {
    alert('Please fill in all required fields before submitting.');
  }
}





  onCancel() {
    this.subcontractorForm.reset({
      status: 'Active',
      sameAsOffice: false,
      attachments: null
    });
    this.selectedWorkitems = [];
  }

  // Helper function for template to check if a workitem is selected
  isSelected(w: Workitem): boolean {
    return this.selectedWorkitems.some(sw => sw.id === w.id);
  }

  showPopupMessage(message: string, isError: boolean = false) {
  this.popupMessage = message;
  this.showPopup = true;

  // Change popup style dynamically if it's an error
  const popupEl = document.querySelector('.popup');
  if (popupEl) {
    popupEl.classList.toggle('error', isError);
  }

  // Hide after 3 seconds
  setTimeout(() => {
    this.showPopup = false;
  }, 3000);
}
}