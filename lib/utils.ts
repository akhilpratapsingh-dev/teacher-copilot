import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...i: ClassValue[]) { return twMerge(clsx(i)) }
export function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,7) }
export function pct(s:number,m:number){return m===0?'0%':Math.round((s/m)*100)+'%'}
export function scoreColor(s:number,m:number){
  if(m===0)return'text-gray-400';const p=s/m;
  if(p>=0.8)return'text-emerald-600 dark:text-emerald-400';
  if(p>=0.5)return'text-amber-600 dark:text-amber-400';
  return'text-red-500 dark:text-red-400';
}
export function scoreGrade(s:number,m:number){if(m===0)return'-';const p=(s/m)*100;if(p>=80)return'A';if(p>=60)return'B';if(p>=40)return'C';return'D';}
export function formatDate(iso:string){return new Date(iso).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
export function strSimilarity(a:string,b:string):number{
  const sa=a.toLowerCase().split(/\s+/);const sb=new Set(b.toLowerCase().split(/\s+/));
  if(!sa.length)return 0;return sa.filter(w=>sb.has(w)).length/sa.length;
}
