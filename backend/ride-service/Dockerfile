FROM ruby:3.2-slim

RUN apt-get update -qq && apt-get install -y build-essential libpq-dev curl

WORKDIR /app

COPY Gemfile ./
RUN bundle install

COPY . .

RUN chmod +x /app/entrypoint.sh /app/bin/rails

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
