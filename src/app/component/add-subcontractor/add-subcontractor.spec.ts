import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddSubcontractor } from './add-subcontractor';

describe('AddSubcontractor', () => {
  let component: AddSubcontractor;
  let fixture: ComponentFixture<AddSubcontractor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddSubcontractor],
    }).compileComponents();

    fixture = TestBed.createComponent(AddSubcontractor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
