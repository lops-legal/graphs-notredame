import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type {
  GraphEdgeAttributes,
  GraphNodeAttributes,
  NodeKind,
  ProcessRecord,
  SourceId,
  ViewMode,
} from "./types";

export const PALETTE: Record<NodeKind, string> = {
  company: "#f7c66b",
  process: "#f4f1e8",
  source: "#a78bfa",
  comarca: "#49c5b6",
  orgao: "#65a6f7",
  decisionType: "#f09a72",
  obligation: "#e879b2",
  measure: "#f2d85e",
  evidence: "#9bb875",
  conclusion: "#d88484",
  year: "#8eb1c7",
};

export const KIND_LABELS: Record<NodeKind, string> = {
  company: "Empresa",
  process: "Processo",
  source: "Planilha",
  comarca: "Comarca",
  orgao: "Vara / Câmara",
  decisionType: "Tipo de decisão",
  obligation: "Obrigação",
  measure: "Medida judicial",
  evidence: "Nível de evidência",
  conclusion: "Conclusão da planilha",
  year: "Ano da decisão",
};

const modeKinds: Record<ViewMode, NodeKind[]> = {
  overview: ["company", "process", "source", "comarca", "obligation"],
  territory: ["company", "process", "source", "comarca", "orgao"],
  themes: ["process", "decisionType", "obligation"],
  judicial: ["process", "measure", "evidence", "conclusion"],
  timeline: ["process", "source", "year", "decisionType"],
};

const hash = (input: string) => {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
};

const pointFor = (id: string) => {
  const angle = ((hash(id) % 3600) / 3600) * Math.PI * 2;
  const radius = 3 + ((hash(`${id}:r`) % 1000) / 1000) * 12;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
};

const compactId = (kind: NodeKind, value: string) => `${kind}:${value.toLocaleLowerCase("pt-BR")}`;

export type GraphFilters = {
  source: "all" | SourceId;
  mode: ViewMode;
  query: string;
  comarca: string;
  obligation: string;
  conclusion: string;
  onlyWithDecisionDate: boolean;
};

export function filterRecords(records: ProcessRecord[], filters: GraphFilters) {
  const needle = filters.query.trim().toLocaleLowerCase("pt-BR");
  return records.filter((record) => {
    if (filters.source !== "all" && record.source !== filters.source) return false;
    if (filters.comarca && record.comarca !== filters.comarca) return false;
    if (filters.obligation && record.obligation !== filters.obligation) return false;
    if (filters.conclusion && record.conclusionCategory !== filters.conclusion) return false;
    if (filters.onlyWithDecisionDate && !record.decisionDate) return false;
    if (!needle) return true;
    return [
      record.cnj,
      record.comarca,
      record.orgao,
      record.decisionType,
      record.obligation,
      record.outcome,
      record.judicialMeasure,
      record.conclusion,
      record.operatorJustification,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(needle));
  });
}

export function createGraph(records: ProcessRecord[], mode: ViewMode) {
  const graph = new Graph<GraphNodeAttributes, GraphEdgeAttributes>({ multi: true, type: "undirected" });
  const allowed = new Set(modeKinds[mode]);
  const nodeCounts = new Map<string, number>();

  const addNode = (id: string, label: string, kind: NodeKind, recordId?: string) => {
    nodeCounts.set(id, (nodeCounts.get(id) ?? 0) + 1);
    if (graph.hasNode(id)) return;
    graph.addNode(id, {
      label,
      kind,
      color: PALETTE[kind],
      size: kind === "process" ? 3.2 : kind === "company" ? 17 : 6,
      ...pointFor(id),
      recordId,
      count: 1,
    });
  };

  const addRelation = (
    processId: string,
    kind: NodeKind,
    value: string | null | undefined,
    relation: string,
  ) => {
    if (!value || !allowed.has(kind)) return;
    const entityId = compactId(kind, value);
    addNode(entityId, value, kind);
    graph.addEdge(processId, entityId, {
      relation,
      color: "rgba(126, 139, 153, 0.065)",
      size: 0.7,
    });
  };

  const companyId = "company:notredame-intermedica";
  if (allowed.has("company")) addNode(companyId, "NotreDame Intermédica", "company");

  for (const record of records) {
    const processId = `process:${record.id}`;
    addNode(processId, record.cnj, "process", record.id);
    addRelation(processId, "source", record.sourceLabel, "consta em");
    addRelation(processId, "comarca", record.comarca, "tramita em");
    addRelation(processId, "orgao", record.orgao, "julgado por");
    addRelation(processId, "decisionType", record.decisionType, "tem decisão");
    addRelation(processId, "obligation", record.obligation, "discute");
    addRelation(processId, "evidence", record.evidenceLevel ?? record.recognition, "classificado como");
    addRelation(processId, "conclusion", record.conclusionCategory, "conclusão");
    addRelation(processId, "year", record.year, "decidido em");
    for (const tag of record.measureTags) addRelation(processId, "measure", tag, "teve medida");
  }

  if (allowed.has("company") && allowed.has("source")) {
    for (const sourceLabel of new Set(records.map((record) => record.sourceLabel))) {
      const sourceId = compactId("source", sourceLabel);
      if (!graph.hasNode(sourceId)) continue;
      graph.addEdge(companyId, sourceId, {
        relation: "é a fonte da pesquisa sobre",
        color: "rgba(247, 198, 107, 0.24)",
        size: 1.4,
      });
    }
  }

  graph.forEachNode((node) => {
    const count = nodeCounts.get(node) ?? 1;
    const attrs = graph.getNodeAttributes(node);
    const degree = graph.degree(node);
    const size = attrs.kind === "process" ? 3.2 : attrs.kind === "company" ? 17 : Math.min(15, 5 + Math.sqrt(degree) * 1.8);
    graph.mergeNodeAttributes(node, { count, size });
  });

  if (graph.order > 2 && graph.order < 1200) {
    forceAtlas2.assign(graph, {
      iterations: graph.order > 700 ? 65 : 100,
      settings: {
        barnesHutOptimize: graph.order > 250,
        gravity: 0.75,
        scalingRatio: mode === "territory" ? 12 : 9,
        slowDown: 8,
        linLogMode: true,
        strongGravityMode: false,
      },
    });
  }

  return graph;
}

export function getFacetValues(records: ProcessRecord[], key: "comarca" | "obligation" | "conclusionCategory") {
  const counts = new Map<string, number>();
  for (const record of records) {
    const value = record[key];
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .map(([value, count]) => ({ value, count }));
}
