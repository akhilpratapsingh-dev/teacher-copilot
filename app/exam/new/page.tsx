'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useRef, useCallback, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Upload, FileText, ChevronRight, Loader2, CheckCircle2, AlertTriangle, FolderOpen } from 'lucide-react';
import { getClasses, saveResult } from '@/lib/storage';
import { parseQuestionsFromPdf, extractStudentAnswers, evaluateStudents } from '@/lib/ai';
import { extractTextFromPdf } from '@/lib/pdfParser';
import { uid, strSimilarity } from '@/lib/utils';
import type { Question, StudentAnswer, ExamResult } from '@/lib/types';

const STEPS = ['Answer Key', 'Student PDFs', 'AI Grading', 'Results'];

function nameFromFile(f: File) { return f.name.replace(/\.pdf$/i,'').replace(/[_-]/g,' ').trim(); }

function ExamWizardInner() {
  const params = useSearchParams();
  const router = useRouter();
  const classId = params.get('classId') || '';
  // Defer localStorage access to client-side only to avoid SSR hydration mismatch
  const [cls, setCls] = useState<ReturnType<typeof getClasses>[number] | undefined>(undefined);
  useEffect(() => {
    setCls(getClasses().find(c => c.id === classId));
  }, [classId]);

  const [step, setStep] = useState(0);
  const [examTitle, setExamTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([
    { id: uid(), text: '', answer: '', maxMarks: 5 },
    { id: uid(), text: '', answer: '', maxMarks: 5 },
  ]);
  const [students, setStudents] = useState<StudentAnswer[]>([]);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfStatus, setPdfStatus] = useState('');
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [gradingProgress, setGradingProgress] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qPdfRef = useRef<HTMLInputElement>(null);

  const addQ = () => setQuestions(qs => [...qs, { id: uid(), text: '', answer: '', maxMarks: 5 }]);
  const removeQ = (i: number) => { if (questions.length > 1) setQuestions(qs => qs.filter((_,j) => j !== i)); };
  const updateQ = (i: number, f: keyof Question, v: string | number) => setQuestions(qs => { const u=[...qs]; u[i]={...u[i],[f]:v}; return u; });

  const handleQPdf = async (file: File | null | undefined) => {
    if (!file) return;
    setError(''); setPdfLoading(true); setPdfStatus('Reading PDF...');
    try {
      const text = await extractTextFromPdf(file);
      setPdfStatus('AI is extracting questions...');
      const qs = await parseQuestionsFromPdf(text);
      if (!qs.length) throw new Error('No questions found in PDF');
      setQuestions(qs.map((q: Question) => ({ id: uid(), text: q.text, answer: q.answer, maxMarks: q.maxMarks })));
      setPdfStatus('Done! ' + qs.length + ' questions extracted.');
    } catch (e: unknown) { setError('PDF error: ' + (e instanceof Error ? e.message : String(e))); setPdfStatus(''); }
    finally { setPdfLoading(false); }
  };

  const processBulkFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setError(''); setBulkProgress({ done: 0, total: files.length, current: '' });
    const results: StudentAnswer[] = [];
    for (let i = 0; i < files.length; i++) {
      setBulkProgress({ done: i, total: files.length, current: files[i].name });
      try {
        const text = await extractTextFromPdf(files[i]);
        const parsed = await extractStudentAnswers(text, questions);
        const name = parsed.studentName?.trim() || nameFromFile(files[i]);
        const answers = Array(questions.length).fill('');
        (parsed.answers || []).forEach((a: string, qi: number) => { if (qi < questions.length) answers[qi] = a; });
        results.push({ name, answers });
      } catch { results.push({ name: nameFromFile(files[i]), answers: Array(questions.length).fill('') }); }
    }
    setBulkProgress({ done: files.length, total: files.length, current: '' });
    setStudents(results); setTimeout(() => setBulkProgress(null), 2000);
  }, [questions]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.name.endsWith('.pdf'));
    e.target.value = '';
    processBulkFiles(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    processBulkFiles(Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.pdf')));
  };

  const handleGrade = async () => {
    setError(''); setGradingProgress('Sending to AI...');
    try {
      const cls2 = cls || { name: 'Class', subject: 'Subject' };
      setGradingProgress('AI is grading each student...');
      const rawResult = await evaluateStudents({ className: cls2.name, subject: cls2.subject, questions, students });
      if (!rawResult.students?.length) throw new Error('AI returned no results');
      const now = new Date().toISOString();
      const examId = uid();
      const studentsWithPlagiarism = rawResult.students.map((s: { name: string; questions: { qNo: number; marksAwarded: number; maxMarks: number; strength: string; mistake: string; feedback: string }[]; totalMarks: number; overallFeedback: string; revise: string }, si: number) => {
        const pFlags: string[] = [];
        rawResult.students.forEach((other: { name: string; questions: { qNo: number; marksAwarded: number; maxMarks: number; strength: string; mistake: string; feedback: string }[] }, oi: number) => {
          if (si === oi) return;
          const totalSim = s.questions.reduce((sum: number, q: { qNo: number; marksAwarded: number; maxMarks: number; strength: string; mistake: string; feedback: string }, qi: number) => {
            const myAns = students[si]?.answers[qi] || '';
            const theirAns = students[oi]?.answers[qi] || '';
            return sum + strSimilarity(myAns, theirAns);
          }, 0) / Math.max(s.questions.length, 1);
          if (totalSim > 0.7) pFlags.push(other.name);
        });
        return { ...s, maxMarks: questions.reduce((sum, q) => sum + q.maxMarks, 0), plagiarismFlag: pFlags.length > 0, plagiarismWith: pFlags };
      });
      const examResult: ExamResult = {
        id: uid(), examId, classId: classId, className: cls2.name, subject: cls2.subject,
        title: examTitle || cls2.subject + ' Exam', date: now,
        students: studentsWithPlagiarism, classInsights: rawResult.classInsights, createdAt: now,
      };
      saveResult(examResult);
      setResult(examResult);
      setGradingProgress('');
      setStep(3);
    } catch (e: unknown) { setError('Grading failed: ' + (e instanceof Error ? e.message : String(e))); setGradingProgress(''); }
  };

  const pct2 = bulkProgress ? Math.round((bulkProgress.done / bulkProgress.total) * 100) : 0;

  return (
    <div className="animate-fade-up max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={classId ? '/classes/' + classId : '/'} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {cls?.name || 'Back'}
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${i < step ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : i === step ? 'bg-primary-600 text-white shadow-lg shadow-primary-200 dark:shadow-none' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
              {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{i+1}</span>}
              <span className="hidden sm:inline">{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded-full ${i < step ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-gray-200 dark:bg-gray-700'}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 mb-4 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {step === 0 && (
        <div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-4 shadow-sm">
            <h2 className="font-bold text-gray-900 dark:text-white mb-1">Exam Setup</h2>
            <p className="text-sm text-gray-400 mb-4">Give this exam a title and upload your question paper PDF</p>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Exam Title</label>
            <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-4" placeholder={'e.g. ' + (cls?.subject || 'Subject') + ' Unit Test 1'} value={examTitle} onChange={e => setExamTitle(e.target.value)} />
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-fill from PDF</p>
                <p className="text-xs text-gray-400">AI extracts all questions automatically</p>
              </div>
              <label className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all ${pdfLoading ? 'bg-gray-200 dark:bg-gray-700 text-gray-400' : 'bg-primary-600 hover:bg-primary-700 text-white shadow-md shadow-primary-200 dark:shadow-none'}`}>
                {pdfLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing...</> : <><Upload className="w-4 h-4" /> Upload PDF</>}
                <input ref={qPdfRef} type="file" accept=".pdf" className="hidden" disabled={pdfLoading} onChange={e => handleQPdf(e.target.files?.[0])} />
              </label>
            </div>
            {pdfStatus && <p className={`mt-2 text-xs px-3 py-2 rounded-lg ${pdfStatus.startsWith('Done') ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'}`}>{pdfStatus}</p>}
          </div>

          <div className="space-y-3 mb-4">
            {questions.map((q, i) => (
              <div key={q.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-md">Q{i+1}</span>
                  <input type="number" min="1" max="100" className="w-20 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500 ml-auto" placeholder="Marks" value={q.maxMarks} onChange={e => updateQ(i, 'maxMarks', Number(e.target.value))} />
                  {questions.length > 1 && <button onClick={() => removeQ(i)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
                <textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none mb-2" rows={2} placeholder="Question text..." value={q.text} onChange={e => updateQ(i, 'text', e.target.value)} />
                <textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" rows={2} placeholder="Model answer / answer key..." value={q.answer} onChange={e => updateQ(i, 'answer', e.target.value)} />
              </div>
            ))}
          </div>

          <button onClick={addQ} className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl py-3 text-sm text-gray-400 hover:text-primary-500 hover:border-primary-300 dark:hover:border-primary-700 transition-all flex items-center justify-center gap-2 mb-6">
            <Plus className="w-4 h-4" /> Add Question
          </button>

          <button onClick={() => { if (questions.some(q => !q.text.trim() || !q.answer.trim())) return setError('Fill all question fields'); setError(''); setStep(1); }} className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary-200 dark:shadow-none transition-all">
            Continue to Student Upload <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 1 && (
        <div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-4 shadow-sm">
            <h2 className="font-bold text-gray-900 dark:text-white mb-1">Upload Student Answer Sheets</h2>
            <p className="text-sm text-gray-400 mb-4">Select all student PDFs at once — AI extracts each student name and answers</p>

            <input ref={fileRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleFileInput} />

            <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${dragOver ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}>
              {bulkProgress ? (
                <div className="py-2">
                  <div className="text-sm text-gray-600 dark:text-gray-300 mb-3 font-medium">
                    {bulkProgress.done < bulkProgress.total ? 'Processing ' + (bulkProgress.done + 1) + ' / ' + bulkProgress.total + ' — ' + bulkProgress.current : <span className="text-emerald-600 dark:text-emerald-400">All {bulkProgress.total} students processed!</span>}
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 rounded-full transition-all duration-500" style={{width: pct2 + '%'}} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{pct2}% complete</p>
                </div>
              ) : (
                <div>
                  <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Drop student PDFs here</p>
                  <p className="text-xs text-gray-400 mb-4">or click the button below</p>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 mb-4 text-left space-y-2">
                    {[
                      '1. Click Browse below to open the file picker',
                      '2. Click first PDF, hold Ctrl, click each other PDF (they turn blue)',
                      '3. Click Open — all PDFs are processed together',
                      'Tip: Press Ctrl+A inside the picker to select all files at once',
                    ].map((tip, i) => (
                      <div key={i} className={`flex items-start gap-2 text-xs ${i === 3 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${i === 3 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-primary-100 dark:bg-primary-900/30 text-primary-600'}`}>{i === 3 ? '💡' : i+1}</span>
                        {tip}
                      </div>
                    ))}
                  </div>
                  <button onClick={e => { e.stopPropagation(); fileRef.current?.click(); }} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold mx-auto shadow-lg shadow-primary-200 dark:shadow-none transition-all">
                    <FileText className="w-4 h-4" /> Browse & Select PDFs
                  </button>
                </div>
              )}
            </div>
          </div>

          {students.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 mb-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{students.length} student{students.length !== 1 ? 's' : ''} ready:</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {students.map((s, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-xs font-bold text-primary-600 dark:text-primary-400">{s.name.charAt(0).toUpperCase()}</div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{s.name}</span>
                    </div>
                    <span className="text-xs text-gray-400">{s.answers.filter(a => a.trim()).length}/{questions.length} answers</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="flex-1 border border-gray-200 dark:border-gray-700 rounded-2xl py-3 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">← Back</button>
            <button onClick={() => { if (!students.length) return setError('Upload at least one student PDF'); setError(''); setStep(2); }} disabled={!students.length} className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary-200 dark:shadow-none transition-all">
              Grade {students.length} Student{students.length !== 1 ? 's' : ''} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-sm text-center">
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Questions', value: questions.length },
              { label: 'Students', value: students.length },
              { label: 'Total Marks', value: questions.reduce((s, q) => s + q.maxMarks, 0) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2 mb-8 text-left">
            {['Per-question marks with AI rubric scoring','Strengths and mistakes per question','Ready-to-send written feedback','Class common mistakes and weak topics','Plagiarism similarity detection','Teaching suggestions and focus topics'].map(feat => (
              <div key={feat} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> {feat}
              </div>
            ))}
          </div>
          {gradingProgress ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{gradingProgress}</p>
              <p className="text-xs text-gray-400">May take 20-40 seconds for large batches...</p>
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-200 dark:border-gray-700 rounded-2xl py-3 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">← Back</button>
              <button onClick={handleGrade} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary-200 dark:shadow-none transition-all">
                ⚡ Start AI Grading
              </button>
            </div>
          )}
        </div>
      )}

      {step === 3 && result && (
        <div className="text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-sm">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Grading Complete!</h2>
          <p className="text-gray-400 text-sm mb-6">{result.students.length} students graded · Saved to class history</p>
          <button onClick={() => router.push('/exam/' + result.examId)} className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-2xl font-semibold shadow-lg shadow-primary-200 dark:shadow-none transition-all">
            View Full Results & Analytics →
          </button>
        </div>
      )}
    </div>
  );
}

export default function NewExamPage() {
  return <Suspense fallback={<div className="text-center py-20 text-gray-400">Loading...</div>}><ExamWizardInner /></Suspense>;
}
