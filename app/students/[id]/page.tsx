'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getStudentHistory, getClasses } from '@/lib/storage';
import { pct, scoreColor, scoreGrade, formatDate } from '@/lib/utils';
import type { ExamResult } from '@/lib/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Suspense } from 'react';

function StudentProfileInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const name = decodeURIComponent(params.id);
  const classId = searchParams.get('classId') || '';
  const [history, setHistory] = useState<ExamResult[]>([]);
  const [cls, setCls] = useState<{ name: string; subject: string } | null>(null);
  const refresh = useCallback(() => {
    setHistory(getStudentHistory(name, classId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    const c = getClasses().find(c => c.id === classId); if (c) setCls(c);
  }, [name, classId]);
  useEffect(() => { refresh(); }, [refresh]);

  const studentExams = history.map(e => {
    const s = e.students.find(s => s.name === name);
    if (!s) return null;
    return { examId: e.examId, title: e.title, date: e.date, totalMarks: s.totalMarks, maxMarks: s.maxMarks, percentage: s.maxMarks > 0 ? Math.round((s.totalMarks / s.maxMarks) * 100) : 0, revise: s.revise, feedback: s.overallFeedback, plagiarismFlag: s.plagiarismFlag };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  const chartData = studentExams.map((e, i) => ({ name: 'Exam ' + (i + 1), '%': e.percentage, title: e.title }));
  const avgPct = studentExams.length ? Math.round(studentExams.reduce((s, e) => s + e.percentage, 0) / studentExams.length) : 0;
  const latest = studentExams[studentExams.length - 1];
  const previous = studentExams[studentExams.length - 2];
  const trend = latest && previous ? (latest.percentage - previous.percentage) : null;
  const TrendIcon = trend === null ? Minus : trend > 0 ? TrendingUp : TrendingDown;
  const trendColor = trend === null ? 'text-gray-400' : trend > 0 ? 'text-emerald-500' : 'text-red-500';

  if (!studentExams.length) return (
    <div className="animate-fade-up">
      <Link href={classId ? '/classes/' + classId : '/'} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors mb-4"><ArrowLeft className="w-4 h-4" /> {cls?.name || 'Back'}</Link>
      <div className="text-center py-20 text-gray-400">No exam history for {name}</div>
    </div>
  );

  const tt = { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '12px' };
  const worstRevise = studentExams.map(e => e.revise).flatMap(r => r.split(/[,;]/)).map(r => r.trim()).filter(Boolean);
  const reviseCounts: { [k: string]: number } = {};
  worstRevise.forEach(t => { reviseCounts[t] = (reviseCounts[t] || 0) + 1; });
  const topRevise = Object.entries(reviseCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t);

  return (
    <div className="animate-fade-up">
      <Link href={classId ? '/classes/' + classId : '/'} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /> {cls?.name || 'Back'}
      </Link>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-primary-100 dark:shadow-none">
          {name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{name}</h1>
          <p className="text-sm text-gray-400">{cls?.name} · {cls?.subject} · {studentExams.length} exam{studentExams.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="ml-auto text-right">
          <div className={`text-3xl font-bold ${scoreColor(avgPct, 100)}`}>{avgPct}%</div>
          <div className="flex items-center gap-1 justify-end text-sm">
            <TrendIcon className={`w-4 h-4 ${trendColor}`} />
            <span className={`text-xs font-medium ${trendColor}`}>{trend !== null ? (trend > 0 ? '+' + trend + '%' : trend + '%') : 'First exam'}</span>
          </div>
        </div>
      </div>

      {studentExams.length > 1 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">📈 Progress Over Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip contentStyle={tt} formatter={(v) => [v + '%', 'Score']} />
              <ReferenceLine y={avgPct} stroke="#6366f1" strokeDasharray="4 4" label={{ value: 'Avg', fill: '#6366f1', fontSize: 11 }} />
              <Line type="monotone" dataKey="%" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 5 }} activeDot={{ r: 7 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {topRevise.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-4">
          <h3 className="font-semibold text-amber-700 dark:text-amber-400 mb-2 text-sm">📌 Priority Revision Topics</h3>
          <div className="flex flex-wrap gap-2">{topRevise.map((t, i) => <span key={i} className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 px-3 py-1 rounded-full font-medium">{t}</span>)}</div>
        </div>
      )}

      <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Exam History</h2>
      <div className="space-y-3">
        {[...studentExams].reverse().map((exam, i) => (
          <Link key={i} href={'/exam/' + exam.examId} className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800 transition-all group">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">{exam.title}</p>
                <p className="text-xs text-gray-400">{formatDate(exam.date)}</p>
              </div>
              <div className="text-right">
                <div className={`text-xl font-bold ${scoreColor(exam.totalMarks, exam.maxMarks)}`}>{exam.totalMarks}/{exam.maxMarks}</div>
                <div className="text-xs text-gray-400">{pct(exam.totalMarks, exam.maxMarks)} · Grade {scoreGrade(exam.totalMarks, exam.maxMarks)}</div>
              </div>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${exam.percentage >= 80 ? 'bg-emerald-500' : exam.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: exam.percentage + '%' }} />
            </div>
            {exam.revise && <p className="text-xs text-gray-400 mt-2">Revise: <span className="text-gray-600 dark:text-gray-300">{exam.revise}</span></p>}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function StudentPage() {
  return <Suspense fallback={<div className="text-center py-20 text-gray-400">Loading...</div>}><StudentProfileInner /></Suspense>;
}
