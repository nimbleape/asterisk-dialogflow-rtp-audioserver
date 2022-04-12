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

## Working with Different Formats

Dialogflow supports a bunch of formats [reference](https://cloud.google.com/dialogflow/es/docs/reference/rest/v2/projects.agent.environments#outputaudioencoding). This project has been tested to work with Linear PCM (Linear16) and Mu-law.

### Linear PCM

You'll need to ensure formats used by ARI Bridge and RTP Audioserver are in sync. 

##### Changes in rtp-audioserver

Changes in `default.js`

```json
// default.js

asterisk: {
    format: 'slin16',
    audioByteSize: 320,
    packetTimestampDifference: 160,
    rtpPayloadType: 11
},
```

Change Dialogflow Settings,

1. Make sure `audioInputConfig.audioEncoding` and `audioOutputConfig.audioEncoding` are set to `AUDIO_ENCODING_LINEAR_16` and `OUTPUT_AUDIO_ENCODING_LINEAR_16`

##### Changes in ARI Bridge

Make sure the formats defined in the configuration file of ARI Bridge is also using `slin16`.

### Mu-law

Mu-law is headerless single channel audio with a frequency of 8000 hertz and a bit rate of 8-bits. 
##### Changes in rtp-audioserver

Changes in `default.js`

```json
// default.js

asterisk: {
    format: 'ulaw',
    audioByteSize: 160,
    packetTimestampDifference: 160,
    rtpPayloadType: 0
},
```

Change Dialogflow Settings,

1. Make sure `dialogflow.audioInputConfig.audioEncoding` and `dialogflow.audioOutputConfig.audioEncoding` are set to `AUDIO_ENCODING_MULAW` and `OUTPUT_AUDIO_ENCODING_MULAW`
2. Change `dialogflow.audioInputConfig.sampleRateHertz` to 8000.

##### Changes in ARI Bridge

Make sure the formats defined in the configuration file of ARI Bridge is also using `ulaw`.
