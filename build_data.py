import json, math
from pathlib import Path
import pandas as pd
import numpy as np
from scipy.optimize import curve_fit, minimize

ROOT=Path(__file__).parent
csv_path=ROOT/'data_sources/registrations_type_fuel.csv'
df=pd.read_csv(csv_path)
df=df[df['type']=='car'].copy()
piv=df.pivot_table(index='date',columns='fuel',values='registrations',aggfunc='sum',fill_value=0).sort_index()
rows=[]
for date,r in piv.loc['2022-01-01':].iterrows():
    total=int(r.get('all_fuels',0));ev=int(r.get('electric',0));hybrid=int(r.get('hybrid',0));petrol=int(r.get('petrol',0));
    rows.append({'date':date[:7],'total':total,'ev':ev,'hybrid':hybrid,'petrol':petrol,
    'evShare':round(ev/total*100,4) if total else 0,
    'hybridShare':round(hybrid/total*100,4) if total else 0,
    'electrifiedShare':round((ev+hybrid)/total*100,4) if total else 0,
    'evOfElectrified':round(ev/(ev+hybrid)*100,4) if ev+hybrid else 0})

# Refit exactly the trend structure from the user's Notebook on the supplied car registrations.
y=np.array([r['evOfElectrified']/100 for r in rows]);t=np.arange(1,len(y)+1,dtype=float)
def logistic(t,K,b,t0):return K/(1+np.exp(-b*(t-t0)))
p0,_=curve_fit(logistic,t,y,p0=[.7,.1,20],bounds=([.05,0,-50],[1,2,200]),maxfev=20000)
def nll(params):
    phi=params[-2];sigma=np.exp(params[-1]);
    if abs(phi)>=.99:return 1e10
    e=y-logistic(t,*params[:-2]);u=e[1:]-phi*e[:-1]
    l0=-.5*np.log(2*np.pi)-np.log(sigma)+.5*np.log(1-phi*phi)-(1-phi*phi)*e[0]*e[0]/(2*sigma*sigma)
    lr=np.sum(-.5*np.log(2*np.pi)-np.log(sigma)-u*u/(2*sigma*sigma))
    return -(l0+lr)
best=None
for phi in [.2,.5,.8]:
    start=[*p0,phi,np.log(np.std(y)/2)]
    res=minimize(nll,start,method='Nelder-Mead',options={'maxiter':40000,'xatol':1e-10,'fatol':1e-12})
    if best is None or res.fun<best.fun: best=res
pol=minimize(nll,best.x,method='BFGS')
if pol.fun<best.fun:best=pol
par=best.x;phi=float(par[-2]);sigma=float(np.exp(par[-1]));last_e=float(y[-1]-logistic(t[-1],*par[:-2]));
future_dates=pd.date_range('2026-09-01','2030-12-01',freq='MS')
forecast=[]
for h,d in enumerate(future_dates,1):
    mu=float(logistic(len(y)+h,*par[:-2])+phi**h*last_e)
    sd=float(np.sqrt(sigma*sigma*(1-phi**(2*h))/(1-phi*phi)))
    forecast.append({'date':d.strftime('%Y-%m'),'value':round(np.clip(mu*100,0,100),4),
        'lower':round(np.clip((mu-1.96*sd)*100,0,100),4),'upper':round(np.clip((mu+1.96*sd)*100,0,100),4)})
result={'meta':{'source':'JPJ data.gov.my · registrations_type_fuel.csv (user supplied)','start':'2022-01','end':rows[-1]['date'],'region':'Malaysia · car registrations','datasetRows':len(df),'model':'Logistic Ceiling + AR(1) M9','modelWindow':'Jan 2022 – Aug 2026','note':'Forecast is conditional on the fitted model, not an official JPJ forecast.'},'monthly':rows,'forecast':forecast}
(ROOT/'public/data/market.json').write_text(json.dumps(result,separators=(',',':')))

print('Generated market data from included source CSV:',len(rows),'months; 2030 model estimate:',forecast[-1]['value'])
