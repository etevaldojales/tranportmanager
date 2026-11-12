# TransportManager - Backend (Ruby on Rails)

Repositório do Backend para o Teste Prático da **Procuradoria-Geral do Estado do Ceará (PGE-CE)**.

## 🏛️ Arquitetura do Backend

O backend é composto por microserviços em **Ruby on Rails** orquestrados via **Docker Compose**:

* **API Gateway (`gateway`)**: Nginx na porta `8080`, unificando os microserviços e roteando tráfego HTTP e WebSockets (`/cable`).
* **Account Service (`account-service`)**: Porta `3001`. Fornece dados e perfil de usuários/motoristas mockados (`GET /api/accounts/users/:id`).
* **Ride Service (`ride-service`)**: Porta `3000`. Gerencia o ciclo de vida das corridas:
  * **Comunicação East-West Resiliente:** Valida se o cliente/motorista existe no Account Service via `Faraday` com timeout curto (3s), cache distribuído no **Redis** (1h) e fallback gracioso em caso de downtime.
  * **Concorrência:** Lock atômico distribuído no **Redis** (`SET NX EX 10` e liberação via script Lua) evitando que dois motoristas aceitem a mesma corrida simultaneamente.
  * **Mensageria:** Publica eventos no **RabbitMQ** usando o driver `Bunny`.
  * **Tempo Real:** Notificações instantâneas via **ActionCable** (`DriverRidesChannel` e `ClientRideChannel`).
* **Ride Worker (`ride-worker`)**: Consumidor assíncrono que processa mensagens da fila do RabbitMQ.
* **Infraestrutura:** PostgreSQL 15, Redis 7 e RabbitMQ 3.

---

## 🚀 Como Executar

### Pré-requisitos
* [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/)

### Inicialização
```bash
# Subir todos os serviços com healthcheck automático
docker compose up --build
```

Os serviços estarão disponíveis em:
* **API Gateway:** `http://localhost:8080`
* **Painel RabbitMQ:** `http://localhost:15672` (Usuário: `guest`, Senha: `guest`)
* **Endpoint de Saúde:** `http://localhost:8080/health`

---

## 🧪 Testes Automatizados (RSpec)

Para executar a suite de testes automatizados do backend:

```bash
# Testes do Account Service
cd account-service
bundle exec rspec

# Testes do Ride Service (modelos, requests e testes de concorrência)
cd ../ride-service
bundle exec rspec
```

---

## 📡 Principais Endpoints da API

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/accounts/users` | Lista usuários mockados (filtro opcional `?role=CLIENT` ou `DRIVER`) |
| `GET` | `/api/accounts/users/:id` | Consulta perfil de cliente/motorista |
| `GET` | `/api/rides` | Lista corridas (filtro opcional `?status=PENDING`) |
| `POST` | `/api/rides` | Cria uma nova solicitação de corrida |
| `POST` | `/api/rides/:id/accept` | Aceita a corrida por um motorista com lock atômico |
| `POST` | `/api/rides/:id/cancel` | Cancela uma corrida pendente |
| `WS` | `/cable` | Conexão WebSocket para ActionCable |

