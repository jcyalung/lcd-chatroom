FROM node:alpine

WORKDIR /lcd-metrics

COPY package.json .

COPY package-lock.json .

RUN npm install

COPY server.js .

EXPOSE 5000

CMD [ "node", "server.js" ]