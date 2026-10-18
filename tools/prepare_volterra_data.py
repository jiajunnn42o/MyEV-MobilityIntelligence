#!/usr/bin/env python3
"""VOLTERRA real JPJ 2026 transactions -> browser-safe aggregate JSON.

Uses only Python standard library; input CSV remains private in data/raw/.
Does not impute Rakan Niaga registrations to states or manufacture missing months.
"""
from __future__ import annotations
import argparse
import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ALIASES = {
    'johor':'Johor','kedah':'Kedah','kelantan':'Kelantan','melaka':'Melaka',
    'negeri sembilan':'Negeri Sembilan','pahang':'Pahang','perak':'Perak',
    'perlis':'Perlis','pulau pinang':'Pulau Pinang','penang':'Pulau Pinang',
    'sabah':'Sabah','sarawak':'Sarawak','selangor':'Selangor',
    'terengganu':'Terengganu','w.p. kuala lumpur':'W.P. Kuala Lumpur',
    'wp kuala lumpur':'W.P. Kuala Lumpur','kuala lumpur':'W.P. Kuala Lumpur',
    'w.p. putrajaya':'W.P. Putrajaya','w.p. labuan':'W.P. Labuan',
}
FUEL = {'electric':'ev','hybrid_petrol':'hybrid','hybrid_diesel':'hybrid','petrol':'petrol'}

