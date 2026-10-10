import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas NotreDame | Rede de processos",
  description: "Visualização exploratória das planilhas Pesquisa DPE e NUDECON.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
