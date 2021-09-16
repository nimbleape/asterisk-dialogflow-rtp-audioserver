module.exports = {
  rtpServer: {
      port: 7777,
      host: '0.0.0.0',
      swap16: true
  },
  mqtt: {
      url: 'mqtt://test.mosquitto.org',
      prefix: 'dialogflow-asterisk'
  },
  dialogflow: {
      apiEndpoint: 'api-endpoint',
      auth: {
          //credentials: {
          //     private_key: response.dialogFlowPrivateKey,
          //     client_email: response.dialogFlowClientEmail
          //   }
          keyFilename: `./path-to-json.json`,
      },
      agentId: 'agent-id',
      project: 'project-id',
      location: 'location',
      initialEventName: 'WELCOME',
      enableOutputSpeech: true,
      audioInputConfig: {
          audioEncoding: 'AUDIO_ENCODING_LINEAR_16',
          sampleRateHertz: 16000,
          languageCode: 'en',
          singleUtterance: false
      },
      audioOutputConfig: {
          audioEncoding: 'OUTPUT_AUDIO_ENCODING_LINEAR_16',
          sampleRateHertz: 8000, // should be the same as dialogFlowAudioInputConfig.sampleRateHertz but Asterisk doesnt like 16000 back
          /*
            comment the below object if you dont want to change any aspects of the generated voice
           */
          synthesizeSpeechConfig: {
              speakingRate: 1,
              pitch: 5,
              volumeGainDb: 0,
              voice: {
                  ssmlGender: `SSML_VOICE_GENDER_FEMALE`
              }
          }
      }
  }
}