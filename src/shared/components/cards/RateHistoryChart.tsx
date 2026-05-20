"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/shared/i18n/LanguageProvider";

type RateHistory = {
  snapshot_date: string;
  vault_usd: number;
  total_mom_supply: number;
  mom_rate: number;
};

export function RateHistoryChart({ data }: { data: RateHistory[] }) {
  const { dictionary, t } = useI18n();

  // Ensure data is sorted by date ascending for the chart
  const sortedData = useMemo(() => {
    return [...data].sort(
      (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
    ).map(item => ({
      ...item,
      // Format date for display (e.g., "5/20")
      displayDate: new Date(item.snapshot_date).toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric"
      })
    }));
  }, [data]);

  if (sortedData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-background">
        <p className="text-sm font-medium text-muted-foreground">
          {t({ ko: "아직 환율 데이터가 없습니다.", en: "No rate data yet.", es: "Aún no hay datos de tasa." })}
        </p>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={sortedData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/50" />
          <XAxis 
            dataKey="displayDate" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: "currentColor", opacity: 0.5 }} 
            dy={10}
          />
          <YAxis 
            domain={['auto', 'auto']} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: "currentColor", opacity: 0.5 }}
            tickFormatter={(value) => `$${Number(value).toFixed(4)}`}
            width={80}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--background)', 
              borderColor: 'var(--border)',
              borderRadius: '0.75rem',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
              fontWeight: 600,
              fontSize: '13px'
            }}
            itemStyle={{ color: '#10b981', fontWeight: 900 }}
            formatter={(value: any) => [`$${Number(value).toFixed(4)}`, t(dictionary.topBar.rate)]}
            labelStyle={{ color: 'var(--muted-foreground)', marginBottom: '4px' }}
          />
          <Area 
            type="monotone" 
            dataKey="mom_rate" 
            stroke="#10b981" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorRate)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
