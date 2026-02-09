import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubcontractorDetails } from './subcontractor-details';

describe('SubcontractorDetails', () => {
  let component: SubcontractorDetails;
  let fixture: ComponentFixture<SubcontractorDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SubcontractorDetails]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubcontractorDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
