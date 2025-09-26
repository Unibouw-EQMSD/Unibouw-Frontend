import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Workitems } from './workitems';

describe('Workitems', () => {
  let component: Workitems;
  let fixture: ComponentFixture<Workitems>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Workitems]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Workitems);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
