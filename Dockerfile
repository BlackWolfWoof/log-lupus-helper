FROM node AS base

WORKDIR /app

COPY . .

RUN rm -rf node_modules && npm i

CMD ["node", "index.js"]