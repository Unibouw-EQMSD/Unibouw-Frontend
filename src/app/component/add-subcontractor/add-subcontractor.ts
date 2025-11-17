import { Component, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { WorkitemService, Workitem, WorkitemCategory } from '../../services/workitem.service';
import { SubcontractorService } from '../../services/subcontractor.service';
import { Router } from '@angular/router';
import { countryList } from '../../shared/countries';

@Component({
  selector: 'app-add-subcontractor',
  standalone: false,
  templateUrl: './add-subcontractor.html',
  styleUrl: './add-subcontractor.css'
})
export class AddSubcontractor {
  subcontractorForm: FormGroup;
  countryList = countryList;
  countries = countryList.map(c => c.name);
  isDropdownOpen = false;
  selectedCountry = countryList.find(c => c.code === '+31') || countryList[0]; // Default to Netherland or first country
  workitems: Workitem[] = [];
  selectedWorkitems: Workitem[] = [];
  persons: any[] = [];
  categories: WorkitemCategory[] = [
    { categoryID: '60a1a614-05fd-402d-81b3-3ba05fdd2d8a', categoryName: 'Standard' },
    { categoryID: '213cf69b-627e-4962-83ec-53463c8664d2', categoryName: 'Unibouw' }
  ];
  attachments: File[] = [];
  uploadedFiles: { name: string; type: string; path: string }[] = [];
  uploadedFileType: string = '';
  uploadedFilePath: string = '';
  showPopup = false;
  popupMessage = '';
  popupError = false;
  selectedCategoryId: string = '';
  constructor(private fb: FormBuilder, private router: Router, private workItemService: WorkitemService, private subcontractorService: SubcontractorService) {
    this.subcontractorForm = this.fb.group({
      name: ['', Validators.required],
    location: ['', Validators.required],
    country: [''],
    registeredDate: [''],
    email: ['', [Validators.required, Validators.email]],
    status: ['Active'],
    officeAddress: ['', Validators.required],
    billingAddress: [''],
    sameAsOffice: [false],
    countryCode: [this.selectedCountry.code],
    contactNumber: [
      '',
      [Validators.required, Validators.pattern(/^[0-9]{6,15}$/)]
    ],
    contactPerson: ['', Validators.required],
    attachments: [null]
    });
  }

  ngOnInit() {
        this.loadPersons();

    if (this.categories.length > 0) {
      this.selectedCategoryId = this.categories[0].categoryID;
      this.loadWorkitems();
    }

    const officeCtrl = this.subcontractorForm.get('officeAddress');
    const billingCtrl = this.subcontractorForm.get('billingAddress');
    const sameAsCtrl = this.subcontractorForm.get('sameAsOffice');

    // Whenever checkbox changes
    sameAsCtrl?.valueChanges.subscribe((checked) => {
      if (checked) {
        // Set billingAddress to officeAddress and disable editing
        billingCtrl?.setValue(officeCtrl?.value);
        billingCtrl?.disable();

        // Subscribe to officeAddress changes
        officeCtrl?.valueChanges.subscribe((val) => {
          if (sameAsCtrl?.value) {
            billingCtrl?.setValue(val, { emitEvent: false }); // avoid circular updates
          }
        });
      } else {
        // Enable billingAddress for manual editing
        billingCtrl?.enable();
      }
    });
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  // Select country from dropdown
  selectCountry(country: any) {
    this.selectedCountry = country;
    this.subcontractorForm.patchValue({ countryCode: country.code });
    this.isDropdownOpen = false;
  }

  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-select-wrapper')) {
      this.isDropdownOpen = false;
    }
  }

  // Load workitems for selected category
  loadWorkitems() {
    if (!this.selectedCategoryId) {
      this.workitems = [];
      this.selectedWorkitems = [];
      return;
    }

    this.workItemService.getWorkitems(this.selectedCategoryId).subscribe(items => {
      // Only keep items where isActive is true
      this.workitems = (items || []).filter(w => w.isActive !== false).sort((a, b) => a.name.localeCompare(b.name));

      // Keep selected items only if they exist in the new list
      this.selectedWorkitems = this.selectedWorkitems.filter(sw =>
        this.workitems.some(w => w.workItemID === sw.workItemID)
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
      this.selectedWorkitems = this.selectedWorkitems.filter(w => w.workItemID !== item.workItemID);
    }
  }
onFileSelected(event: any) {
  const input = event.target as HTMLInputElement;
  const file = input.files && input.files.length > 0 ? input.files[0] : null;

  if (file) {
    this.attachments.push(file);
    this.uploadedFiles.push({
      name: file.name,
      type: file.type,
      path: `uploads/${file.name}`, // Example placeholder
    });
    this.subcontractorForm.patchValue({ attachments: this.attachments });
  }

  // ✅ Clear the file input after upload
  input.value = '';
}

addMoreFiles() {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = (event: any) => {
    const file: File = event.target.files[0];
    if (file) {
      this.attachments.push(file);
      this.uploadedFiles.push({
        name: file.name,
        type: file.type,
        path: `uploads/${file.name}`,
      });
      this.subcontractorForm.patchValue({ attachments: this.attachments });
    }
  };
  input.click();
}
removeFile(index: number) {
  this.attachments.splice(index, 1);
  this.uploadedFiles.splice(index, 1);
  this.subcontractorForm.patchValue({ attachments: this.attachments });
}
loadPersons(): void {
    this.subcontractorService.getPersons().subscribe({
      next: (res: any[]) => {
        this.persons = res;
      },
      error: (err: any) => console.error('Error fetching persons:', err)
    });
  }

  
onSubmit() {
  // Mark all form fields as touched to show validation errors
  this.subcontractorForm.markAllAsTouched();

  // Validate that at least one work item is selected
  if (this.selectedWorkitems.length === 0) {
   return;
  }

  // Proceed only if the form is valid
  if (!this.subcontractorForm.valid) {
    return;
  }

  const formValue = this.subcontractorForm.value;

  // Prepare the payload for API call
  const payload = {
    erP_ID: formValue.erpId?.trim() || "",
    name: formValue.name?.trim(),
    rating: formValue.rating || 0,
    contactPerson: formValue.contactPerson || "",
    emailID: formValue.email,
    phoneNumber1: formValue.contactNumber? this.selectedCountry.code + formValue.contactNumber: "",
    personID: formValue.contactPerson,
    location: formValue.location,
    country: formValue.country ? formValue.country : null,
    officeAddress: formValue.officeAddress ? formValue.officeAddress : null,
    billingAddress: formValue.sameAsOffice? formValue.officeAddress: formValue.billingAddress,
    registeredDate: formValue.registeredDate ? formValue.registeredDate : null,
    isActive: formValue.status === "Active",
    createdBy: "nitish.ra@flatworldsolutions.com",
    workItemIDs: this.selectedWorkitems.map(item => item.workItemID),
  };

  // Call API to create subcontractor
  this.subcontractorService.createSubcontractor(payload).subscribe({
    next: (res) => {
      const subcontractorID = res?.subcontractorID || res?.id;
      const files: File[] = formValue.attachments || [];

      // If subcontractor created and attachments exist, upload them
      if (subcontractorID && files.length > 0) {
        this.subcontractorService.createAttachments(subcontractorID, files).subscribe({
          next: () => {
            this.showPopupMessage("Subcontractor and files uploaded successfully!");
            this.handleFormResetAndRedirect();
          },
          error: (uploadErr) => {
            console.error("File upload failed:", uploadErr);
            this.showPopupMessage("File upload failed.", true);
          },
        });
      } 
      // If no attachments, just show success message
      else {
        this.showPopupMessage("Subcontractor created successfully!");
        this.handleFormResetAndRedirect();
      }
    },
    error: (err) => {
      console.error("Backend error:", err);
      // Safely extract backend error message
  const errorMessage =
    err?.error?.message ||    // Custom message from backend
    err?.error?.error ||      // Detailed error if available
    err?.message ||           // Generic message
    'Failed to create Subcontractor. Please try again.'; // Fallback

      this.showPopupMessage(errorMessage, true);
      //this.showPopupMessage("Failed to create Subcontractor. Please try again.", true);
    },
  });
}

/** method to reset the form and navigate back to the Subcontractor list*/
private handleFormResetAndRedirect(): void {
  this.onReset();
  setTimeout(() => this.router.navigate(['/subcontractor']), 1000);
}


onReset() {
  this.subcontractorForm.reset();
    this.subcontractorForm.markAsPristine(); // Optional: marks form as pristine
  this.subcontractorForm.markAsUntouched(); // Optional: marks form as untouched
  this.selectedWorkitems = [];
  //this.selectedCountry = { name: 'India', code: '+91', flag: 'in' }; // or default country
  this.selectedCountry = { name: 'France', code: '+31', flag: 'fr' }; // default country set to France
  this.uploadedFiles = []; // clear uploaded file preview list if any
  const fileInput = document.querySelector<HTMLInputElement>('#fileInput');
  if (fileInput) fileInput.value = ''; // clear the file input
}


  onCancel() {
    // this.subcontractorForm.reset({
    //   status: 'Active',
    //   sameAsOffice: false,
    //   attachments: null
    // });
    // this.selectedWorkitems = [];
    this.router.navigate(['/subcontractor']);

  }



  // Helper function for template to check if a workitem is selected
  isSelected(w: Workitem): boolean {
    return this.selectedWorkitems.some(sw => sw.workItemID === w.workItemID);
  }

  // showPopupMessage(message: string, isError: boolean = false) {
  //   this.popupMessage = message;
  //   this.showPopup = true;
  //   // Change popup style dynamically if it's an error
  //   const popupEl = document.querySelector('.popup');
  //   if (popupEl) {
  //     popupEl.classList.toggle('error', isError);
  //   }
  //   // Hide after 3 seconds
  //   setTimeout(() => {
  //     this.showPopup = false;
  //   }, 3000);
  // }

   showPopupMessage(message: string, isError: boolean = false) {
    this.popupMessage = message;
    this.popupError = isError;
    this.showPopup = true;
    setTimeout(() => (this.showPopup = false), 3000);
  }
}