<p align="center">
  <img src="public/logo.svg" width="200" alt="Logo do LibreDB Studio" />
</p>

<h1 align="center">LibreDB Studio</h1>

<p align="center">
  <strong>Um editor de bancos de dados que você implanta junto dos seus dados.</strong>
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README_zh.md">简体中文</a> ·
  <a href="README_ja.md">日本語</a> ·
  <a href="README_es.md">Español</a> ·
  <b>Português</b> ·
  <a href="README_ru.md">Русский</a>
</p>

## Visão geral

Você cria um banco na nuvem e, para consultá-lo, precisa abrir uma porta, configurar um
túnel SSH ou instalar um cliente em cada máquina da equipe. O LibreDB Studio permite
implantar o editor na mesma rede do banco e acessá-lo pelo navegador. Assim, você não
precisa expor o banco à internet só para usar o editor.

O mesmo aplicativo atende a 16 mecanismos de banco de dados. Pode ser executado em um
contêiner, instalado como serviço, implantado no Kubernetes ou incorporado ao seu produto
pelo pacote `@libredb/studio`. Também há um aplicativo desktop para Linux.

Todos os recursos fazem parte da versão MIT, incluindo SSO, controle de acesso por
papéis (RBAC), auditoria de consultas, diagramas ER e recursos de IA. Não há uma edição
empresarial que reserve essas funções.

<p align="center">
  <img src="public/screenshots/connection-modal.png" width="100%" alt="Configuração de conexões no LibreDB Studio" />
</p>

## Início rápido

Com **Node.js 24 ou superior**, no Linux, macOS ou Windows:

```bash
npx @libredb/studio
```

O comando baixa a distribuição do servidor, verifica o arquivo e inicia o aplicativo.
Não é preciso clonar o repositório nem compilar o projeto.

Se preferir **Docker**:

```bash
docker run -p 3000:3000 ghcr.io/libredb/libredb-studio:latest
```

