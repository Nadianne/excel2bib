<img width="384" height="59" alt="logo" src="https://github.com/user-attachments/assets/36c044ac-7c9d-48cf-9a64-357bb423e96e" />


🌐 **Acesse a aplicação:** [excel2bib.vercel.app](https://excel2bib.vercel.app/)

O Excel2Bib nasceu da necessidade de converter planilhas com referências bibliográficas em arquivos BibTeX (.bib), facilitando a organização e a importação de estudos em ferramentas como o Parsif.al.

<img width="1524" height="954" alt="image" src="https://github.com/user-attachments/assets/260c746d-afb2-4fe4-88ed-060f741ae8a8" />


***Funcionalidades***

- Conversão de arquivos CSV, XLSX e XLS.

- Reconhecimento e seleção de abas.

- Pré-visualização dos registros bibliográficos.

- Identificação automática de campos.

- Geração de arquivos BibTeX para download.

- Relatório de inconsistências.

Também disponibilizei um guia gratuito para auxiliar estudantes e pesquisadores na organização de Revisões Sistemáticas da Literatura.


### Tecnologias utilizadas

| Tecnologia | Finalidade |
|---|---|
| React + TypeScript | Interface e lógica da aplicação |
| Vite | Desenvolvimento e compilação |
| Tailwind CSS | Estilização |
| ExcelJS | Leitura de XLSX |
| SheetJS | Leitura de XLS |
| Papa Parse | Leitura de CSV |
| JSZip | Inspeção preliminar da estrutura XLSX |
| Lucide React | Elementos visuais e ícones |


### Principais diretórios e arquivos

| Diretório ou arquivo | Finalidade |
|---|---|
| `public/` | Armazena recursos públicos, como imagens e materiais disponibilizados pelo site. |
| `public/images/` | Contém o logo, o favicon e a imagem de apresentação do Guia Prático. |
| `public/guias/` | Diretório destinado ao Guia Prático do Parsif.al em PDF. |
| `src/assets/` | Armazena recursos visuais utilizados na aplicação. |
| `src/components/` | Reúne componentes reutilizáveis, como o download do relatório de inconsistências. |
| `src/utils/` | Contém as funções de leitura, validação, identificação de campos e conversão para BibTeX. |
| `src/App.tsx` | Implementa a interface principal e controla as etapas de conversão. |
| `src/App.css` | Arquivo de estilos da aplicação. |
| `src/index.css` | Define os estilos globais. |
| `src/main.tsx` | Ponto de entrada da aplicação React. |
| `index.html` | Define a estrutura HTML inicial, o título, o favicon e os metadados. |
| `package.json` | Declara as dependências e os scripts do projeto. |
| `package-lock.json` | Registra as versões resolvidas das dependências. |
| `vite.config.ts` | Configura o ambiente de desenvolvimento e compilação. |
| `tsconfig*.json` | Contém as configurações do TypeScript. |
| `eslint.config.js` | Configura a análise estática e as regras de qualidade do código. |
| `.gitignore` | Define os arquivos e diretórios que não devem ser versionados. |
| `README.md` | Apresenta a documentação geral do projeto. |
