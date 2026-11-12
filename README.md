# TransportManager - Solução de Corridas em Tempo Real (PGE-CE)

Sistema full-stack para solicitação, aceite, acompanhamento e conclusão de corridas em tempo real (semelhante ao Uber/99), desenvolvido de acordo com os requisitos do desafio técnico da **Procuradoria-Geral do Estado do Ceará (PGE-CE)**. A solução foi arquitetada sob microserviços orientados a eventos com **Ruby on Rails** no backend e **Angular 19** no frontend.

---

## 🏗️ Arquitetura do Sistema

A solução foi projetada em uma arquitetura de microserviços robusta, desacoplada e orientada a eventos em tempo real:

```
[ Frontend: Angular 19 + SCSS + Toast.js ]
                    | (REST & WebSockets)
                    v
       [ API Gateway (Nginx) :8080 ]
          ├── /api/accounts/* ──────────────► [ Account Service (Rails API) :3001 ]
          ├── /api/rides/* ─────────────────► [ Ride Service (Rails API) :3000 ]
          └── /cable (WebSocket) ───────────► [ ActionCable :3000 ]
                                                       │
                       ┌───────────────────────────────┼───────────────────────────────┐
                       ▼                               ▼                               ▼
              [ PostgreSQL :5432 ]            [ Redis :7-alpine ]             [ RabbitMQ :5672 ]
              (Persistência Relacional)       (Lock Atômico & PubSub)         (Fila Assíncrona de Corridas)
```

### Componentes da Arquitetura

1. **API Gateway (`backend/gateway`)**:
   - Proxy reverso baseado em **Nginx** na porta `8080`.
   - Gerencia o roteamento unificado de chamadas REST e o handshake de conexões bi-direcionais **WebSocket** (`/cable`).

2. **Account Service (`backend/account-service`)**:
   - Microserviço Rails API dedicado ao gerenciamento de identidades e perfis (passageiros e motoristas).
   - Fornece endpoints REST como `GET /api/accounts/users` e `GET /api/accounts/users/:id`, retornando dados de motoristas (nome, email e veículo com placa).

3. **Ride Service (`backend/ride-service`)**:
   - Microserviço central de corridas com **ActionCable nativo**.
   - **Comunicação East-West Resiliente com Cache e Fallback:** Validação com o `Account Service` via HTTP (`Faraday`) com timeout curto (3s) para mitigar travamento de threads. Implementa cache distribuído no **Redis** (TTL de 1h) e mecanismo de fallback: se o `Account Service` sofrer indisponibilidade temporária, o sistema continua operando com os perfis em cache ou retorna `503 Service Unavailable` controlado sem gerar falhas em cascata.
   - **Mensageria com RabbitMQ:** Publicação de eventos na fila `rides_queue` via driver oficial `Bunny` para processamento assíncrono por workers.
   - **Tratamento de Concorrência Crítica (Distributed Lock):** Implementação do `AcceptRideService` utilizando lock distribuído atômico no Redis (`SET NX EX` com script de liberação Lua), garantindo que apenas um motorista consiga aceitar uma mesma corrida, retornando `409 Conflict` imediatamente para requisições concorrentes.
   - **Tempo Real com ActionCable:** Notificações em canais dedicados (`DriverRidesChannel` e `ClientRideChannel`).

4. **Frontend SPA (`frontend/`)**:
   - Aplicação em **Angular 19** (*Standalone Components*), **SCSS**, **PrimeIcons** e **Toastify-js**.
   - **Modo Lado a Lado (Demonstração):** Permite simular Cliente e Motorista na mesma janela de forma sincronizada, ideal para a gravação do vídeo de avaliação técnica.
   - **Sincronização Híbrida:** Suporte a WebSockets via ActionCable e sincronização cross-tab via `BroadcastChannel` e `localStorage` (`RideSyncService`).

---

## 🚀 Funcionalidades Implementadas

### 1. Ciclo de Vida Completo da Corrida
- **Solicitação (`PENDING`):** Passageiro escolhe o ponto de partida e destino (com validação de endereços distintos e campos obrigatórios) e solicita a corrida em tempo real.
- **Aceite com Lock Concorrente (`IN_PROGRESS`):** Motorista visualiza a solicitação e clica em "Aceitar". O sistema protege a integridade transacional e vincula o motorista e seu veículo instantaneamente.
- **Cancelamento Bidirecional com Alertas (`CANCELLED`):**
  - Se o **motorista** cancelar, o passageiro recebe alerta visual na interface e notificação Toast: *"Atenção: O motorista cancelou a corrida! Você pode solicitar um novo motorista."*
  - Se o **passageiro** cancelar, o motorista recebe alerta na tela e toast: *"Atenção: O passageiro cancelou a corrida #ID!"*, sendo a corrida removida das disponíveis.
- **Conclusão da Corrida (`COMPLETED`):**
  - O motorista conclui a viagem pelo botão **"Concluir Corrida"**.
  - A interface do passageiro é atualizada automaticamente para `CONCLUÍDA`, exibindo o resumo com o motorista responsável e o veículo que realizou o transporte.

### 2. Painel do Motorista Otimizado
- **Corridas Disponíveis (Sempre no Topo):** Posicionada com máxima prioridade no campo de visão do motorista, exibindo em tempo real apenas solicitações pendentes do **dia atual** com marcação de horário.
- **Minhas Corridas em Andamento:** Card em destaque com a corrida ativa sob controle do motorista logado e ações de *Concluir* e *Cancelar*.
- **Consulta de Corridas por Período e Motorista:**
  - Filtro por data inicial e data final (padrão: data de hoje).
  - Filtro por motorista específico ou "Todos os Motoristas".
  - Filtro por status (`Todos`, `Pendente`, `Em Andamento`, `Concluída`, `Cancelada`).
