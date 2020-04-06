const dialogflow = require('dialogflow').v2beta1;
const EventEmitter = require('events');
const { Packet } = require('krtp');
const { randomBytes } = require('crypto');
// const fs = require('fs').promises;

class DialogFlowConnector extends EventEmitter {
    constructor(audioConfig, dialogFlowConfig, id, log) {
        super()

        this.id = id;
        this.log = log.child({ id });
        this._closed = false;
        this._dialogFlowProjectId = dialogFlowConfig.projectId;
        this._dialogFlowSessionId = dialogFlowConfig.sessionId;
        this._initialEventName = dialogFlowConfig.initialEventName;
        this._enableDialogflowOutputSpeech = dialogFlowConfig.enableOutputSpeech;
        this._sampleRate = audioConfig.input.sampleRateHertz;
        this._languageCode = audioConfig.input.languageCode;

        this._dialogFlowClient = new dialogflow.SessionsClient(dialogFlowConfig.auth);
        this._dialogFlowPath = this._dialogFlowClient.sessionPath(this._dialogFlowProjectId, this._dialogFlowSessionId);
        this._numOfStreamCycles = 0;

        this._initialStreamRequest = {
            session: this._dialogFlowPath,
            queryInput: {
                audioConfig: audioConfig.input,
            }
        };

        if (this._enableDialogflowOutputSpeech) {
            this._initialStreamRequest.outputAudioConfig = audioConfig.output
        }

        // create the dialog flow bi-directional stream
        this._createNewDialogFlowStream();
    }

    /*
        the closing of the write portion
        of the stream is a signal to DialogFlow that we're waiting
        on their response and we're done sending data
    */
    _halfCloseDialogFlowStream() {
        this.log.info('Ending the writable stream to DialogFlow');
        this._dialogFlowStream.end();
    }

    _createNewDialogFlowStream() {

        if (this._closed) {
            this.log.info('Requested a new Dialogflow even though we closed the connector');
            return;
        }

        this.log.info('Creating new Dialogflow stream');
        this._numOfStreamCycles++;

        // create a reference to the old one so we can close it later
        const oldStream = this._dialogFlowStream;

        this._dialogFlowStream = this._dialogFlowClient.streamingDetectIntent()
        .on('error', err => {
            this.log.error({ err }, 'Got an error from dialogflow');
        })
        .on('finish', () => {
            this.log.info('Dialogflow stream closed');
        })
        .on('data', (data) => {
            this.log.info({ data }, 'got data from dialogflow');

            // if we got a transcript or intent result send to the dataUri
            if (data.recognitionResult || data.queryResult) {
                this._sendDataToApp(data);
            }

            // if we got the output audio then send it back to asterisk (streamingDetectIntent)
            if (data.outputAudio && data.outputAudio.length !== 0) {
                this._sendAudioToAsterisk(data);


                // we got the audio, so now we need to restart the dialogflow stream
                if (this._dialogFlowClient.writableEnded) {
                    this._createNewDialogFlowStream();
                }
            }

            // if we got the query result and we asked for no audio back
            if (!this._enableDialogflowOutputSpeech && data.queryResult) {
                // we got the intent result, so now we need to restart the dialogflow stream
                if (this._dialogFlowClient.writableEnded && data.queryResult.intent && !data.queryResult.intent.endInteraction) {
                    this._createNewDialogFlowStream();
                }
            }

            /*
             * use getting the 'final' transcript as a sign we should
             * half close our connection to DialogFlow so that they'll
             * send us intent data
            */
            if (data.recognitionResult && data.recognitionResult.isFinal) {
                this._halfCloseDialogFlowStream();
            }

        });

        let tmpInitialStreamRequest = null;
        if (this._numOfStreamCycles === 1 && this._initialEventName) {
            //make a copy of the initialStreamRequest so we can make changes to it if we need to
            tmpInitialStreamRequest = JSON.parse(JSON.stringify(this._initialStreamRequest));

            tmpInitialStreamRequest.queryInput.event = {
                name: this._initialEventName,
                languageCode: this._languageCode
            };

        }

        // we've created the stream, now send the config down it
        if (this._dialogFlowStream && this._dialogFlowStream.writable) {
            try {
                this._dialogFlowStream.write(tmpInitialStreamRequest || this._initialStreamRequest);
            } catch (err) {
                //because dialogflow is shit and errors
            }
        }

        /*
        Setup a timer so that in 59 seconds we recreate the stream
        However that would mean someone had been talking with no
        response from DialogFlow which is incredibly unlikely
        */
        this._setupTimer();

        // if we have an old stream (ie we replaced it) then destroy it
        if (oldStream) {
            this.log.info('Destroying old DialogFlow stream');
            oldStream.destroy();
        }
    }

