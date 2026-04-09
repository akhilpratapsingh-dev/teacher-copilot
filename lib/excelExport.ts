import * as XLSX from 'xlsx';
import type {ExamResult} from './types';
export function exportToExcel(result:ExamResult){
  const {students,className,subject}=result;
  const numQ=students[0]?.questions.length||0;
  const qH=Array.from({length:numQ},(_,i)=>'Q'+(i+1));
  const maxTotal=students[0]?.maxMarks||0;
  const rows=students.map(s=>{
    const scores=s.questions.map(q=>q.isOverridden&&q.overriddenMark!=null?q.overriddenMark:q.marksAwarded);
    const total=scores.reduce((a,b)=>a+Number(b),0);
    return[s.name,...scores,total,maxTotal>0?((total/maxTotal)*100).toFixed(1)+'%':'0%',s.overallFeedback||''];
  });
  const ws=XLSX.utils.aoa_to_sheet([['Student',...qH,'Total','%','Feedback'],...rows]);
  XLSX.utils.book_append_sheet(XLSX.utils.book_new(),ws,'Marks');
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Marks');
  XLSX.writeFile(wb,(className||'Class')+'_'+(subject||'Sub')+'_Marks.xlsx');
}
