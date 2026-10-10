# Atlas NotreDame

Aplicação Next.js, somente frontend, para explorar duas planilhas de processos relacionados à NotreDame Intermédica como um grafo de conhecimento interativo.

## Fontes incluídas

- `Pesquisa DPE NOTREDAME.xlsx`: 146 processos.
- `Planilha_Processos_NotreDame_NUDECON (2) - analisada.xlsx`: 310 processos.

O arquivo estático `public/data/notredame-processos.json` preserva a origem e o número da linha de cada registro. As bases podem ser vistas separadamente ou em conjunto; não há fusão silenciosa entre planilhas.

## Recursos

- cinco visões: rede geral, território, temas, resposta judicial e tempo;
- pesquisa textual e filtros por comarca, obrigação, conclusão e data;
- realce de vizinhança, zoom, arraste e painel de detalhes;
- todos os campos originais disponíveis por processo;
- exportação da visualização como PNG;
- layout responsivo e implantação estática em Vercel.

## Desenvolvimento

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Verificação e produção

```bash
npm run lint
npm run build
```

O projeto não usa banco de dados, API própria ou variáveis secretas. A Vercel pode construir o repositório diretamente com o preset Next.js.

## Método e limites

A interface organiza os campos das planilhas e deriva apenas etiquetas simples de medidas judiciais a partir de termos explícitos. Ela é uma ferramenta de navegação exploratória e não substitui a leitura dos autos nem a validação jurídica das classificações.