    _sendAudioToAsterisk(dialogFlowData) {
        this.log.info('Got audio to play back from dialogflow');

        let config = dialogFlowData.outputAudioConfig || dialogFlowData.replyAudio.config;
        let audio = dialogFlowData.outputAudio || dialogFlowData.replyAudio.audio;

        // fs.writeFile(`${this.id}.wav`, audio, 'binary');

        // if the audio length is more than 320 or 640 bytes then we need to split it up
        let audioByteSize = 320; //320 for 8k and 640 for 16k

        /*
        remove the Wav header dialogflow adds to the response
        oh and swap16 it so its big endian (dialogflow gives it back as little endian)
        */
        let replyAudio = audio.slice(44).swap16();

        // fs.writeFile(`${this.id}.sln`, audio.slice(42), 'binary');

        let frames = replyAudio.length / audioByteSize;
        let pos = 0;
        let type = 11;
        let seq = randomBytes(2).readUInt16BE(0);
        let ssrc = randomBytes(4).readUInt32BE(0);
        let timestamp = 0;

        let timeouts = [];

        for (let i = 0; i < frames+1; i++) {
            timeouts.push(setTimeout(() => {
                let newpos = pos + audioByteSize;
                let buf = replyAudio.slice(pos, newpos);

                timestamp = timestamp !== 0 ? timestamp : Date.now() / 1000;

                let packet = new Packet(buf, seq, ssrc, timestamp, type);
                seq++;
                timestamp += buf.length / 2;

                try {
                    this._asteriskAudioStream.outWStream.write(packet.serialize());
                } catch (err) {
                    timeouts.forEach((ref) => {
                        clearTimeout(ref);
                    });
                }
                pos = newpos
            }, i * 20));
        }
    }

    _sendDataToApp(dialogFlowData) {

        let body = {
            transcript: null,
            intent: null
        }

        if (dialogFlowData.recognitionResult) {
            this.log.info({ transcript: dialogFlowData.recognitionResult.transcript }, 'Intermediate transcript')
            body.transcript = dialogFlowData.recognitionResult
        } else {
            this.log.info({ intent: dialogFlowData.queryResult }, 'Detected intent');
            body.intent = dialogFlowData.queryResult
        }
        this.log.info({ body }, 'Dialogflow data');
        this.emit('message', body);
    }

    _setupTimer() {
        // every 59 seconds go make a new stream
        clearTimeout(this._timeoutRef);
        this.log.info('Setting up DialogFlow stream timer');
        this._timeoutRef = setTimeout(() => {
            this.log.info('59 Seconds has elapsed, re-starting DialogFlow stream');
            this._createNewDialogFlowStream();
        }, 59000);
    }

    close() {
        this.log.info('Asterisk Stream closed so closing connection to DialogFlow and doing tidy up');
        this._closed = true;
        clearTimeout(this._timeoutRef);

        this.log.info('Destroying DialogFlow stream');
        if (this._dialogFlowStream) {
            this._dialogFlowStream.destroy();
        }
    }

    _receivedAudioMessage(audio) {
        //this.log.info('is the dialogflow stream writeable?', this._dialogFlowStream);
        if (this._dialogFlowStream && this._dialogFlowStream.writable) {
            try {
                //this.log.info('Writing Audio to Dialogflow');
                this._dialogFlowStream.write({ inputAudio: audio });
            } catch(err) {
                //because dialogflow can be shit and say its writeable but its not
            }

            // For dev purposes - recording the audio we're sent from asterisk
            // this._audioFileStream.write(audio)
        }
    }

    start(stream) {
        //pipe the audio through!
        this._asteriskAudioStream = stream;
        stream.inRStream.on('data', (audio) => {
            this._receivedAudioMessage(audio);
        });
    }

}

module.exports = DialogFlowConnector;