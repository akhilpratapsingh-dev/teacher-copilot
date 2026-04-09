export interface Class { id:string; name:string; subject:string; createdAt:string }
export interface Question { id:string; text:string; answer:string; maxMarks:number }
export interface Exam { id:string; classId:string; className:string; subject:string; title:string; date:string; questions:Question[]; status:'draft'|'completed'; createdAt:string }
export interface QuestionResult { qNo:number; marksAwarded:number; maxMarks:number; strength:string; mistake:string; feedback:string; isOverridden?:boolean; overriddenMark?:number; overrideReason?:string }
export interface StudentResult { name:string; questions:QuestionResult[]; totalMarks:number; maxMarks:number; overallFeedback:string; revise:string; plagiarismFlag?:boolean; plagiarismWith?:string[] }
export interface ClassInsights { commonMistakes:string[]; weakTopics:string[]; teachingSuggestions:string[]; classSummary:string }
export interface ExamResult { id:string; examId:string; classId:string; className:string; subject:string; title:string; date:string; students:StudentResult[]; classInsights:ClassInsights; createdAt:string }
export interface StudentAnswer { name:string; answers:string[] }
