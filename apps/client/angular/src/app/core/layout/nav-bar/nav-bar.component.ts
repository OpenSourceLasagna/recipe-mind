import { ChangeDetectionStrategy, Component, inject, type Signal } from '@angular/core';
import { isActive, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowLeftOnRectangle, heroBookmark, heroCog6Tooth, heroMagnifyingGlass, heroPlusCircle, heroSparkles, heroUserCircle } from '@ng-icons/heroicons/outline';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmNavigationMenuImports } from '@spartan-ng/helm/navigation-menu';
import { AuthService } from '../../auth/auth.service';
import { HlmIcon } from '@spartan-ng/helm/icon';

const ROUTES = {
  EXPLORE: '/dashboard/explore',
  AI_CHEF: '/dashboard/ai-chef',
  ADD_NEW: '/dashboard/add-new',
  SAVED: '/dashboard/saved',
  PROFILE: '/dashboard/profile',
  SETTINGS: '/dashboard/settings',
  LOGIN: '/auth/login',
} as const;

type NavItem = {
  label: string;
  route: (typeof ROUTES)[keyof typeof ROUTES];
  icon: string;
};

const matchOptions = { paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' } as const;

@Component({
  selector: 'app-nav-bar',
  imports: [RouterLink, NgIcon, HlmNavigationMenuImports, HlmButton, HlmIcon, HlmDropdownMenuImports],
  providers: [provideIcons({ explore: heroMagnifyingGlass, aiChef: heroSparkles, addNew: heroPlusCircle, saved: heroBookmark, profile: heroUserCircle, cog: heroCog6Tooth, logOut: heroArrowLeftOnRectangle })],
  templateUrl: './nav-bar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class NavBarComponent {
  readonly #router = inject(Router);
  readonly #authService = inject(AuthService);

  readonly navItems: NavItem[] = [
    { label: 'Explore', route: ROUTES.EXPLORE, icon: 'explore' },
    { label: 'AI Chef', route: ROUTES.AI_CHEF, icon: 'aiChef' },
    { label: 'Add New', route: ROUTES.ADD_NEW, icon: 'addNew' },
    { label: 'Saved', route: ROUTES.SAVED, icon: 'saved' },
  ];

  readonly activeStates: Record<string, Signal<boolean>> = {
    [ROUTES.EXPLORE]: isActive(ROUTES.EXPLORE, this.#router, matchOptions),
    [ROUTES.AI_CHEF]: isActive(ROUTES.AI_CHEF, this.#router, matchOptions),
    [ROUTES.ADD_NEW]: isActive(ROUTES.ADD_NEW, this.#router, matchOptions),
    [ROUTES.SAVED]: isActive(ROUTES.SAVED, this.#router, matchOptions),
  };

  profile(): void {
    void this.#router.navigate([ROUTES.PROFILE]);
  }

  settings(): void {
    void this.#router.navigate([ROUTES.SETTINGS]);
  }

  async logout(): Promise<void> {
    try {
      await this.#authService.signOut();
      await this.#router.navigate([ROUTES.LOGIN]);
    } catch (e){
      alert(JSON.stringify(e))
      // TODO: surface error to user via toast notification
    }
  }
}
