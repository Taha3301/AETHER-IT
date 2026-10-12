export default function ApiDocsPage() {
  return (
    <main className="h-screen bg-white">
      <iframe
        className="h-full w-full border-0"
        src="/swagger-ui/index.html"
        title="Aether IT API documentation"
      />
    </main>
  );
}
