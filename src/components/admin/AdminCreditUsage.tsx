import { useEffect, useMemo, useState } from "react";
import { Database, Download, HardDrive, Loader2, Network, RefreshCw, Zap } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { creditCategories, dailyCreditTotal, formatCredits, sumCreditUsage, usageInRange, type DailyCreditUsage, type CreditCategory } from "@/lib/creditUsage";

const categories = {
  backend_credits: { label: "Backend", icon: Database, color: "hsl(var(--primary))" },
  function_credits: { label: "App functions", icon: Zap, color: "hsl(var(--driver-info))" },
  storage_credits: { label: "Storage", icon: HardDrive, color: "hsl(var(--driver-success))" },
  traffic_credits: { label: "Data traffic", icon: Network, color: "hsl(var(--driver-warning))" },
};
const displayDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-ZA", { day: "numeric", month: "short", timeZone: "UTC" });

export default function AdminCreditUsage() {
  const [rows, setRows] = useState<DailyCreditUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [category, setCategory] = useState<CreditCategory | "total">("total");
  const load = async () => {
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase.from("daily_credit_usage")
      .select("recorded_date,backend_credits,function_credits,storage_credits,traffic_credits,is_partial_day,result_partial,recorded_to_exclusive,retrieved_at")
      .order("recorded_date", { ascending: false }).limit(366);
    if (queryError) setError(queryError.message);
    else {
      const ordered = [...(data || [])].reverse();
      setRows(ordered);
      setStart(previous => previous || ordered[0]?.recorded_date || "");
      setEnd(previous => previous || ordered.at(-1)?.recorded_date || "");
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const selected = useMemo(() => usageInRange(rows, start, end), [rows, start, end]);
  const totals = sumCreditUsage(selected);
  const total = creditCategories.reduce((sum, key) => sum + totals[key], 0);
  const chartData = selected.map(row => ({ ...row, total: dailyCreditTotal(row) }));
  const latest = rows.at(-1);
  const config = { ...categories, total: { label: "Total running", color: "hsl(var(--primary))" } };
  const exportCsv = () => {
    const lines = ["UTC recording date,Backend requested credits,App-function requested credits,Storage requested credits,Data-traffic requested credits,Total running requested credits,Partial day,Partial result,Recording cutoff,Retrieved at",
      ...selected.map(row => [row.recorded_date, ...creditCategories.map(key => Number(row[key]).toFixed(9)), dailyCreditTotal(row).toFixed(9), row.is_partial_day, row.result_partial, row.recorded_to_exclusive, row.retrieved_at].join(","))];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url; link.download = `mfula-running-credits-${start}-${end}.csv`; link.click();
    URL.revokeObjectURL(url);
  };
  return <section className="space-y-6 min-w-0" aria-label="Running credit usage">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-foreground">Running credit usage</h2>
        <p className="text-sm text-muted-foreground mt-1">Mfula Deliveries · Recorded snapshot · UTC days</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="icon" aria-label="Reload saved snapshot" title="Reload saved snapshot" disabled={loading} onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" aria-label="Download credit usage" title="Download credit usage CSV" disabled={!selected.length} onClick={exportCsv}><Download className="h-4 w-4" /></Button>
      </div>
    </div>
    {loading ? <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading recorded usage…</div> : error ? <div role="alert" className="border border-destructive rounded-lg p-4 text-destructive">{error}<Button className="ml-3" variant="outline" onClick={() => void load()}>Retry</Button></div> : !rows.length ? <p className="py-12 text-muted-foreground">No recorded snapshots are available for this account.</p> : <>
      <div className="border-b border-border pb-5">
        <p className="text-sm text-muted-foreground">Selected period · Requested running credits</p>
        <p className="text-3xl font-bold tabular-nums mt-1">{formatCredits(total)}</p>
        <p className="text-xs text-muted-foreground mt-2">{selected.length} recorded days · Building and AI excluded</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {creditCategories.map(key => {
          const Icon = categories[key].icon;
          return <div key={key} className="rounded-lg border border-border bg-card p-4 min-w-0">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Icon className="h-4 w-4 shrink-0" />{categories[key].label}</div>
            <p className="font-bold text-base tabular-nums mt-2 break-all">{formatCredits(totals[key])}</p>
            <p className="text-xs text-muted-foreground mt-1">requested credits</p>
          </div>;
        })}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label htmlFor="credit-start">From (UTC)</Label><Input id="credit-start" type="date" value={start} min={rows[0]?.recorded_date} max={end} onChange={event => setStart(event.target.value)} className="w-40" /></div>
        <div className="space-y-1"><Label htmlFor="credit-end">To (UTC)</Label><Input id="credit-end" type="date" value={end} min={start} max={latest?.recorded_date} onChange={event => setEnd(event.target.value)} className="w-40" /></div>
      </div>
      <div className="space-y-4">
        <h3 className="font-semibold">Daily requested credits</h3>
        <Tabs value={category} onValueChange={value => setCategory(value as CreditCategory | "total")}>
          <TabsList className="flex flex-wrap h-auto justify-start gap-1">
            <TabsTrigger value="total">Total</TabsTrigger>
            {creditCategories.map(key => <TabsTrigger key={key} value={key}>{categories[key].label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        {selected.length ? <ChartContainer config={config} className="h-64 w-full aspect-auto" aria-label="Daily requested credit chart">
          <BarChart data={chartData} accessibilityLayer margin={{ left: 0, right: 8 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="recorded_date" tickFormatter={displayDate} tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis width={60} tickLine={false} axisLine={false} tickFormatter={value => Number(value) !== 0 && Number(value) < 0.001 ? Number(value).toExponential(1) : String(value)} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => displayDate(payload[0]?.payload.recorded_date || start)} formatter={(value) => <span className="tabular-nums">{formatCredits(Number(value))} requested credits</span>} />} />
            <Bar dataKey={category} fill={`var(--color-${category})`} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ChartContainer> : <p className="py-8 text-muted-foreground">No snapshots in this date range.</p>}
      </div>
      <div className="overflow-x-auto border-y border-border">
        <table className="w-full text-xs tabular-nums">
          <caption className="text-left py-3 font-semibold text-foreground">Daily breakdown · requested credits</caption>
          <thead className="bg-secondary text-muted-foreground"><tr><th className="text-left p-3">Date (UTC)</th>{creditCategories.map(key => <th className="text-right p-3 whitespace-nowrap" key={key}>{categories[key].label}</th>)}<th className="text-right p-3">Total</th></tr></thead>
          <tbody>{[...selected].reverse().map(row => <tr key={row.recorded_date} className="border-t border-border">
            <td className="p-3 whitespace-nowrap">{displayDate(row.recorded_date)}{row.is_partial_day && <span className="block text-muted-foreground">Partial day</span>}{row.result_partial && <span className="block text-muted-foreground">Incomplete records</span>}</td>
            {creditCategories.map(key => <td className="text-right p-3" key={key}>{formatCredits(Number(row[key]))}</td>)}
            <td className="text-right p-3 font-semibold">{formatCredits(dailyCreditTotal(row))}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="text-xs text-muted-foreground space-y-2 border-l-2 border-primary pl-3">
        <p>Snapshot retrieved {latest && new Date(latest.retrieved_at).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })} SAST. Recording cutoff: {latest && new Date(latest.recorded_to_exclusive).toLocaleString("en-ZA", { timeZone: "UTC" })} UTC.</p>
        <p>Requested credits are usage amounts, not recorded credit deductions or money paid. Recording may lag activity; partial days are not full-day comparisons.</p>
        <p>Backend = database compute; storage = recorded file storage; traffic includes cached and uncached transfers. Preview and published usage are not separated.</p>
        <p>Saved snapshot only. New dates require another usage-snapshot request in Lovable chat; reloading reads the saved figures.</p>
      </div>
    </>}
  </section>;
}