FROM ruby:3.2-slim

RUN apt-get update -qq && apt-get install -y build-essential libpq-dev curl

WORKDIR /app

COPY Gemfile ./
RUN bundle install

COPY . .

RUN chmod +x /app/bin/rails

EXPOSE 3001

CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0", "-p", "3001"]
