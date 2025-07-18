import RollingQuotes from './components/RollingQuotes';

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-white">
      <h1 className="text-3xl font-bold mb-6">Zine Landing</h1>
      <RollingQuotes />
    </main>
  );
}
