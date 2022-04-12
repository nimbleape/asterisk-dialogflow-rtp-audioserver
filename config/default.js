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
    // used for playing back audio to asterisk
    asterisk: {
        format: 'slin16',
        // size of audio chunks being sent to Asterisk
        audioByteSize: 320,
        // increment in timestamp field between consecutive RTP packets
        packetTimestampIncrement: 160,
        // check https://en.wikipedia.org/wiki/RTP_payload_formats
        rtpPayloadType: 11
    },
    dialogflow: {
        auth: {
            //credentials: {
            //     private_key: response.dialogFlowPrivateKey,
            //     client_email: response.dialogFlowClientEmail
            //   }
            keyFilename: `./path-to-json.json`,
        },
        project: 'project-id',
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