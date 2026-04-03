import { writeResearch } from '../state/artifacts.js';

export interface InterviewResult {
  path: string;
  questions: string[];
}

export async function runInterviewWorkflow(topic: string): Promise<InterviewResult> {
  const questions = [
    `What problem does \"${topic}\" solve?`,
    'Who is the user?',
    'What are the hard constraints?',
    'What would make this fail?',
    'What is the smallest useful version?',
  ];
  const content = `# Deep Interview\n\n## Topic\n${topic}\n\n## Questions\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`;
  const path = writeResearch('interview', content);
  return { path, questions };
}
