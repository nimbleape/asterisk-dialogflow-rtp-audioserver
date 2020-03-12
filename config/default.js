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
        //credentials: {
        //     private_key: response.dialogFlowPrivateKey,
        //     client_email: response.dialogFlowClientEmail
        //   }
        keyFilename: `./path-to-json.json`,
        project: 'project-id',
        initialEventName: 'WELCOME'
    }
}