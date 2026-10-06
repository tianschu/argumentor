// Shared fixtures for the test suite (no network, no API key needed).
import { validateInput } from '../core.mjs';

export const MAP = {
  topic: 'Should employers be allowed to use AI systems to monitor employees\' work?',
  audience: 'Managers at a mid-sized logistics company',
  level: 'B2',
  claim: 'Employers should not use AI systems to monitor employees, because it destroys trust.',
  qualifier: '',
  arguments: [
    { reason: 'Constant monitoring makes workers feel stressed and distrusted.', evidence: 'My cousin works in a warehouse and says the tracking app makes everyone nervous.', evidenceType: 'personal', source: 'Conversation with my cousin', warrant: '' },
    { reason: 'AI systems can misjudge normal behaviour as laziness.', evidence: 'The case says "the system flagged workers who stopped to help a colleague".', evidenceType: 'source', source: 'S1', warrant: 'If the system is wrong, managers may punish good workers.' }
  ],
  counters: [{ target: 'Claim', counter: 'Managers may argue that monitoring improves productivity and safety.', strategy: 'rebut', response: 'Productivity is not more important than privacy.' }],
  draft: 'Nowadays many companies use AI to monitor employees. I think this is totally wrong. First, monitoring makes workers stressed. Second, AI systems can make mistakes. Some people say monitoring improves productivity, but privacy is more important.'
};

export const SOURCES = [{ id: 'S1', title: 'Warehouse case', kind: 'Teacher-written fictional case', text: 'In the first month, the system flagged workers who stopped to help a colleague as idle.' }];

export const input = () => validateInput(structuredClone(MAP));
export const json = value => JSON.stringify(value);
