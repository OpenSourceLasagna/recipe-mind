import { NgOptimizedImage } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, NgOptimizedImage],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.css',
})
export class AuthLayoutComponent {

}
