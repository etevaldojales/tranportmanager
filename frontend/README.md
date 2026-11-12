# TransportManager - Frontend (Angular 19 & PrimeNG)

Interface web reativa para solicitação e acompanhamento de corridas em tempo real desenvolvida para o Teste Prático da **Procuradoria-Geral do Estado do Ceará (PGE-CE)**.

---

## 🎨 Funcionalidades

* **Painel do Passageiro / Cliente (`/cliente`):**
  * Seleção de passageiro (mock: `Carlos Silva`, `Mariana Souza`).
  * Formulário de solicitação com validação reativa (origem e destino obrigatórios e distintos).
  * Acompanhamento em tempo real via **ActionCable (WebSocket)**: status atualiza de `PENDENTE` para `EM ANDAMENTO` com dados do motorista assim que aceita, sem necessidade de recarregar a página.
  * Opção para cancelar corrida enquanto estiver pendente.

* **Painel do Motorista (`/motorista`):**
  * Seleção de motorista ativo (mock: `João Pedro`, `Ana Oliveira`).
  * Notificações reativas em tempo real de novas corridas disponíveis assim que solicitadas.
  * Ações de **Aceitar** e **Rejeitar** corridas.
  * Tratamento de concorrência com feedback visual imediato (se outro motorista aceitar simultaneamente, exibe alerta e remove a corrida).

* **Modo Demonstração (Lado a Lado):**
  * Botão na barra de navegação superior que renderiza o painel do Cliente e do Motorista lado a lado na mesma tela, facilitando testes e a gravação do vídeo de avaliação solicitado no edital.

---

## 🚀 Como Executar

### Pré-requisitos
* Node.js (v18+) e NPM instalados.

### 1. Instalar Dependências
```bash
cd frontend
npm install
```

### 2. Iniciar Servidor de Desenvolvimento
```bash
npm start
```
Acesse no navegador: **`http://localhost:4200`**

---

## 🧪 Testes de Interface (Jasmine / Karma)

Para executar a suíte de testes de interface:

```bash
npm test
```

### Cenários Cobertos pelos Testes:
* Validação de campos obrigatórios e rejeição de endereços de partida e destino iguais no formulário do cliente.
* Envio e inscrição correta no canal WebSocket da corrida.
* Recebimento e processamento de aceite de corridas pelo motorista.
* Tratamento de conflito de concorrência (`409 Conflict`), removendo a corrida da lista e exibindo mensagem ao usuário.

---

## 🐳 Executando com Docker

Você também pode rodar o frontend conteinerizado via Nginx:

```bash
docker build -t transport-frontend .
docker run -p 4200:80 transport-frontend
```
