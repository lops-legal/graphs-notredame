"use client";

import dynamic from "next/dynamic";

const KnowledgeGraph = dynamic(() => import("./KnowledgeGraph"), {
  ssr: false,
  loading: () => (
    <main className="center-state">
      <div className="loader" />
      <p>Preparando a rede de processos…</p>
    </main>
  ),
});

export default KnowledgeGraph;
