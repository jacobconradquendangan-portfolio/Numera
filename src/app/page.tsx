import AnalyzerApp from '@/components/AnalyzerApp';
import packageJson from '../../package.json';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <AnalyzerApp />
      <footer className="border-t border-line px-8 py-8 text-center">
        <p className="rule-label">
          Numera v{packageJson.version} · audited calculations · values normalised from source documents
        </p>
      </footer>
    </main>
  );
}
