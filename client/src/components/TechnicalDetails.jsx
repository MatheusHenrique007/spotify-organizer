export default function TechnicalDetails({ data }) {
  return (
    <details className="tech-details">
      <summary>Ver detalhes técnicos</summary>
      <pre className="tech-json">{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}
