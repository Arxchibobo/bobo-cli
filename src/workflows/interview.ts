import { writeResearch } from '../state/artifacts.js';
import { spawnAgent } from '../agents/spawn.js';

export interface InterviewResult {
  path: string;
  questions: string[];
  agentId?: string;
}

/**
 * Interview workflow with Socratic questioning approach
 *
 * Generates context-aware questions and optionally spawns an agent for deep exploration
 */
export async function runInterviewWorkflow(topic: string): Promise<InterviewResult> {
  // Base Socratic questions (always included)
  const baseQuestions = [
    `What problem does "${topic}" solve?`,
    'Who is the user?',
    'What are the hard constraints?',
    'What would make this fail?',
    'What is the smallest useful version?',
  ];

  // Try to spawn a planner agent to generate deeper questions
  const questionGenResult = await spawnAgent({
    task: `You are conducting a Socratic interview about: ${topic}\n\nGenerate 10 deep, probing questions that will help understand:\n- The core problem and why it matters\n- User needs and constraints\n- Potential risks and failure modes\n- Alternative approaches\n- Success criteria\n\nMake questions specific to this topic, not generic.`,
    role: 'planner',
    cwd: process.cwd(),
  });

  let content: string;
  let agentId: string | undefined;

  if (questionGenResult.error) {
    // Fallback to static questions
    content = `# Deep Interview\n\n## Topic\n${topic}\n\n## Socratic Questions\n${baseQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n## Note\nDeeper question generation failed: ${questionGenResult.error}\n`;
  } else {
    agentId = questionGenResult.id;
    content = `# Deep Interview\n\n## Topic\n${topic}\n\n## Base Socratic Questions\n${baseQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n## Deep Question Generation\nAgent ID: ${agentId}\nStatus: Running in background\n\nAn agent is generating deeper, context-specific questions. Check with:\n  bobo agent ${agentId}\n`;
  }

  const path = writeResearch('interview', content);
  return { path, questions: baseQuestions, agentId };
}
