import fullMarkdown from '../../docs/USER_GUIDE_UNDER13_PARENT_FIRST_PL.md?raw';
import quickMarkdown from '../../docs/USER_GUIDE_UNDER13_QUICK_PL.md?raw';

function readDocument(markdown: string) {
  const [heading, ...lines] = markdown.trim().split(/\r?\n/);
  return { title: heading.replace(/^# /, ''), body: lines.join('\n').trim() };
}

export const fullParentGuide = readDocument(fullMarkdown);

const quickDocument = readDocument(quickMarkdown);
const [introduction, ...sections] = quickDocument.body.split(/^## /m);

export const quickParentGuide = {
  title: quickDocument.title,
  introduction: introduction.trim(),
  steps: sections.map((section) => {
    const [heading, ...lines] = section.split('\n');
    const match = /^(\d+)\. (Rodzic|Dziecko) — (.+)$/.exec(heading);
    if (!match) throw new Error('Unexpected parent guide step heading.');

    return {
      number: Number(match[1]),
      role: match[2] === 'Rodzic' ? 'parent' : 'child',
      roleLabel: match[2],
      title: match[3],
      body: lines.join('\n').trim(),
    };
  }),
};
