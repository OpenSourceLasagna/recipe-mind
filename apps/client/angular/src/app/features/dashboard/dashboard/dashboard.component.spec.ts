import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { RecipeFilterService } from '../services/recipe-filter.service';
import { RecipeListService } from '../services/recipe-list.service';
import { ChatStore } from '../../chat/chat.store';
import { MarkdownService, provideMarkdown } from 'ngx-markdown';
import { ChatService } from '../../chat/chat.service';

const testRoutes = [
  { path: 'dashboard/explore', component: {} as any },
  { path: 'dashboard/recipes/:id', component: {} as any },
];

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  const mockRecipeListService = {
    recipes: {
      isLoading: () => false,
      error: () => null,
      hasValue: () => false,
      value: () => ({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 }),
      reload: vi.fn(),
    },
  };

  const mockChatService = {
    stream: { value: signal(null) },
    sendMessage: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(testRoutes),
        provideMarkdown(),
        RecipeFilterService,
        { provide: RecipeListService, useValue: mockRecipeListService },
        { provide: ChatService, useValue: mockChatService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
