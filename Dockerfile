FROM node:10.16.3 AS build-env

WORKDIR /app
COPY package.json /app/
COPY yarn.lock /app/
RUN npm install --production
COPY . /app

FROM gcr.io/distroless/nodejs
EXPOSE 7777/udp
COPY --from=build-env /app /app
WORKDIR /app
CMD ["index.js"]