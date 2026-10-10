export type SourceId = "pesquisa-dpe" | "nudecon-analisada";

export type ProcessRecord = {
  id: string;
  source: SourceId;
  sourceLabel: string;
  rowNumber: number;
  cnj: string;
  comarca: string | null;
  uf: string | null;
  orgao: string | null;
  decisionType: string | null;
  decisionId: string | null;
  distributionDate: string | null;
  decisionDate: string | null;
  injunctionDate: string | null;
  obligation: string | null;
  orderDescription: string | null;
  operatorJustification: string | null;
  recognition: string | null;
  violationType: string | null;
  delayDays: number | null;
  judicialMeasure: string | null;
  measureTags: string[];
  dailyFine: number | null;
  outcome: string | null;
  araraquara: string | null;
  evidenceLevel: string | null;
  conclusion: string | null;
  conclusionCategory: string;
  limitations: string | null;
  sourceLocation: string | null;
  year: string | null;
  rawFields: Record<string, string | number | null>;
};

export type Dataset = {
  metadata: {
    generatedAt: string;
    title: string;
    totals: {
      records: number;
      uniqueProcesses: number;
      comarcas: number;
      orgaos: number;
      sources: number;
    };
    sources: Array<{
      id: SourceId;
      label: string;
      records: number;
      workbook: string;
      description: string;
    }>;
  };
  records: ProcessRecord[];
};

export type ViewMode = "overview" | "territory" | "themes" | "judicial" | "timeline";

export type NodeKind =
  | "company"
  | "process"
  | "source"
  | "comarca"
  | "orgao"
  | "decisionType"
  | "obligation"
  | "measure"
  | "evidence"
  | "conclusion"
  | "year";

export type GraphNodeAttributes = {
  label: string;
  kind: NodeKind;
  color: string;
  size: number;
  x: number;
  y: number;
  recordId?: string;
  count?: number;
  hidden?: boolean;
  highlighted?: boolean;
  borderColor?: string;
  borderSize?: number;
};

export type GraphEdgeAttributes = {
  relation: string;
  color: string;
  size: number;
  hidden?: boolean;
};
