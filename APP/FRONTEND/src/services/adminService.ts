import { mockAdminListings, mockAdminSummary } from '@/data/admin';
import type { AdminListing, AdminSummary } from '@/types';
import { delay } from '@/services/simulate';

export async function getAdminListings(): Promise<AdminListing[]> {
  await delay(300);
  return mockAdminListings;
}

export async function getAdminSummary(): Promise<AdminSummary> {
  await delay(200);
  return mockAdminSummary;
}

export const adminService = { getAdminListings, getAdminSummary, initialListings: mockAdminListings };
