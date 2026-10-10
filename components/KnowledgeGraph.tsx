"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sigma from "sigma";
import {
  ArrowLeftToLine,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Database,
  Download,
  Filter,
  Focus,
  MapPinned,
  Network,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Scale,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  createGraph,
  filterRecords,
  getFacetValues,
  KIND_LABELS,
  PALETTE,
  type GraphFilters,
} from "@/lib/graph";
import type {
  Dataset,
  GraphEdgeAttributes,
  GraphNodeAttributes,
  NodeKind,
  ProcessRecord,
  ViewMode,
} from "@/lib/types";

const VIEW_OPTIONS: Array<{ id: ViewMode; label: string; short: string; icon: typeof Network }> = [
  { id: "overview", label: "Rede geral", short: "Geral", icon: Network },
  { id: "territory", label: "Território e órgãos", short: "Território", icon: MapPinned },
  { id: "themes", label: "Temas e decisões", short: "Temas", icon: Sparkles },
  { id: "judicial", label: "Resposta judicial", short: "Medidas", icon: Scale },
  { id: "timeline", label: "Linha temporal", short: "Tempo", icon: CalendarDays },
];

const SOURCE_LABELS = {
  all: "As duas planilhas",
  "pesquisa-dpe": "Pesquisa DPE",
  "nudecon-analisada": "NUDECON analisada",
} as const;

