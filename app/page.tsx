"use client";

import { useEffect, useMemo, useState } from "react";

type Stock = Record<string, string | number | null>;
const signals = ["All", "Strong Buy", "Buy", "Hold", "Sell"];
const n = (v: unknown) => typeof v === "number" ? v : Number(v) || 0;
const pct = (v: unknown) => `${n(v).toFixed(1)}%`;
const tone = (signal: unknown) => String(signal).toLowerCase().replace(/ /g, "-");

export default function Home() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [query, setQuery] = useState("");
  const [signal, setSignal] = useState("All");
  const [sector, setSector] = useState("All");
  const [sort, setSort] = useState("Combined Score");
  const [selected, setSelected] = useState<Stock | null>(null);

  useEffect(() => { fetch("/stocks.json").then(r => r.json()).then(d => setStocks(d.summary || [])); }, []);
  const sectors = useMemo(() => ["All", ...Array.from(new Set(stocks.map(s => String(s.Sector || "Unclassified")))).sort()], [stocks]);
  const filtered = useMemo(() => stocks.filter(s => {
    const text = `${s.Ticker} ${s.Name}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (signal === "All" || s.Signal === signal) && (sector === "All" || (s.Sector || "Unclassified") === sector);
  }).sort((a,b) => n(b[sort]) - n(a[sort])), [stocks, query, signal, sector, sort]);
  const counts = useMemo<Record<string, number>>(() => Object.fromEntries(signals.slice(1).map(x => [x, stocks.filter(s => s.Signal === x).length])), [stocks]);
  const sectorCounts = useMemo<[string, number][]>(() => (Object.entries(stocks.reduce((a:Record<string,number>,s) => { const k=String(s.Sector||"Unclassified"); a[k]=(a[k]||0)+1; return a; },{})) as [string,number][]).sort((a,b)=>b[1]-a[1]).slice(0,8), [stocks]);
  const medianUpside = useMemo(() => { const a=stocks.map(s=>n(s["Analyst Upside %"])).sort((a,b)=>a-b); return a.length ? a[Math.floor(a.length/2)] : 0; }, [stocks]);

  return <main>
    <header>
      <div className="eyebrow">PORTFOLIO INTELLIGENCE</div>
      <h1>Market Signal Console</h1>
      <p>Explore 547 securities through technical, fundamental, analyst, and risk lenses.</p>
      <div className="asof"><span/> Snapshot from portfolio_analysis.xlsx - Aug 14, 2026</div>
    </header>

    <section className="kpis">
      <Kpi label="Coverage" value={stocks.length || "--"} note="Securities analyzed" />
      <Kpi label="Buy / Strong Buy" value={(counts.Buy||0)+(counts["Strong Buy"]||0)} note={`${stocks.length ? (((counts.Buy||0)+(counts["Strong Buy"]||0))/stocks.length*100).toFixed(0) : 0}% of coverage`} accent />
      <Kpi label="Strong Buy" value={counts["Strong Buy"]||0} note="Highest-conviction signal" />
      <Kpi label="Median Upside" value={pct(medianUpside)} note="Analyst target potential" />
    </section>

    <section className="insights">
      <article className="panel signal-panel"><div className="section-title"><h2>Signal distribution</h2><span>Current screen</span></div>
        <div className="signal-grid">{signals.slice(1).map(s => <button key={s} onClick={()=>setSignal(s)} className="signal-row"><span className={`dot ${tone(s)}`}/><b>{s}</b><i><em style={{width:`${stocks.length ? (counts[s]||0)/stocks.length*100 : 0}%`}}/></i><strong>{counts[s]||0}</strong></button>)}</div>
      </article>
      <article className="panel"><div className="section-title"><h2>Sector coverage</h2><span>Top eight</span></div>
        <div className="sector-bars">{sectorCounts.map(([s,c]) => <button key={s} onClick={()=>setSector(s)}><span>{s}</span><i><em style={{width:`${c/Math.max(...sectorCounts.map(x=>x[1]))*100}%`}}/></i><b>{c}</b></button>)}</div>
      </article>
    </section>

    <section className="screener">
      <div className="section-title"><div><div className="eyebrow">SECURITY SCREENER</div><h2>Find the signal behind the ticker</h2></div><span>{filtered.length} results</span></div>
      <div className="controls">
        <label className="search"><span>Search</span><input aria-label="Search securities" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ticker or company"/></label>
        <select aria-label="Filter by signal" value={signal} onChange={e=>setSignal(e.target.value)}>{signals.map(x=><option key={x}>{x}</option>)}</select>
        <select aria-label="Filter by sector" value={sector} onChange={e=>setSector(e.target.value)}>{sectors.map(x=><option key={x}>{x}</option>)}</select>
        <select aria-label="Sort securities" value={sort} onChange={e=>setSort(e.target.value)}><option>Combined Score</option><option>Analyst Upside %</option><option>Sharpe</option><option>1Y %</option></select>
        {(query||signal!=="All"||sector!=="All") && <button className="clear" onClick={()=>{setQuery("");setSignal("All");setSector("All")}}>Clear</button>}
      </div>
      <div className="table-wrap"><table><thead><tr><th>Security</th><th>Sector</th><th>Signal</th><th>Price</th><th>Combined</th><th>Analyst upside</th><th>1Y return</th><th>Sharpe</th><th>Max drawdown</th></tr></thead>
        <tbody>{filtered.slice(0,100).map(s=><tr key={String(s.Ticker)} onClick={()=>setSelected(s)} tabIndex={0} onKeyDown={e=>e.key==="Enter"&&setSelected(s)}><td><b>{s.Ticker}</b><span>{s.Name}</span></td><td>{s.Sector||"—"}</td><td><mark className={tone(s.Signal)}>{s.Signal}</mark></td><td>${n(s.Price).toFixed(2)}</td><td><strong>{n(s["Combined Score"]).toFixed(1)}</strong></td><td className={n(s["Analyst Upside %"])>=0?"pos":"neg"}>{pct(s["Analyst Upside %"])}</td><td className={n(s["1Y %"])>=0?"pos":"neg"}>{pct(s["1Y %"])}</td><td>{n(s.Sharpe).toFixed(2)}</td><td className="neg">{pct(s["Max DD %"])}</td></tr>)}</tbody></table></div>
      {filtered.length>100 && <p className="limit">Showing the top 100 results by {sort}. Refine filters to narrow the list.</p>}
    </section>

    {selected && <div className="modal-bg" onClick={()=>setSelected(null)}><aside className="detail" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected(null)}>×</button><div className="eyebrow">SECURITY DETAIL</div><h2>{selected.Ticker}</h2><p className="company">{selected.Name}</p><mark className={tone(selected.Signal)}>{selected.Signal}</mark><div className="detail-grid"><Metric label="Price" value={`$${n(selected.Price).toFixed(2)}`}/><Metric label="Combined score" value={n(selected["Combined Score"]).toFixed(1)}/><Metric label="RSI" value={n(selected.RSI).toFixed(1)}/><Metric label="P/E" value={`${n(selected["P/E"]).toFixed(1)}×`}/><Metric label="Analyst upside" value={pct(selected["Analyst Upside %"])}/><Metric label="1Y return" value={pct(selected["1Y %"])}/><Metric label="Sharpe" value={n(selected.Sharpe).toFixed(2)}/><Metric label="Max drawdown" value={pct(selected["Max DD %"])}/></div><p className="note">Screening data only. Review current filings, valuation, liquidity, and portfolio fit before making an investment decision.</p></aside></div>}
    <footer>Analytics based on the supplied workbook snapshot. Not investment advice.</footer>
  </main>
}

function Kpi({label,value,note,accent=false}:{label:string,value:string|number,note:string,accent?:boolean}) { return <article className={`kpi ${accent?"accent":""}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article> }
function Metric({label,value}:{label:string,value:string}) { return <div><span>{label}</span><b>{value}</b></div> }
