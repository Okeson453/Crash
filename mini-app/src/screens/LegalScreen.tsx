import terms from '/legal/terms.md?raw';
import privacy from '/legal/privacy.md?raw';
import responsible from '/legal/responsible-gaming.md?raw';
import licenses from '/legal/licenses.md?raw';
import { useLocation } from 'react-router-dom';
const documents: Record<string, { title: string; content: string }> = { terms: { title: 'Terms of Service', content: terms }, privacy: { title: 'Privacy Policy', content: privacy }, responsible: { title: 'Responsible Gaming', content: responsible }, licenses: { title: 'Licenses', content: licenses } };
export function LegalScreen() { const path = useLocation().pathname.split('/').pop() ?? 'terms'; const document = documents[path] ?? documents.terms; return <main className="page-container px-4 py-4"><article className="card"><h1 className="text-xl font-bold text-tg-text">{document.title}</h1><pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-6 text-tg-hint">{document.content}</pre></article></main>; }