function number(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function date(value: string | null) {
  if (!value) return "Não informada";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("pt-BR").format(parsed);
}

function money(value: number | null) {
  if (value == null) return "Não informada";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function downloadGraph(container: HTMLDivElement | null) {
  if (!container) return;
  const canvases = [...container.querySelectorAll("canvas")];
  if (!canvases.length) return;
  const width = container.clientWidth * 2;
  const height = container.clientHeight * 2;
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const context = output.getContext("2d");
  if (!context) return;
  context.fillStyle = "#101317";
  context.fillRect(0, 0, width, height);
  for (const canvas of canvases) context.drawImage(canvas, 0, 0, width, height);
  const link = document.createElement("a");
  link.download = `atlas-notredame-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = output.toDataURL("image/png");
  link.click();
}

function Fact({ label, value, wide = false }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`fact ${wide ? "fact--wide" : ""}`}>
      <dt>{label}</dt>
      <dd>{value || "Não informado"}</dd>
    </div>
  );
}

function RecordDetail({ record, onClose }: { record: ProcessRecord; onClose: () => void }) {
  return (
    <aside className="detail-panel">
      <header className="detail-header">
        <div>
          <span className="eyebrow">Processo · {record.sourceLabel}</span>
          <h2>{record.cnj}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Fechar detalhes"><X size={18} /></button>
      </header>

      <div className="detail-scroll">
        <div className="status-row">
          <span className="status-pill">{record.decisionType || "Tipo não informado"}</span>
          <span className="status-pill status-pill--muted">{record.conclusionCategory}</span>
        </div>

        <dl className="fact-grid">
          <Fact label="Comarca / foro" value={record.comarca} />
          <Fact label="UF" value={record.uf} />
          <Fact label="Vara / Câmara" value={record.orgao} wide />
          <Fact label="Distribuição" value={date(record.distributionDate)} />
          <Fact label="Decisão analisada" value={date(record.decisionDate)} />
          <Fact label="Data da liminar" value={date(record.injunctionDate)} />
          <Fact label="Multa diária" value={money(record.dailyFine)} />
          <Fact label="Obrigação" value={record.obligation} wide />
          <Fact label="Descrição da ordem" value={record.orderDescription} wide />
          <Fact label="Justificativa / fatos" value={record.operatorJustification} wide />
          <Fact label="Reconhecimento registrado" value={record.recognition} wide />
          <Fact label="Medidas judiciais" value={record.judicialMeasure} wide />
          <Fact label="Desfecho" value={record.outcome} wide />
          <Fact label="Conclusão na fonte" value={record.conclusion} wide />
          <Fact label="Limitações" value={record.limitations} wide />
          <Fact label="Fonte / localização" value={record.sourceLocation} wide />
        </dl>

        <details className="raw-fields">
          <summary>Ver todos os campos da linha</summary>
          <dl>
            {Object.entries(record.rawFields).map(([key, value]) => (
              <Fact key={key} label={key} value={value == null ? null : String(value)} wide />
            ))}
          </dl>
        </details>
      </div>
    </aside>
  );
}

export default function KnowledgeGraph() {
  const graphContainer = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null>(null);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [source, setSource] = useState<GraphFilters["source"]>("all");
  const [mode, setMode] = useState<ViewMode>("overview");
  const [query, setQuery] = useState("");
  const [comarca, setComarca] = useState("");
  const [obligation, setObligation] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [onlyWithDecisionDate, setOnlyWithDecisionDate] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    fetch("/data/notredame-processos.json")
      .then((response) => {
        if (!response.ok) throw new Error(`Falha ao carregar os dados (${response.status})`);
        return response.json();
      })
      .then((data: Dataset) => setDataset(data))
      .catch((error: Error) => setLoadError(error.message));
  }, []);

  const sourceRecords = useMemo(() => {
    if (!dataset) return [];
    return source === "all" ? dataset.records : dataset.records.filter((record) => record.source === source);
  }, [dataset, source]);

  const filters = useMemo<GraphFilters>(() => ({
    source,
    mode,
    query,
    comarca,
    obligation,
    conclusion,
    onlyWithDecisionDate,
  }), [source, mode, query, comarca, obligation, conclusion, onlyWithDecisionDate]);

  const records = useMemo(() => dataset ? filterRecords(dataset.records, filters) : [], [dataset, filters]);
  const graph = useMemo(() => createGraph(records, mode), [records, mode]);
  const recordById = useMemo(() => new Map(dataset?.records.map((record) => [record.id, record]) ?? []), [dataset]);
  const selectedRecord = useMemo(() => {
    if (!selectedNode || !graph.hasNode(selectedNode)) return null;
    const id = graph.getNodeAttribute(selectedNode, "recordId");
    return id ? recordById.get(id) ?? null : null;
  }, [selectedNode, graph, recordById]);
  const selectedEntity = useMemo(() => {
    if (!selectedNode || !graph.hasNode(selectedNode) || selectedRecord) return null;
    const attributes = graph.getNodeAttributes(selectedNode);
    const neighbors = graph.neighbors(selectedNode).filter((node) => graph.getNodeAttribute(node, "kind") === "process");
    return { ...attributes, neighbors };
  }, [selectedNode, graph, selectedRecord]);

  const comarcaOptions = useMemo(() => getFacetValues(sourceRecords, "comarca"), [sourceRecords]);
  const obligationOptions = useMemo(() => getFacetValues(sourceRecords, "obligation"), [sourceRecords]);
  const conclusionOptions = useMemo(() => getFacetValues(sourceRecords, "conclusionCategory"), [sourceRecords]);

  useEffect(() => {
    const container = graphContainer.current;
    if (!container || graph.order === 0) return;

    const renderer = new Sigma(graph, container, {
      allowInvalidContainer: false,
      defaultNodeColor: "#f4f1e8",
      defaultEdgeColor: "rgba(126, 139, 153, 0.24)",
      defaultEdgeType: "line",
      edgeReducer: (_edge, data) => ({ ...data }),
      enableEdgeEvents: false,
      labelColor: { color: "#e9edf2" },
      labelDensity: 0.1,
      labelFont: "var(--font-sans)",
      labelGridCellSize: 120,
      labelRenderedSizeThreshold: 7,
      minCameraRatio: 0.035,
      maxCameraRatio: 8,
      renderEdgeLabels: false,
      stagePadding: 36,
      zIndex: true,
    });
    rendererRef.current = renderer;

    let hovered: string | null = null;
    let dragged: string | null = null;

    const refreshReducers = () => {
      const neighborhood = hovered ? new Set([hovered, ...graph.neighbors(hovered)]) : null;
      renderer.setSetting("nodeReducer", (node, data) => {
        if (!neighborhood) return data;
        if (neighborhood.has(node)) return { ...data, zIndex: 2, forceLabel: true };
        return { ...data, color: "#343a42", label: "", zIndex: 0 };
      });
      renderer.setSetting("edgeReducer", (edge, data) => {
        if (!hovered) return data;
        return graph.extremities(edge).includes(hovered)
          ? { ...data, color: "rgba(240, 241, 235, 0.72)", size: 1.5, zIndex: 2 }
          : { ...data, color: "rgba(70, 77, 85, 0.08)", hidden: false };
      });
      renderer.refresh();
    };

    renderer.on("enterNode", ({ node }) => {
      hovered = node;
      container.style.cursor = "pointer";
      refreshReducers();
    });
    renderer.on("leaveNode", () => {
      hovered = null;
      container.style.cursor = "default";
      refreshReducers();
    });
    renderer.on("clickNode", ({ node }) => {
      setSelectedNode(node);
      setDetailOpen(true);
      const attrs = graph.getNodeAttributes(node);
      renderer.getCamera().animate({ x: attrs.x, y: attrs.y, ratio: 0.16 }, { duration: 450 });
    });
    renderer.on("clickStage", () => setSelectedNode(null));
    renderer.on("downNode", ({ node }) => {
      dragged = node;
      graph.setNodeAttribute(node, "highlighted", true);
      if (!renderer.getCustomBBox()) renderer.setCustomBBox(renderer.getBBox());
    });

    const mouse = renderer.getMouseCaptor();
    mouse.on("mousemovebody", (event) => {
      if (!dragged) return;
      const position = renderer.viewportToGraph(event);
      graph.mergeNodeAttributes(dragged, { x: position.x, y: position.y });
      event.preventSigmaDefault();
      event.original.preventDefault();
      event.original.stopPropagation();
    });
    mouse.on("mouseup", () => {
      if (dragged) graph.removeNodeAttribute(dragged, "highlighted");
      dragged = null;
    });

    return () => {
      renderer.kill();
      rendererRef.current = null;
    };
  }, [graph]);

  const resetFilters = () => {
    setQuery("");
    setComarca("");
    setObligation("");
    setConclusion("");
    setOnlyWithDecisionDate(false);
  };

  if (loadError) {
    return <main className="center-state"><Database size={36} /><h1>Não foi possível abrir a base</h1><p>{loadError}</p></main>;
  }
  if (!dataset) {
    return <main className="center-state"><div className="loader" /><p>Preparando as duas planilhas…</p></main>;
  }

  const activeFilters = [comarca, obligation, conclusion, onlyWithDecisionDate ? "data" : ""].filter(Boolean).length;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <button className="icon-button mobile-only" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Abrir navegação"><Network size={19} /></button>
          <div className="brand-mark"><Network size={18} /></div>
          <div><strong>Atlas NotreDame</strong><span>Rede de processos</span></div>
        </div>

        <nav className="view-tabs" aria-label="Visualizações">
          {VIEW_OPTIONS.map(({ id, short, label, icon: Icon }) => (
            <button key={id} className={mode === id ? "active" : ""} onClick={() => { setMode(id); setSelectedNode(null); }} title={label}>
              <Icon size={15} /><span>{short}</span>
            </button>
          ))}
        </nav>

        <div className="top-actions">
          <button className="icon-button" onClick={() => setShowHelp(true)} aria-label="Como usar"><CircleHelp size={18} /></button>
          <button className="icon-button" onClick={() => downloadGraph(graphContainer.current)} aria-label="Baixar imagem"><Download size={18} /></button>
          <button className="icon-button" onClick={() => setDetailOpen(!detailOpen)} aria-label="Alternar painel lateral">
            {detailOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`}>
          <div className="sidebar-section">
            <span className="eyebrow">Base exibida</span>
            <div className="select-wrap">
              <select value={source} onChange={(event) => { setSource(event.target.value as GraphFilters["source"]); setSelectedNode(null); }}>
                {Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <ChevronDown size={15} />
            </div>
          </div>

          <div className="metric-grid">
            <div><strong>{number(records.length)}</strong><span>processos</span></div>
            <div><strong>{number(new Set(records.map((record) => record.comarca).filter(Boolean)).size)}</strong><span>comarcas</span></div>
            <div><strong>{number(graph.order)}</strong><span>nós</span></div>
            <div><strong>{number(graph.size)}</strong><span>relações</span></div>
          </div>

          <div className="sidebar-section search-block">
            <label htmlFor="search">Buscar na rede</label>
            <div className="search-input">
              <Search size={16} />
              <input id="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="CNJ, comarca, órgão, tema…" />
              {query && <button onClick={() => setQuery("")} aria-label="Limpar busca"><X size={14} /></button>}
            </div>
          </div>

          <div className="sidebar-section">
            <button className="section-toggle" onClick={() => setFiltersOpen(!filtersOpen)}>
              <span><Filter size={15} /> Filtros</span>
              <span className="filter-count">{activeFilters || "—"}</span>
            </button>
            {filtersOpen && (
              <div className="filter-stack">
                <label>Comarca<select value={comarca} onChange={(event) => { setComarca(event.target.value); setSelectedNode(null); }}><option value="">Todas</option>{comarcaOptions.map((item) => <option key={item.value} value={item.value}>{item.value} ({item.count})</option>)}</select></label>
                <label>Obrigação<select value={obligation} onChange={(event) => { setObligation(event.target.value); setSelectedNode(null); }}><option value="">Todas</option>{obligationOptions.map((item) => <option key={item.value} value={item.value}>{item.value} ({item.count})</option>)}</select></label>
                <label>Conclusão registrada<select value={conclusion} onChange={(event) => { setConclusion(event.target.value); setSelectedNode(null); }}><option value="">Todas</option>{conclusionOptions.map((item) => <option key={item.value} value={item.value}>{item.value} ({item.count})</option>)}</select></label>
                <label className="check-row"><input type="checkbox" checked={onlyWithDecisionDate} onChange={(event) => { setOnlyWithDecisionDate(event.target.checked); setSelectedNode(null); }} /><span>Apenas com data da decisão</span></label>
                <button className="text-button" onClick={resetFilters}><RotateCcw size={14} /> Limpar filtros</button>
              </div>
            )}
          </div>

          <div className="sidebar-section legend">
            <span className="eyebrow">Legenda desta visão</span>
            {Object.entries(PALETTE).filter(([kind]) => graph.someNode((_node, attrs) => attrs.kind === kind)).map(([kind, color]) => (
              <div key={kind}><i style={{ background: color }} /><span>{KIND_LABELS[kind as NodeKind]}</span></div>
            ))}
          </div>

          <div className="source-note">
            <Database size={15} />
            <p><strong>Duas fontes, sem fusão silenciosa.</strong> Cada processo conserva sua planilha e sua linha de origem.</p>
          </div>
        </aside>

        <section className="graph-stage">
          <div className="stage-caption">
            <span>{VIEW_OPTIONS.find((item) => item.id === mode)?.label}</span>
            <strong>{SOURCE_LABELS[source]}</strong>
          </div>
          <div ref={graphContainer} className="graph-canvas" />
          {graph.order === 0 && <div className="empty-graph"><Search size={28} /><strong>Nenhum processo encontrado</strong><span>Revise a busca ou limpe os filtros.</span><button onClick={resetFilters}>Limpar filtros</button></div>}
          <div className="graph-controls">
            <button onClick={() => rendererRef.current?.getCamera().animatedReset({ duration: 500 })} title="Enquadrar toda a rede"><Focus size={18} /></button>
            <button onClick={() => { setSelectedNode(null); rendererRef.current?.refresh(); }} title="Remover seleção"><ArrowLeftToLine size={18} /></button>
          </div>
          <div className="interaction-tip">Arraste os nós · role para aproximar · clique para inspecionar</div>
        </section>

        {detailOpen && selectedRecord && <RecordDetail record={selectedRecord} onClose={() => setSelectedNode(null)} />}
        {detailOpen && selectedEntity && (
          <aside className="detail-panel">
            <header className="detail-header"><div><span className="eyebrow">{KIND_LABELS[selectedEntity.kind]}</span><h2>{selectedEntity.label}</h2></div><button className="icon-button" onClick={() => setSelectedNode(null)}><X size={18} /></button></header>
            <div className="detail-scroll entity-detail">
              <div className="entity-count"><strong>{selectedEntity.neighbors.length}</strong><span>processos conectados nesta visualização</span></div>
              <p>Selecione um processo abaixo para abrir todos os campos das duas planilhas.</p>
              <div className="neighbor-list">
                {selectedEntity.neighbors.slice(0, 80).map((node) => {
                  const recordId = graph.getNodeAttribute(node, "recordId");
                  const record = recordId ? recordById.get(recordId) : null;
                  if (!record) return null;
                  return <button key={node} onClick={() => setSelectedNode(node)}><span>{record.cnj}</span><small>{record.comarca || "Sem comarca"} · {record.sourceLabel}</small></button>;
                })}
              </div>
            </div>
          </aside>
        )}
      </section>

      {showHelp && (
        <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
          <section className="help-modal" onClick={(event) => event.stopPropagation()}>
            <button className="icon-button modal-close" onClick={() => setShowHelp(false)}><X size={18} /></button>
            <span className="eyebrow">Guia rápido</span>
            <h2>Leia a planilha como uma rede</h2>
            <div className="help-grid">
              <div><Network size={20} /><strong>Escolha uma visão</strong><p>A rede geral mostra o conjunto. As outras visões isolam território, temas, medidas e tempo.</p></div>
              <div><Search size={20} /><strong>Encontre um processo</strong><p>Busque por CNJ, comarca, órgão ou texto dos campos. Os filtros reduzem a rede sem alterar a fonte.</p></div>
              <div><Focus size={20} /><strong>Explore conexões</strong><p>Passe o cursor para destacar vizinhos. Clique em qualquer nó para abrir processos e informações.</p></div>
              <div><Database size={20} /><strong>Compare as fontes</strong><p>Alterne entre as duas planilhas ou use a visão consolidada. A origem permanece visível em cada caso.</p></div>
            </div>
            <p className="method-note">A visualização é exploratória. Ela organiza o conteúdo das planilhas e não substitui a leitura dos autos ou a validação jurídica das classificações.</p>
          </section>
        </div>
      )}
    </main>
  );
}
