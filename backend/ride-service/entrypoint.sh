#!/bin/bash
set -e

# Remove server.pid potencial
rm -f /app/tmp/pids/server.pid

# Executa migrações no banco
echo "Verificando migrações do banco de dados..."
bundle exec rails db:prepare || bundle exec rails db:create db:migrate

# Inicia o servidor Rails
echo "Iniciando Ride Service na porta 3000..."
exec bundle exec rails server -b 0.0.0.0 -p 3000

