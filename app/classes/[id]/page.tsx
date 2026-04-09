'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, BookOpen, Users, Trophy, Clock, ChevronRight, BarChart2 } from 'lucide-react';
import { getClasses, getResultsByClass } from '@/lib/storage';
import { formatDate, pct, scoreColor } from '@/lib/utils';
import type { Class, ExamResult } from '@/lib/types';

export default function ClassPage() {
  const { id } = useParams<{ id: string }>();
  const [cls, setCls] = useState<Class | null>(null);
  const [exams, setExams] = useState<ExamResult[]>([]);
  const refresh = useCallback(() => {
    const c = getClasses().find(c => c.id === id) || null; setCls(c);
    setExams(getResultsByClass(id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, [id]);
  useEffect(() => { refresh(); }, [refresh]);

  if (!cls) return <div className="text-center py-20 text-gray-400">Class not found</div>;

  const allStudents = [...new Set(exams.flatMap(e => e.students.map(s => s.name)))];
  const classAvgPct = exams.length ? Math.round(exams.reduce((s, e) => {
    const avg = e.students.reduce((a, st) => a + st.totalMarks, 0) / (e.students.length || 1);
    return s + (avg / (e.students[0]?.maxMarks || 1)) * 100;
  }, 0) / exams.length) : null;

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> All Classes
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary-100 dark:shadow-none">
              {cls.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{cls.name}</h1>
              <p className="text-sm text-gray-500">{cls.subject} · Created {formatDate(cls.createdAt)}</p>
            </div>
          </div>
          <Link href={'/exam/new?classId=' + id} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary-200 dark:shadow-none transition-all active:scale-95">
            <Plus className="w-4 h-4" /> New Exam
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Exams', value: exams.length, icon: BookOpen, color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/30' },
          { label: 'Students', value: allStudents.length, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
          { label: 'Class Average', value: classAvgPct !== null ? classAvgPct + '%' : '-', icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/30' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200">Exam History</h2>
        <span className="text-xs text-gray-400">{exams.length} exam{exams.length !== 1 ? 's' : ''}</span>
      </div>

      {exams.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
          <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No exams yet</p>
          <p className="text-gray-400 text-sm mb-4">Run your first AI-graded exam for this class</p>
          <Link href={'/exam/new?classId=' + id} className="inline-flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors">
            <Plus className="w-4 h-4" /> New Exam
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {exams.map(exam => {
            const avgScore = exam.students.reduce((s, st) => s + st.totalMarks, 0) / (exam.students.length || 1);
            const maxScore = exam.students[0]?.maxMarks || 0;
            const avgPctNum = maxScore > 0 ? Math.round((avgScore / maxScore) * 100) : 0;
            const col = avgPctNum >= 80 ? 'text-emerald-600 dark:text-emerald-400' : avgPctNum >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400';
            return (
              <Link key={exam.id} href={'/exam/' + exam.examId} className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800 transition-all group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                      <BarChart2 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{exam.title}</p>
                      <p className="text-xs text-gray-400">{formatDate(exam.date)} · {exam.students.length} students</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className={`font-bold text-sm ${col}`}>{avgPctNum}%</div>
                      <div className="text-xs text-gray-400">avg score</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
                  </div>
                </div>
                <div className="mt-3 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${avgPctNum >= 80 ? 'bg-emerald-500' : avgPctNum >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{width: avgPctNum + '%'}} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {allStudents.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Student Roster</h2>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
            {allStudents.map((name, i) => {
              const history = exams.filter(e => e.students.some(s => s.name === name));
              const latest = history[0]?.students.find(s => s.name === name);
              return (
                <Link key={name} href={'/students/' + encodeURIComponent(name) + '?classId=' + id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0 group">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-gradient-to-br from-primary-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{history.length} exam{history.length !== 1 ? 's' : ''}</span>
                    {latest && <span className={`text-xs font-semibold ${scoreColor(latest.totalMarks, latest.maxMarks)}`}>{pct(latest.totalMarks, latest.maxMarks)}</span>}
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-primary-500 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
