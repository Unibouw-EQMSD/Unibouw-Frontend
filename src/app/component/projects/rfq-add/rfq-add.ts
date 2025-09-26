import { Component } from '@angular/core';

@Component({
  selector: 'app-rfq-add',
  standalone: false,
  templateUrl: './rfq-add.html',
  styleUrl: './rfq-add.css'
})
export class RfqAdd {
 projects = ['Super Market', 'Shopping Mall', 'Warehouse', 'Office Building'];
  selectedProject = 'Super Market';
 dropdownOptions: string[] = ['Super Market', 'Alblas Houthandel', 'Citydocks Amsterdam', 'Meijs Schilderwerken']; // Dropdown list
  selectedOption: string = this.dropdownOptions[0]; 
  // Workitems table data
  workitems = [
    { name: 'Groundwork', rfqSent: 2, quoteReceived: 1, selected: false },
    { name: 'Foundation', rfqSent: 3, quoteReceived: 1, selected: false },
    { name: 'Construction', rfqSent: 5, quoteReceived: 2, selected: false },
    { name: 'Finishing', rfqSent: 5, quoteReceived: 1, selected: false },
    { name: 'Pavement', rfqSent: 3, quoteReceived: 5, selected: false },
    { name: 'Inspection', rfqSent: 3, quoteReceived: 1, selected: false }
  ];

  // Subcontractors list
  subcontractors = [
    { name: 'Bacany', selected: true },
    { name: 'Contrucite & Co', selected: true },
    { name: 'Slimbouw', selected: true },
    { name: 'Sowedane', selected: true },
    { name: 'TalentBouw', selected: true },
    { name: 'Test User', selected: true}
  ];

  showAll = true;
onOptionChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    console.log('Selected Option:', value);
  }
  // Handle Add Subcontractor
  addSubcontractor() {
    const newName = prompt('Enter subcontractor name:');
    if (newName) {
      this.subcontractors.push({ name: newName, selected: false });
    }
  }

  // Handle form submission
  onSubmit() {
    const selectedWorkitems = this.workitems.filter(w => w.selected);
    const selectedSubcontractors = this.subcontractors.filter(s => s.selected);

    console.log('Selected Project:', this.selectedProject);
    console.log('Selected Workitems:', selectedWorkitems);
    console.log('Selected Subcontractors:', selectedSubcontractors);
    alert('Form submitted! Check console for details.');
  }

  // Handle cancel
  onCancel() {
    this.selectedProject = this.projects[0];
    this.workitems.forEach(w => (w.selected = false));
    this.subcontractors.forEach(s => (s.selected = false));
    console.log('Form reset');
  }
}
