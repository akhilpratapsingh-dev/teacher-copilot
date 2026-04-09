'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, BookOpen, BarChart3, Users, Trash2, ChevronRight, GraduationCap, TrendingUp } from 'lucide-react';
import { getClasses, addClass, deleteClass, getResults } from '@/lib/storage';
import { formatDate, pct } from '@/lib/utils';
import type { Class } from '@/lib/types';

export default function HomePage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const refresh = useCallback(() => setClasses(getClasses()), []);
  useEffect(() => { refresh(); }, [refresh]);

  const handleCreate = () => {
    if (!name.trim() || !subject.trim()) return;
    addClass(name.trim(), subject.trim()); refresh(); setName(''); setSubject(''); setShow(false);
  };
  const handleDelete = (id: string) => {
    if (!confirm('Delete this class and all its data?')) return;
    deleteClass(id); refresh();
  };

  const results = getResults();
  const totalExams = results.length;
  const totalStudents = new Set(results.flatMap(r => r.students.map(s => s.name))).size;
  const getClassStats = (id: string) => {
    const exams = results.filter(r => r.classId === id);
    const students = new Set(exams.flatMap(r => r.students.map(s => s.name))).size;
    const avgPct = exams.length ? Math.round(exams.reduce((s, r) => {
      const avg = r.students.reduce((a, st) => a + st.totalMarks, 0) / (r.students.length || 1);
      return s + (avg / (r.students[0]?.maxMarks || 1)) * 100;
    }, 0) / exams.length) : null;
    return { exams: exams.length, students, avgPct };
  };

  return (
    <div className="animate-fade-up">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">👋</span>
            <span className="text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-3 py-1 rounded-full">AI Grading Engine</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Your Classes</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Manage classes, run AI exams, and track student progress — all stored locally.</p>
        </div>
        <button onClick={() => setShow(true)} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary-200 dark:shadow-primary-900/30 transition-all">
          <Plus className="w-4 h-4" /> New Class
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Classes', value: classes.length, icon: BookOpen, color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/30' },
          { label: 'Exams Graded', value: totalExams, icon: BarChart3, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
          { label: 'Students', value: totalStudents, icon: Users, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {classes.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
          <div className="w-14 h-14 bg-primary-50 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-7 h-7 text-primary-500" />
          </div>
          <p className="text-gray-700 dark:text-gray-300 font-semibold text-lg">No classes yet</p>
          <p className="text-gray-400 text-sm mb-5 mt-1">Create your first class to start grading with AI</p>
          <button onClick={() => setShow(true)} className="bg-primary-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200 dark:shadow-none">
            Create First Class
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map(cls => {
            const { exams, students, avgPct } = getClassStats(cls.id);
            return (
              <div key={cls.id} className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-11 h-11 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary-200 dark:shadow-none">
                    {cls.name.charAt(0).toUpperCase()}
                  </div>
                  <button onClick={() => handleDelete(cls.id)} className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base">{cls.name}</h3>
                <p className="text-xs text-gray-400 mb-1">{cls.subject}</p>
                <p className="text-xs text-gray-400 mb-3">Created {formatDate(cls.createdAt)}</p>
                <div className="flex gap-3 mb-4 text-xs">
                  <span className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2.5 py-1 rounded-lg font-medium">{exams} exam{exams !== 1 ? 's' : ''}</span>
                  <span className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2.5 py-1 rounded-lg font-medium">{students} students</span>
                  {avgPct !== null && (
                    <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />{avgPct}% avg
                    </span>
                  )}
                </div>
                <Link href={'/classes/' + cls.id} className="flex items-center justify-center gap-1.5 w-full bg-gray-50 dark:bg-gray-800 hover:bg-primary-600 text-gray-600 dark:text-gray-300 hover:text-white py-2 rounded-xl text-sm font-semibold transition-all group-hover:bg-primary-600 group-hover:text-white">
                  Open Class <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
          <button onClick={() => setShow(true)} className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-5 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-all flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-primary-500 min-h-[180px]">
            <Plus className="w-8 h-8" />
            <span className="text-sm font-medium">New Class</span>
          </button>
        </div>
      )}

      {show && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShow(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-800 animate-fade-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1 text-gray-900 dark:text-white">Create New Class</h3>
            <p className="text-sm text-gray-400 mb-4">Add a class to start grading exams with AI</p>
            <div className="space-y-3 mb-5">
              <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors" placeholder="Class name — e.g. Class 10-A" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
              <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors" placeholder="Subject — e.g. Physics" value={subject} onChange={e => setSubject(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShow(false)} className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium">Cancel</button>
              <button onClick={handleCreate} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors shadow-lg shadow-primary-200 dark:shadow-none">Create Class</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
