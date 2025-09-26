import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewProjects } from './view-projects';

describe('ViewProjects', () => {
  let component: ViewProjects;
  let fixture: ComponentFixture<ViewProjects>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ViewProjects]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewProjects);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
