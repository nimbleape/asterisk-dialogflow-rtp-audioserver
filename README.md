# Asterisk Dialogflow RTP AudioServer

This application takes UDP audio from Asterisk sent using the External Media application in ARI, and pipes it up to Dialogflow and vice-versa. It takes messaging via MQTT to inform it of a new incoming stream with the associated source port.

Once we have transcription and intent data from Dialogflow we send it over MQTT.

## Requirements

* Node 12+
* Asterisk 16.6 onwards
* [Asterisk-Dialogflow-ARI-Bridge](https://github.com/nimbleape/asterisk-dialogflow-ari-bridge) running elsewhere
* MQTT Server
* Dialogflow credentials

## Install

```
yarn
```

## Run

Set your config settings in `config/default.js` (or `config/production.js` if you're running with `NODE_ENV=production`)

```
yarn start
```

## Logging

This project uses Pino as it's logging library which outputs JSON to the console. You can make this easier ot read using `pino-pretty` or just use the `yarn start-pretty` command.

## Dockerfile

The included Dockerfile is very opinionated. It uses multi stage builds and then uses a "distroless" Node.js image from Google. there's no point exec'ing into it because there's no bash terminal available etc. Use it as Docker should be used :)
