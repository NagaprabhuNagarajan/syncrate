import type { Metadata } from 'next';
import { ReportsHub } from '@/features/reports/components/reports-hub';

export const metadata: Metadata = {
  title: 'Reports',
  description: 'Business reports and analytics',
};

export default function ReportsPage() {
  return <ReportsHub />;
}