def normalize_state(raw):
    raw = (raw or '').strip()
    return ALIASES.get(raw.casefold())

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--cars',type=Path,default=Path('data/raw/cars_2026.csv'))
    p.add_argument('--national',type=Path,default=Path('data/raw/registrations_type_fuel.csv'))
    p.add_argument('--cleaned',type=Path,default=Path('data/derived/malaysia_hybrid_electric_cleaned.csv'))
    p.add_argument('--out',type=Path,default=Path('public/data/jpj_geographic_2026.json'))
    p.add_argument('--cutoff',default='2026-08')
    args=p.parse_args()
    if not args.cars.exists():
        p.error(f'Missing: {args.cars}')
    if len(args.cutoff)!=7 or args.cutoff[4]!='-' or not args.cutoff[:4].isdigit() or not args.cutoff[5:].isdigit():
        p.error('Cutoff must be YYYY-MM')
    group_counts=defaultdict(Counter)
    unallocated_counts=defaultdict(Counter)
    type_counts=defaultdict(Counter)
    brand_counts=defaultdict(Counter)
    model_counts=defaultdict(Counter)
    national_counts=defaultdict(Counter)
    reasons=Counter()
    total_read=0; through_cutoff=0; invalid_dates=0
    with args.cars.open(encoding='utf-8-sig',newline='') as fh:
        reader=csv.DictReader(fh)
        required={'date_reg','type','fuel','state','maker','model'}
        missing=required-set(reader.fieldnames or [])
        if missing: p.error(f'CSV missing columns: {sorted(missing)}')
        for row in reader:
            total_read+=1
            date=(row.get('date_reg') or '').strip()
            if len(date)<7 or date[4]!='-' or not date[:4].isdigit() or not date[5:7].isdigit():
                invalid_dates+=1; continue
            month=date[:7]
            if month>args.cutoff: continue
            through_cutoff+=1
            fuel=FUEL.get((row.get('fuel') or '').strip().lower(),'other')
            state=normalize_state(row.get('state'))
            name=state or 'Unallocated / Rakan Niaga'
            key=(month,name)
            target=group_counts if state else unallocated_counts
            target[key][fuel]+=1
            national_counts[month][fuel]+=1
            type_counts[(month,name)][(row.get('type') or 'Unknown').strip()]+=1
            brand=(row.get('maker') or 'Unknown').strip() or 'Unknown'
            model=(row.get('model') or 'Unknown').strip() or 'Unknown'
            brand_counts[(month,name,brand)][fuel]+=1
            model_counts[(month,name,brand,model)][fuel]+=1
            if not state:
                reasons[(row.get('state') or 'blank').strip() or 'blank']+=1

    def make_metric(month,state,counts):
        total=sum(counts.values()); ev=counts['ev']; hybrid=counts['hybrid']
        return {'month':month,'state':state,'total':total,'ev':ev,
                'hybrid':hybrid,'petrol':counts['petrol'],'other':counts['other'],
                'ev_share':round(ev/total*100,3) if total else None,
                'electrification_share':round((ev+hybrid)/total*100,3) if total else None}

    state_rows=[make_metric(m,s,c) for (m,s),c in sorted(group_counts.items())]
    unallocated_rows=[make_metric(m,s,c) for (m,s),c in sorted(unallocated_counts.items())]
    all_months=sorted(national_counts)
    coverage=[]; national=[]
    for m in all_months:
        c=national_counts[m]; total=sum(c.values()); assigned=sum(r['total'] for r in state_rows if r['month']==m)
        coverage.append({'month':m,'all':total,'known_state':assigned,'unallocated':total-assigned,
                         'coverage_pct':round(100*assigned/total,2) if total else None})
        national.append(make_metric(m,'Malaysia (2026 transactions)',c))

    brands=[{'month':m,'state':s,'brand':b,'total':sum(c.values()),
             'ev':c['ev'],'hybrid':c['hybrid'],'petrol':c['petrol']}
             for (m,s,b),c in sorted(brand_counts.items())]
    models=[{'month':m,'state':s,'brand':b,'model':model,'total':sum(c.values()),
             'ev':c['ev'],'hybrid':c['hybrid'],'petrol':c['petrol']}
             for (m,s,b,model),c in sorted(model_counts.items())]
    # Top N models can be derived in UI; never omit actual low-count entries from statistical outputs.
    source_validation={}
    if args.national.exists():
        with args.national.open(encoding='utf-8-sig',newline='') as fh:
            rows=csv.DictReader(fh)
            aggregate={}
            for r in rows:
                if r.get('type')!='car': continue
                if not (r.get('date') or '').startswith(args.cutoff): continue
                if r.get('fuel') in {'all_fuels','electric','hybrid'}:
                    aggregate[r['fuel']]=int(float(r['registrations']))
        x=national_counts.get(args.cutoff,Counter())
        source_validation={'comparison_month':args.cutoff,'national_monthly_dataset':aggregate,
                           'transactions_2026':{'all_fuels':sum(x.values()),'electric':x['ev'],'hybrid':x['hybrid']},
                           'note':'Differences are preserved; datasets may differ in reporting scope/timing.'}
    cleaned_validation={}
    if args.cleaned.exists():
        with args.cleaned.open(encoding='utf-8-sig',newline='') as fh:
            reader=csv.DictReader(fh)
            match=next((r for r in reader if (r.get('Date') or '').startswith(args.cutoff)),None)
        if match:
            cleaned_validation={'month':args.cutoff,'Electric':int(float(match['Electric'])),
                                'Hybrid':int(float(match['Hybrid'])),
                                'note':'Notebook training input; do not sum with national registrations.'}
    obj={
        'meta':{
            'dataset':'JPJ Car Registration Transactions (cars_2026.csv)',
            'source_url':'https://data.gov.my/data-catalogue/registration_transactions_car',
            'generated_at':datetime.now(timezone.utc).isoformat(),
            'cutoff':args.cutoff,'months':all_months,
            'records_input':total_read,'records_through_cutoff':through_cutoff,
            'invalid_dates':invalid_dates,
            'state_scope':'Known-state JPJ registrations only; NOT state vehicle ownership, sales, or EV penetration.',
            'warning':'Rakan Niaga/unknown-state records are unallocated and excluded from choropleth numerators and denominators.',
            'vehicle_scope':'All five vehicle type groups in JPJ 2026 car transaction file.',
            'fuel_mapping':{'ev':'electric','hybrid':'hybrid_petrol + hybrid_diesel','other':'other fuel categories'},
            'unallocated_reasons':dict(reasons),
            'source_reconciliation':source_validation,
            'cleaned_crosscheck':cleaned_validation
        },
        'coverage':coverage,'national':national,'states':state_rows,
        'unallocated':unallocated_rows,'brands':brands,'models':models
    }
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    latest=coverage[-1]
    print(f"Processed {total_read:,} rows; through {args.cutoff}: {through_cutoff:,}")
    print(f"Latest month {latest['month']}: known state {latest['known_state']:,} / {latest['all']:,} ({latest['coverage_pct']}%)")
    print(f"Saved {args.out} ({args.out.stat().st_size/1024:.1f} KiB)")

if __name__=='__main__': main()