- **Histórico / Corridas do Período:** Listagem detalhada exibindo identificador da corrida, status estilizado, passageiro, motorista vinculado, dados do veículo e carimbos de data/hora de criação e conclusão.

### 3. Notificações Reativas com Toast.js
- Alertas visuais e reativos integrados através da biblioteca `toastify-js`.
- Mecanismo anti-spam inteligente (debounce) no `ToastService` que previne toasts duplicados ou empilhados indevidamente no modo de demonstração.

---

## 🛠️ Como Executar o Projeto

### Pré-requisitos
* [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/)
* [Node.js](https://nodejs.org/) (versão 18 ou superior) e [npm](https://www.npmjs.com/)

---

### Passo 1: Subir a Infraestrutura e Microsserviços (Backend)

Abra um terminal no diretório raiz do projeto e execute:

```bash
# Entrar no diretório do backend
cd backend

# Construir as imagens e iniciar todos os contêineres
docker compose up --build -d
```

O Docker Compose inicializará com *healthchecks* coordenados na seguinte ordem:
1. `transport_postgres` (PostgreSQL na porta 5432)
2. `transport_redis` (Redis na porta 6379)
3. `transport_rabbitmq` (RabbitMQ nas portas 5672 e 15672)
4. `transport_account_service` (Rails API na porta 3001)
5. `transport_ride_service` (Rails API na porta 3000, com migrations automáticas)
6. `transport_ride_worker` (Worker RabbitMQ em background)
7. `transport_gateway` (Nginx na porta 8080)

Para verificar se todos os serviços estão saudáveis:
```bash
docker compose ps
```

---

### Passo 2: Executar o Frontend (Angular)

Em outro terminal:

```bash
# Entrar no diretório do frontend
cd frontend

# Instalar as dependências do projeto
npm install

# Iniciar o servidor de desenvolvimento
npm start
```

---

### URLs e Portas de Acesso

| Serviço | URL | Descrição |
| :--- | :--- | :--- |
| **Frontend Web** | [http://localhost:4200](http://localhost:4200) | Interface do Usuário (Cliente, Motorista e Modo Lado a Lado) |
| **API Gateway** | [http://localhost:8080](http://localhost:8080) | Ponto de entrada unificado das APIs REST e WebSocket |
| **WebSocket** | `ws://localhost:8080/cable` | Canal ActionCable para comunicação bidirecional em tempo real |
| **RabbitMQ Management** | [http://localhost:15672](http://localhost:15672) | Painel administrativo das filas (login: `guest` / `guest`) |

---

## 🧪 Testes Automatizados

### Testes do Backend (RSpec)

O backend possui suíte abrangente de testes automatizados cobrindo modelos, validações de negócio, comunicação East-West, cancelamento, conclusão e concorrência:

```bash
# Executar testes do Account Service
cd backend/account-service
bundle exec rspec

# Executar testes do Ride Service
cd backend/ride-service
bundle exec rspec
```

*Cenários validados:*
- Validação de endereços de partida e destino iguais ou em branco.
- Comunicação East-West: recusa de corrida com `400 Bad Request` se o passageiro não existir no Account Service.
- Concorrência de motoristas: quando dois motoristas tentam aceitar a mesma corrida simultaneamente, o lock distribuído no Redis garante que o primeiro receba `200 OK` e o segundo receba `409 Conflict`.
- Conclusão e cancelamento com enriquecimento de dados e notificação via WebSocket.

### Testes do Frontend (Angular / Jasmine)

```bash
cd frontend
npm test
```

---

## 📹 Roteiro Sugerido para o Vídeo de Demonstração

Para atender integralmente aos critérios de avaliação da PGE-CE:

1. **Apresentação e Modo Lado a Lado:**
   - Acesse [http://localhost:4200](http://localhost:4200) e clique no botão superior **"Modo Lado a Lado (Demonstração)"**.
   - Mostre o painel do **Passageiro / Cliente** à esquerda e o **Painel do Motorista** à direita na mesma janela.

2. **Solicitação em Tempo Real:**
   - Preencha a origem e o destino no cliente e clique em **"Solicitar Corrida"**.
   - Destaque que a corrida surge **instantaneamente** na lista de **Corridas Disponíveis** do motorista via WebSocket sem nenhum refresh.

3. **Aceite e Bloqueio de Concorrência:**
   - No painel do motorista, clique em **"Aceitar"**.
   - Mostre a corrida saindo das disponíveis e entrando em **"Minhas Corridas em Andamento"** com status `EM ANDAMENTO`.
   - Mostre que o cliente é notificado na hora com o nome e veículo do motorista a caminho.

4. **Conclusão da Corrida:**
   - Clique em **"Concluir Corrida"** no motorista.
   - Demonstre o Toast de confirmação e a tela do cliente atualizando para `CONCLUÍDA`, exibindo o motorista responsável.

5. **Consulta por Período e Motorista:**
   - No painel inferior de consulta, selecione o motorista, o período de datas e clique em **"Pesquisar"**, demonstrando o histórico com identificação completa e status colorido.

6. **Defesa Técnica da Arquitetura:**
   - Justifique a escolha de **Ruby on Rails** (velocidade, robustez e ActionCable nativo integrado).
   - Explique o tratamento de concorrência com **Redis Distributed Lock** atômico (`SET NX EX` + Lua).
   - Apresente a comunicação assíncrona desacoplada via **RabbitMQ**.

---

## 👥 Autoria

Desenvolvido por **Etevaldo Jales** para o Processo Seletivo PGE-CE.
Repositório Oficial: [github.com/etevaldojales/tranportmanager](https://github.com/etevaldojales/tranportmanager)