Abra [localhost:3000](http://localhost:3000). Na primeira execução, o aplicativo gera
as credenciais de administrador e mostra a senha no terminal ou no log do contêiner.
Use essas credenciais para entrar e adicionar uma conexão.

Para acesso remoto, configure HTTPS. Se você precisar usar HTTP fora de `localhost`,
consulte a opção `AUTH_COOKIE_SECURE` e suas implicações na
[documentação de instalação](docs/DISTRIBUTION.md).

## Recursos

### Editor e exploração do schema

- **Monaco**, o editor usado pelo VS Code, com sugestões de tabelas, colunas e palavras-chave SQL.
- **Paleta de comandos** em `Cmd/Ctrl+K` para localizar conexões, tabelas, consultas salvas e ações.
- **Várias abas**, cada uma com seu próprio estado de execução.
- **EXPLAIN visual** nos mecanismos que oferecem planos de execução.
- **Diagramas ER interativos**, com relacionamentos baseados em chaves estrangeiras reais,
  busca de tabelas, minimapa e exportação em PNG ou SVG.
- **Comparação de schemas** e histórico de snapshots. A geração de SQL de migração depende
  dos recursos do mecanismo; veja os detalhes na documentação de cada provedor.

### Resultados e ferramentas de desenvolvimento

- Grade virtualizada com filtros por coluna e exportação em CSV ou JSON.
- Edição de valores diretamente na grade quando o mecanismo permite atualizar linhas de uma tabela.
- Tabelas dinâmicas no navegador com `COUNT`, `SUM`, `AVG`, `MIN` e `MAX`, além de geração de SQL.
- Oito tipos de gráfico, com configurações que podem ser salvas e reutilizadas.
- Geração de interfaces TypeScript, schemas Zod, modelos Prisma, structs Go, dataclasses Python
  e classes Java a partir do schema.
- Geração de dados de teste e de um dicionário de dados pesquisável, com exportação em Markdown.

O mascaramento de valores é um recurso de **exibição no navegador**. Ele ajuda a evitar
exposição acidental durante uma demonstração, mas não substitui permissões no banco:
as respostas da API ainda contêm os valores completos para usuários autenticados.

### IA opcional, com o modelo que você escolher

O painel **Database Agent** fica ao lado do editor na aplicação independente. Você
informa um objetivo e inicia a execução; o agente consulta o banco e produz um relatório
com referências aos resultados usados. Os fluxos incluem **Investigate**, **Optimize**
e **Assess**. Assess usa contagens, sem enviar valores das colunas.

- O modo **Agent** executa leituras apenas em **PostgreSQL, SQLite e DuckDB**. Ele usa uma
  camada própria de execução somente leitura, com limites e auditoria.
- O modo **Plan** está disponível em todas as conexões. Usa o schema como contexto e
  propõe instruções, mas não executa o SQL proposto.
- O agente não inicia tarefas sozinho, não escreve no editor e não aplica suas recomendações
  automaticamente. As consultas que você executa no editor seguem outro caminho e não
  herdam a política de somente leitura do agente.
- Gemini, OpenAI, Ollama e outros endpoints compatíveis com OpenAI podem fornecer o modelo.
  O modo Agent exige suporte a chamadas de ferramentas; Plan não exige esse recurso.

**Hospedar o Studio na sua rede não significa que todos os dados usados pela IA ficarão nela.**
Conforme o recurso, o endpoint configurado recebe o objetivo, SQL, schema e resultados de
leituras. O resumo do Data Profiler também inclui mínimos e máximos, que são valores reais
dos dados. Um modelo local permite manter esse processamento no ambiente que você controla.
Sem configuração `LLM_*`, o painel do agente não aparece; endpoints locais sem chave também
contam como modelos configurados.

Leia o [guia do agente](docs/AGENT_GUIDE.md) e o
[fluxo de dados da IA](docs/AGENT_DATA_FLOW.md) antes de habilitá-lo com dados sensíveis.
O pacote incorporável `@libredb/studio` não inclui a interface do agente.

### Autenticação e administração

- Login local com e-mail e senha ou SSO por OIDC, configurado por variáveis de ambiente.
- Compatibilidade com provedores OIDC como Keycloak, Auth0, Okta e Azure AD.
- Authorization Code Flow com PKCE S256 e mapeamento de papéis a partir de claims.
- Painel de monitoramento para administradores, com consultas, sessões, armazenamento,
  métricas e alertas. As informações disponíveis variam por mecanismo.
- Operações de manutenção específicas de cada banco, sem oferecer comandos que o provedor
  não suporta.

## Bancos de dados compatíveis

A tabela lista os 16 mecanismos com suporte direto. Recursos como cancelamento, manutenção,
diagramas e métricas dependem do que cada banco disponibiliza.

| Banco de dados | Driver ou protocolo | Recursos e limites |
| :--- | :--- | :--- |
| **PostgreSQL** | `pg` | Editor SQL, transações, EXPLAIN, exploração do schema e monitoramento. |
| **MySQL** | `mysql2` | Editor SQL, transações, EXPLAIN e monitoramento. |
| **Oracle** | `oracledb` em modo Thin | Editor SQL, exploração do schema, planos de execução e monitoramento. |
| **SQL Server** | `mssql` / `tedious` | Editor T-SQL, planos de execução e métricas; inclui Azure SQL. |
| **SQLite** | `bun:sqlite` / `node:sqlite` | Arquivo local ou banco em memória no servidor em que o Studio é executado. |
| **libSQL** | HTTP, protocolo Hrana | Banco remoto, incluindo Turso; autenticação por token. Manutenção limitada a REINDEX e PRAGMA integrity_check. |
| **DuckDB** | `@duckdb/node-api` | Arquivo local ou banco em memória, EXPLAIN em JSON e cancelamento. Sem lista de sessões ou log de consultas lentas; o arquivo só pode ser aberto por um processo do sistema operacional de cada vez. |
| **MongoDB** | `mongodb` | Editor JSON com operações find, aggregate, insert, update e delete em coleções. |
| **Couchbase** | HTTP, Query e API REST de administração | SQL++, EXPLAIN, exploração de buckets, scopes e coleções, inferência de colunas e manutenção. |
| **ClickHouse** | HTTP, interface SQL | Editor SQL, EXPLAIN em JSON, exploração do schema, estatísticas e cancelamento de consultas. |
| **Apache Druid** | HTTP, API SQL | SQL somente leitura, EXPLAIN e monitoramento; sem UPDATE, DELETE, CREATE TABLE ou operações de manutenção pelo editor. |
| **Elasticsearch** | HTTP, API SQL | SQL somente leitura, exploração de índices e campos e métricas do cluster. Sem EXPLAIN, manutenção ou paginação com OFFSET. |
| **OpenSearch** | HTTP, API SQL | Editor e explorador somente leitura; a paginação com LIMIT e OFFSET é suportada. |
| **Apache Trino** | HTTP, protocolo de cliente | SQL entre catálogos, EXPLAIN em JSON, monitoramento e cancelamento. Não declara chaves ou índices; a edição de linhas na grade fica desabilitada. Senhas exigem HTTPS. |
| **Apache Cassandra** | `cassandra-driver` | Editor CQL e explorador de keyspaces, com chaves de partição e clustering. Sem EXPLAIN, cancelamento ou manutenção; contagens de linhas e tamanhos não são exibidos. |
| **Redis** | `ioredis` | Editor de comandos, explorador de chaves e monitoramento baseado em INFO. |

Outros produtos usam os mesmos protocolos desses provedores. Compatibilidade de protocolo
não garante todos os recursos do produto; consulte as medições e limitações na
[referência dos provedores](docs/providers/README.md#wire-compatible-engines).

O túnel SSH funciona em conexões configuradas por host e porta. Conexões informadas apenas
por uma URI, assim como arquivos SQLite e DuckDB, não passam por esse túnel. As opções de
TLS e os requisitos de cada mecanismo estão descritos nos [guias dos provedores](docs/providers/README.md).

## Instalação

Há opções com e sem contêiner. Os comandos abaixo seguem a versão em inglês do README;
substitua `<version>` pela versão do arquivo baixado quando necessário.

| Canal | Comando ou download | Observações |
| :--- | :--- | :--- |
| **npx / npm** | `npx @libredb/studio` | Linux, macOS e Windows, com Node.js 24 ou superior. |
| **deb / rpm** | `sudo dpkg -i libredb-studio_<version>_amd64.deb` | Pacotes de servidor nos [Releases](https://github.com/libredb/libredb-studio/releases/latest), com runtime Node.js e serviço systemd. Para RPM, veja o guia de instalação. |
| **AppImage, desktop Linux** | `chmod +x libredb-studio-desktop-<version>-linux-x64.AppImage && ./libredb-studio-desktop-<version>-linux-x64.AppImage` | Janela nativa com servidor local em segundo plano, sem aba do navegador nem tela de login. |
| **Desktop, Debian/Ubuntu** | `sudo apt install ./libredb-studio-desktop-<version>_amd64.deb` | Aplicativo com entrada no menu; é diferente do pacote de servidor. |
| **Snap** | `sudo snap install libredb-studio` | A senha inicial aparece em `sudo snap logs libredb-studio`. |
| **Arquivo tarball do servidor** | [Releases](https://github.com/libredb/libredb-studio/releases/latest) | Distribuição standalone para Linux e macOS; confira o arquivo SHA256SUMS e o [guia de distribuição](docs/DISTRIBUTION.md). |
| **Homebrew** | `brew trust libredb/tap && brew install libredb/tap/libredb-studio` | Homebrew 6 ou superior; a autorização inicial com `brew trust` é obrigatória. |
| **winget, Windows** | `winget install LibreDB.Studio` | Inclui o runtime Node.js. |
| **Docker** | `docker run -p 3000:3000 ghcr.io/libredb/libredb-studio:latest` | A senha inicial aparece no log do contêiner. |
| **Helm, Kubernetes** | `helm install libredb oci://ghcr.io/libredb/charts/libredb-studio` | As credenciais iniciais aparecem no log do Pod. |
| **Flatpak, desktop** | `flatpak --user remote-add --if-not-exists flatpark https://dl.flatpark.org/flatpark.flatpakrepo`<br>`flatpak --user install flatpark org.libredb.Studio` | Aplicativo em sandbox, distribuído pelo FlatPark; acesso a bancos por TCP, sem acesso ao sistema de arquivos. |

Se `brew trust` não for reconhecido, execute `brew update`. Os pacotes deb/rpm de servidor
e os pacotes desktop são distribuições distintas: escolha o servidor para acesso pelo
navegador e o desktop para uma janela local.

Os arquivos standalone usam o nome
`libredb-studio-standalone-<version>-<os>-<arch>.tar.gz`. O comando `npx` pode baixar e
iniciar a distribuição correspondente automaticamente. Para instalação manual, configuração,
uso com systemd e verificação de arquivos, consulte [DISTRIBUTION.md](docs/DISTRIBUTION.md).

Também há modelos de implantação para plataformas como Railway, Dokploy, CapRover, Sealos,
Render, Fly.io e Koyeb. A lista e o estado de cada canal ficam em [CHANNELS.md](docs/CHANNELS.md).

### Incorporar ao seu produto

```bash
npm i @libredb/studio
```

O pacote permite incorporar o editor ao aplicativo que já gerencia os bancos dos seus usuários.
Veja o [guia de integração no README em inglês](README.md#embedding-in-your-own-app-libredbstudio) e confira a
[política de segurança](docs/SECURITY.md) ao configurar a aplicação que o hospeda.

## Segurança

O Studio executa as consultas com as permissões da conexão configurada. Restrinja essas
permissões ao necessário, proteja o acesso à aplicação e use TLS no acesso remoto.
Mascaramento visual, análise de consultas por IA e o modo somente leitura do agente têm
escopos diferentes; nenhum deles transforma todas as consultas do editor em operações
somente leitura.

A [documentação de segurança](docs/SECURITY.md) descreve autenticação, cabeçalhos HTTP,
armazenamento de credenciais e os limites dessas proteções. Para relatar uma vulnerabilidade,
siga [SECURITY.md](SECURITY.md).

## Testes e qualidade

O projeto tem testes unitários, de API, de integração, de hooks, de componentes e E2E.
A CI exige **100% de cobertura de linhas**. Para executar os testes, use os scripts do projeto:

```bash
bun run test
bun run test:coverage
bun run coverage:check
bun run readme:check
```

Use `bun run test`, não o comando direto `bun test`: os testes de componentes dependem
dos grupos isolados configurados pelo projeto. A suíte local também precisa de Helm e da
dependência PostgreSQL do chart; consulte os pré-requisitos em [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentação

Os guias detalhados estão em inglês:

- [Arquitetura](docs/ARCHITECTURE.md) e [API](docs/API_DOCS.md).
- [Provedores de banco de dados](docs/DATABASE_PROVIDERS.md) e [referências por mecanismo](docs/providers/README.md).
- [OIDC](docs/OIDC.md), [armazenamento](docs/STORAGE.md) e [Helm Chart](docs/HELM_CHART.md).
- [Guia do agente](docs/AGENT_GUIDE.md) e [dados enviados aos modelos](docs/AGENT_DATA_FLOW.md).

## Como contribuir

Leia [CONTRIBUTING.md](CONTRIBUTING.md), escolha uma issue e comente nela antes de começar.
Issues, PRs, código e documentação técnica devem ser escritos em inglês; READMEs traduzidos
são a exceção. Relacione o PR à issue e execute as verificações exigidas.

Ao adicionar ou modificar um provedor, mantenha código, documentação e testes de integração
no mesmo PR. O [guia para adicionar provedores](docs/ADDING_A_PROVIDER.md) explica o processo.

## Licença

[MIT](LICENSE), sem CLA. O libredb-platform é o serviço pago de hospedagem, operação
multitenant, cobrança e suporte. Os recursos do Studio permanecem na versão MIT.
