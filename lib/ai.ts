const GROQ_URL='https://api.groq.com/openai/v1/chat/completions';
const MODEL='llama-3.3-70b-versatile';
const KEY=()=>process.env.NEXT_PUBLIC_GROQ_API_KEY||'';
async function groq(messages:object[],max=8192):Promise<string>{
  const res=await fetch(GROQ_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+KEY()},body:JSON.stringify({model:MODEL,messages,temperature:0.2,max_tokens:max})});
  if(!res.ok){const e=await res.json();throw new Error(e.error?.message||'AI error '+res.status);}
  const d=await res.json();
  return(d.choices?.[0]?.message?.content||'').replace(/```json|```/g,'').trim();
}
export async function parseQuestionsFromPdf(rawText:string){
  const txt=await groq([
    {role:'system',content:'Extract exam questions and model answers. Respond with valid JSON only.'},
    {role:'user',content:'Extract all questions and model answers. Return ONLY JSON: {"questions":[{"text":"...","answer":"...","maxMarks":5}]}\n\nTEXT:\n'+rawText.slice(0,6000)},
  ],2048);
  const p=JSON.parse(txt);
  return(p.questions||[]).map((q:{text:string;answer:string;maxMarks:number})=>({text:q.text||'',answer:q.answer||'',maxMarks:Number(q.maxMarks)||5}));
}
export async function extractStudentAnswers(rawText:string,questions:{text:string}[]){
  const qList=questions.map((q,i)=>'Q'+(i+1)+': '+q.text).join('\n');
  const txt=await groq([
    {role:'system',content:'Match student answers to questions. Respond valid JSON only.'},
    {role:'user',content:'Return ONLY JSON: {"studentName":"...","answers":["ans1"]}\n\nQUESTIONS:\n'+qList+'\n\nSTUDENT TEXT:\n'+rawText.slice(0,5000)},
  ],2048);
  return JSON.parse(txt);
}
export async function evaluateStudents(p:{className:string;subject:string;questions:{text:string;answer:string;maxMarks:number}[];students:{name:string;answers:string[]}[]}){
  const qBlock=p.questions.map((q,i)=>'Q'+(i+1)+' [Max:'+q.maxMarks+']\nQ: '+q.text+'\nA: '+q.answer).join('\n\n');
  const sBlock=p.students.map(s=>'Student: '+s.name+'\n'+s.answers.map((a,i)=>'Q'+(i+1)+': '+(a||'(no answer)')).join('\n')).join('\n\n---\n\n');
  const schema='{"students":[{"name":"str","questions":[{"qNo":1,"marksAwarded":0,"maxMarks":0,"strength":"str","mistake":"str","feedback":"str"}],"totalMarks":0,"overallFeedback":"str","revise":"str"}],"classInsights":{"commonMistakes":[],"weakTopics":[],"teachingSuggestions":[],"classSummary":"str"}}';
  const prompt='Class: '+p.className+' | Subject: '+p.subject+'\n\nANSWER KEY:\n'+qBlock+'\n\nSTUDENT ANSWERS:\n'+sBlock+'\n\nEvaluate each student. Return ONLY JSON matching: '+schema;
  const txt=await groq([{role:'system',content:'You are an expert teacher. Respond with valid JSON only.'},{role:'user',content:prompt}]);
  return JSON.parse(txt);
}
