'use client';
import { uid } from './utils';
import type { Class, Exam, ExamResult } from './types';
const K={classes:'tc_classes',exams:'tc_exams',results:'tc_results'};
function load<T>(k:string):T[]{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}}
function save<T>(k:string,d:T[]){localStorage.setItem(k,JSON.stringify(d))}
export const getClasses=():Class[]=>load(K.classes);
export const addClass=(name:string,subject:string):Class=>{
  const c:Class={id:uid(),name,subject,createdAt:new Date().toISOString()};
  save(K.classes,[...getClasses(),c]);return c;
};
export const deleteClass=(id:string)=>{
  save(K.classes,getClasses().filter(c=>c.id!==id));
  save(K.exams,getExams().filter(e=>e.classId!==id));
  save(K.results,getResults().filter(r=>r.classId!==id));
};
export const getExams=():Exam[]=>load(K.exams);
export const getExamsByClass=(classId:string)=>getExams().filter(e=>e.classId===classId);
export const saveExam=(exam:Exam)=>{
  const all=getExams();const i=all.findIndex(e=>e.id===exam.id);
  if(i>=0)all[i]=exam;else all.push(exam);save(K.exams,all);
};
export const getResults=():ExamResult[]=>load(K.results);
export const getResultsByClass=(classId:string)=>getResults().filter(r=>r.classId===classId);
export const getResultByExam=(examId:string)=>getResults().find(r=>r.examId===examId);
export const saveResult=(result:ExamResult)=>{
  const all=getResults();const i=all.findIndex(r=>r.examId===result.examId);
  if(i>=0)all[i]=result;else all.push(result);save(K.results,all);
};
export const updateOverride=(examId:string,sName:string,qNo:number,mark:number,reason:string)=>{
  const all=getResults();const ri=all.findIndex(r=>r.examId===examId);if(ri<0)return;
  const si=all[ri].students.findIndex(s=>s.name===sName);if(si<0)return;
  const qi=all[ri].students[si].questions.findIndex(q=>q.qNo===qNo);if(qi<0)return;
  all[ri].students[si].questions[qi]={...all[ri].students[si].questions[qi],isOverridden:true,overriddenMark:mark,overrideReason:reason};
  all[ri].students[si].totalMarks=all[ri].students[si].questions.reduce((s,q)=>s+(q.isOverridden&&q.overriddenMark!=null?q.overriddenMark:q.marksAwarded),0);
  save(K.results,all);
};
export const getStudentHistory=(name:string,classId:string)=>
  getResults().filter(r=>r.classId===classId&&r.students.some(s=>s.name===name));

// ── Backup & Restore ──────────────────────────────────────────────────────────
export function exportAllData():void{
  const data={classes:getClasses(),exams:getExams(),results:getResults(),exportedAt:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`teacher-copilot-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

export function importAllData(file:File):Promise<void>{
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=(e)=>{
      try{
        const data=JSON.parse(e.target?.result as string);
        if(data.classes)save(K.classes,data.classes);
        if(data.exams)save(K.exams,data.exams);
        if(data.results)save(K.results,data.results);
        resolve();
      }catch{reject(new Error('Invalid backup file. Please select a valid Teacher Copilot backup JSON.'));}
    };
    reader.onerror=()=>reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}
