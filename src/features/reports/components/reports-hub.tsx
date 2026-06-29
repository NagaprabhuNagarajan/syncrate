'use client';

import { motion } from 'framer-motion';
import { BarChart3, ShoppingCart, Package, Receipt, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const REPORTS = [
  {
    title: 'Sales Report',
    description: 'Daily, monthly, and yearly sales totals with customer breakdown',
    icon: BarChart3,
    href: '/reports/sales',
    gradient: 'bg-gradient-info',
  },
  {
    title: 'Purchase Report',
    description: 'Purchase summary and supplier-wise breakdown',
    icon: ShoppingCart,
    href: '/reports/purchases',
    gradient: 'bg-gradient-violet',
  },
  {
    title: 'Inventory Report',
    description: 'Current stock levels, low stock alerts, and out-of-stock items',
    icon: Package,
    href: '/reports/inventory',
    gradient: 'bg-gradient-success',
  },
  {
    title: 'GST Summary',
    description: 'CGST, SGST, and IGST breakdowns for tax compliance',
    icon: Receipt,
    href: '/reports/gst',
    gradient: 'bg-gradient-warning',
  },
  {
    title: 'Outstanding Report',
    description: 'Customer receivables and supplier payables with aging analysis',
    icon: AlertCircle,
    href: '/reports/outstanding',
    gradient: 'bg-gradient-error',
  },
] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export function ReportsHub() {
  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Reports</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          View and export business reports for insights and compliance
        </p>
      </div>
      <motion.div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {REPORTS.map((report) => {
          const Icon = report.icon;
          return (
            <motion.div key={report.href} variants={cardVariants}>
              <Card hover className="group h-full">
                <CardHeader>
                  <div
                    className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${report.gradient} shadow-glow-primary`}
                  >
                    <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-base">{report.title}</CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full" variant="outline">
                    <Link href={report.href}>View Report</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
