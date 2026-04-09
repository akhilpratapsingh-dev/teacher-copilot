'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, AlertTriangle, ChevronDown, ChevronUp, Copy, CheckCircle2, RotateCcw } from 'lucide-react';
import { getResults, updateOverride, saveResult } from '@/lib/storage';
import { exportToExcel } from '@/lib/excelExport';
import { pct, scoreColor, scoreGrade, formatDate } from '@/lib/utils';
import type { ExamResult } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

type Tab = 'students'|'class'|'charts'|'plan';

export default function ExamResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<ExamResult | null>(null);
  const [tab, setTab] = useState<Tab>('students');
  const [activeStudent, setActiveStudent] = useState(0);
  const [overrides, setOverrides] = useState<{[k:string]:number}>({});
  const [overrideReasons, setOverrideReasons] = useState<{[k:string]:string}>({});
  const [savedKeys, setSavedKeys] = useState<{[k:string]:boolean}>({});
  const [expandedQ, setExpandedQ] = useState<{[k:string]:boolean}>({});
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const refresh = useCallback(() => { setResult(getResults().find(r => r.examId === id) || null); }, [id]);
  useEffect(() => { refresh(); }, [refresh]);
  if (!result) return <div className="text-center py-20 text-gray-400">Exam not found.</div>;

  const { students, classInsights } = result;
  const maxTotal = students[0]?.maxMarks || 0;
  const effMark = (sName: string, qNo: number, ai: number) => overrides[sName+'_'+qNo] !== undefined ? overrides[sName+'_'+qNo] : ai;
  const effTotal = (s: typeof students[0]) => s.questions.reduce((sum, q) => sum + effMark(s.name, q.qNo, q.isOverridden && q.overriddenMark != null ? q.overriddenMark : q.marksAwarded), 0);
  const classAvg = students.length ? (students.reduce((s, st) => s + effTotal(st), 0) / students.length).toFixed(1) : '0';

  const handleSaveOverride = (s: typeof students[0], qNo: number) => {
    const key = s.name+'_'+qNo;
    if (overrides[key] === undefined) return;
    updateOverride(result.examId, s.name, qNo, overrides[key], overrideReasons[key]||'');
    setSavedKeys(x => ({...x,[key]:true})); refresh();
  };

  const handleExport = () => {
    exportToExcel(result); setExportDone(true); setTimeout(() => setExportDone(false), 3000);
  };

  const student = students[activeStudent];
  const tt = {backgroundColor:'#fff',border:'1px solid #e5e7eb',borderRadius:'12px',fontSize:'12px'};

  const studentBarData = students.map(s => ({ name: s.name.split(' ')[0], Marks: effTotal(s), Max: maxTotal }));
  const qBarData = result.questions ? result.questions.map((q, qi) => {
    const scores = students.map(s => effMark(s.name, s.questions[qi]?.qNo || qi+1, s.questions[qi]?.marksAwarded || 0));
    const avg = scores.length ? scores.reduce((a,b) => a+b, 0)/scores.length : 0;
    return { name: 'Q'+(qi+1), Average: parseFloat(avg.toFixed(1)), Max: q.maxMarks };
  }) : students[0]?.questions.map((q, qi) => {
    const scores = students.map(s => effMark(s.name, q.qNo, s.questions[qi]?.marksAwarded || 0));
    const avg = scores.reduce((a,b)=>a+b,0)/Math.max(scores.length,1);
    return { name: 'Q'+q.qNo, Average: parseFloat(avg.toFixed(1)), Max: q.maxMarks };
  });
  const dist:{[k:string]:number}={'A (≥80%)':0,'B (60-79%)':0,'C (40-59%)':0,'D (<40%)':0};
  students.forEach(s => { const p=maxTotal>0?effTotal(s)/maxTotal:0; if(p>=0.8)dist['A (≥80%)']++;else if(p>=0.6)dist['B (60-79%)']++;else if(p>=0.4)dist['C (40-59%)']++;else dist['D (<40%)']++; });
  const pieData=Object.entries(dist).filter(([,v])=>v>0).map(([n,v])=>({name:n,value:v}));
  const PIE_COLORS=['#10b981','#f59e0b','#6366f1','#ef4444'];

  const tabs:{id:Tab;label:string}[]=[{id:'students',label:'👩‍🎓 Students'},{id:'class',label:'📊 Class'},{id:'charts',label:'📈 Charts'},{id:'plan',label:'💡 Plan'}];

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href={'/classes/' + result.classId} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" /> {result.className}
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{result.title}</h1>
          <p className="text-sm text-gray-400">{result.subject} · {formatDate(result.date)} · {students.length} students</p>
        </div>
        <button onClick={handleExport} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${exportDone ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-600 dark:hover:text-primary-400'} shadow-sm`}>
          <Download className="w-4 h-4" /> {exportDone ? 'Downloaded!' : 'Export Excel'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          {label:'Avg Score',value:classAvg+'/'+maxTotal,color:'text-primary-600 dark:text-primary-400'},
          {label:'Students',value:students.length,color:'text-gray-700 dark:text-gray-300'},
          {label:'Top Score',value:Math.max(...students.map(s=>effTotal(s)))+'/'+maxTotal,color:'text-emerald-600 dark:text-emerald-400'},
          {label:'Flagged',value:students.filter(s=>s.plagiarismFlag).length,color:'text-amber-600 dark:text-amber-400'},
        ].map(({label,value,color})=>(
          <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3 shadow-sm text-center">
            <div className={`text-lg font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6 gap-1">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all whitespace-nowrap ${tab===t.id?'border-primary-500 text-primary-600 dark:text-primary-400':'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>{t.label}</button>
        ))}
      </div>

      {tab==='students'&&(
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            {students.map((s,i)=>{
              const total=effTotal(s);const col=total/maxTotal>=0.8?'#10b981':total/maxTotal>=0.5?'#f59e0b':'#ef4444';
              return(
                <button key={i} onClick={()=>setActiveStudent(i)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all border ${activeStudent===i?'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300':'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                  {s.plagiarismFlag&&<AlertTriangle className="w-3.5 h-3.5 text-amber-500"/>}
                  {s.name}
                  <span className="font-bold text-xs" style={{color:col}}>{total}/{maxTotal}</span>
                </button>
              );
            })}
          </div>

          {student&&(
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{student.name}</h3>
                    {student.plagiarismFlag&&<span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>Similar to {student.plagiarismWith?.join(', ')}</span>}
                  </div>
                  <p className="text-sm text-gray-400">Revise: <span className="text-gray-600 dark:text-gray-300">{student.revise}</span></p>
                </div>
                <div className={`px-4 py-2 rounded-xl border-2 text-center ${scoreColor(effTotal(student),maxTotal).replace('text-','border-').replace(' dark:text-emerald-400',' dark:border-emerald-700').replace(' dark:text-amber-400',' dark:border-amber-700').replace(' dark:text-red-400',' dark:border-red-700')} bg-opacity-10`}>
                  <div className={`text-2xl font-bold ${scoreColor(effTotal(student),maxTotal)}`}>{effTotal(student)}/{maxTotal}</div>
                  <div className="text-xs text-gray-400">{pct(effTotal(student),maxTotal)} · Grade {scoreGrade(effTotal(student),maxTotal)}</div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Overall Feedback</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{student.overallFeedback}</p>
                <button onClick={()=>{navigator.clipboard.writeText(student.overallFeedback);setCopiedFeedback(true);setTimeout(()=>setCopiedFeedback(false),2000);}} className="mt-2 text-xs text-gray-400 hover:text-primary-500 flex items-center gap-1 transition-colors">
                  {copiedFeedback?<><CheckCircle2 className="w-3 h-3 text-emerald-500"/>Copied!</>:<><Copy className="w-3 h-3"/>Copy Feedback</>}
                </button>
              </div>

              <div className="space-y-2">
                {student.questions.map((q,qi)=>{
                  const key=student.name+'_'+q.qNo;
                  const em=overrides[key]!==undefined?overrides[key]:(q.isOverridden&&q.overriddenMark!=null?q.overriddenMark:q.marksAwarded);
                  const maxQ=q.maxMarks; const isExp=expandedQ[key];
                  return(
                    <div key={qi} className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                      <button onClick={()=>setExpandedQ(x=>({...x,[key]:!x[key]}))} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded">Q{q.qNo}</span>
                          <span className={`text-xs font-bold ${scoreColor(em,maxQ)}`}>{em}/{maxQ}</span>
                          {q.isOverridden&&<span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">edited</span>}
                        </div>
                        {isExp?<ChevronUp className="w-4 h-4 text-gray-400"/>:<ChevronDown className="w-4 h-4 text-gray-400"/>}
                      </button>
                      {isExp&&(
                        <div className="px-4 pb-4 space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3"><p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">✅ Strength</p><p className="text-xs text-gray-600 dark:text-gray-300">{q.strength}</p></div>
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3"><p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">❌ Mistake</p><p className="text-xs text-gray-600 dark:text-gray-300">{q.mistake}</p></div>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3"><p className="text-xs font-semibold text-gray-400 mb-1">💬 Feedback</p><p className="text-xs text-gray-600 dark:text-gray-300">{q.feedback}</p></div>
                          <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3">
                            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1"><RotateCcw className="w-3 h-3"/>Manual Override <span className="font-normal text-gray-400">AI gave: {q.marksAwarded}/{maxQ}</span></p>
                            <div className="flex gap-2">
                              <input type="number" min="0" max={maxQ} placeholder={String(q.marksAwarded)} className="w-20 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-center font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400" value={overrides[key]!==undefined?overrides[key]:''} onChange={e=>setOverrides(x=>({...x,[key]:Number(e.target.value)}))} />
                              <input placeholder="Reason (optional)" className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400" value={overrideReasons[key]||''} onChange={e=>setOverrideReasons(x=>({...x,[key]:e.target.value}))} />
                              <button onClick={()=>handleSaveOverride(student,q.qNo)} disabled={overrides[key]===undefined} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${savedKeys[key]?'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700':'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 disabled:opacity-50'}`}>{savedKeys[key]?'✅ Saved':'Save'}</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab==='class'&&(
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm overflow-x-auto">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Marks Summary</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 uppercase tracking-wide">{['Student',...students[0]?.questions.map(q=>'Q'+q.qNo)||[],'Total','%','Grade'].map((h,i)=><th key={i} className="text-left py-2 px-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody>{students.map((s,si)=>{const t=effTotal(s);return(<tr key={si} className="border-t border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"><td className="py-2.5 px-2 font-medium text-gray-800 dark:text-gray-200">{s.name}{s.plagiarismFlag&&<AlertTriangle className="w-3 h-3 text-amber-500 inline ml-1"/>}</td>{s.questions.map((q,qi)=>{const em=effMark(s.name,q.qNo,q.isOverridden&&q.overriddenMark!=null?q.overriddenMark:q.marksAwarded);return<td key={qi} className={`py-2.5 px-2 font-bold text-xs ${scoreColor(em,q.maxMarks)}`}>{em}</td>;})} <td className={`py-2.5 px-2 font-bold ${scoreColor(t,maxTotal)}`}>{t}</td><td className={`py-2.5 px-2 font-bold ${scoreColor(t,maxTotal)}`}>{pct(t,maxTotal)}</td><td className={`py-2.5 px-2 font-bold ${scoreColor(t,maxTotal)}`}>{scoreGrade(t,maxTotal)}</td></tr>)})}</tbody>
            </table>
          </div>
          {classInsights.commonMistakes.length>0&&<div className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 shadow-sm"><h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">⚠️ Common Mistakes</h3><ul className="space-y-1.5">{classInsights.commonMistakes.map((m,i)=><li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2"><span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0"/>{m}</li>)}</ul></div>}
          {classInsights.weakTopics.length>0&&<div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm"><h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">🎯 Weak Topics</h3><div className="flex flex-wrap gap-2">{classInsights.weakTopics.map((t,i)=><span key={i} className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-3 py-1 rounded-full font-medium">{t}</span>)}</div></div>}
          {classInsights.classSummary&&<div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm"><h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">📊 Summary</h3><p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{classInsights.classSummary}</p></div>}
        </div>
      )}

      {tab==='charts'&&(
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Student Scores</h3>
            <ResponsiveContainer width="100%" height={260}><BarChart data={studentBarData} margin={{top:5,right:10,left:0,bottom:5}}><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/><XAxis dataKey="name" tick={{fontSize:11,fill:'#9ca3af'}}/><YAxis domain={[0,maxTotal]} tick={{fontSize:11,fill:'#9ca3af'}}/><Tooltip contentStyle={tt}/><Bar dataKey="Marks" fill="#6366f1" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer>
          </div>
          {qBarData&&qBarData.length>0&&<div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm"><h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Avg Per Question</h3><ResponsiveContainer width="100%" height={220}><BarChart data={qBarData} margin={{top:5,right:10,left:0,bottom:5}}><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/><XAxis dataKey="name" tick={{fontSize:11,fill:'#9ca3af'}}/><YAxis tick={{fontSize:11,fill:'#9ca3af'}}/><Tooltip contentStyle={tt}/><Bar dataKey="Average" fill="#10b981" radius={[6,6,0,0]}/><Bar dataKey="Max" fill="#e5e7eb" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div>}
          {pieData.length>0&&<div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm"><h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Grade Distribution</h3><ResponsiveContainer width="100%" height={300}><PieChart margin={{top:10,right:20,left:20,bottom:10}}><Pie data={pieData} cx="50%" cy="45%" innerRadius={65} outerRadius={100} paddingAngle={4} dataKey="value" label={({name,value})=>`${name}: ${value}`} labelLine={true}>{pieData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}</Pie><Tooltip contentStyle={tt} formatter={(value:number,name:string)=>[value+' student(s)',name]}/><Legend verticalAlign="bottom" height={36} iconType="circle"/></PieChart></ResponsiveContainer></div>}
        </div>
      )}

      {tab==='plan'&&(
        <div className="space-y-4">
          {classInsights.teachingSuggestions.length>0&&<div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm"><h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">💡 Teaching Suggestions</h3><div className="space-y-3">{classInsights.teachingSuggestions.map((s,i)=><div key={i} className="flex items-start gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl"><span className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i+1}</span><p className="text-sm text-gray-700 dark:text-gray-300">{s}</p></div>)}</div></div>}
          {classInsights.weakTopics.length>0&&<div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm"><h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">📌 Quick Actions</h3><div className="space-y-3">{[{icon:'📚',title:'Schedule Extra Class',desc:'Focus on: '+classInsights.weakTopics[0]},{icon:'📝',title:'Assign Worksheet',desc:'Cover common mistakes identified above'},{icon:'🔁',title:'Plan Revision Quiz',desc:'Topics: '+classInsights.weakTopics.join(', ')}].map((a,i)=><div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl"><span className="text-xl">{a.icon}</span><div><p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{a.title}</p><p className="text-xs text-gray-400">{a.desc}</p></div></div>)}</div></div>}
        </div>
      )}
    </div>
  );
}
