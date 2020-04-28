const dgram = require('dgram');
const { EventEmitter } = require('events');
const { PassThrough, Duplex } = require('stream');

/**
 * Duplex stream created with two transform streams
 * - inRStream - inbound side read stream
 * - outWStream - outbound side write stream
 */
class DuplexThrough {
    constructor() {
        this.inRStream = new PassThrough();
        this.outWStream = new PassThrough();
    }

    end() {
        this.inRStream.end();
        this.outWStream.end();
    }
}

// TODO move dgram to await/async promises

class RtpUdpServerSocket extends EventEmitter {
    constructor(opts, log) {
        super();
        this.log = log;
        this.swap16 = opts.swap16 || false;
        this.host = opts.host;
        this.port = opts.port;
        this.streams = new Map();
    }

    bind() {
        this.socket = dgram.createSocket('udp4');

        this.socket.on('error', (err) => {
            this.emit('error', err);
            this.socket.close();
        });

        this.socket.on('message', (msg, rinfo) => {
            /* Strip the 12 byte RTP header */
            let buf = msg.slice(12);
            // Dialogflow wants Uncompressed 16-bit signed little-endian samples (Linear PCM). Asterisk gives it to us in big endian
            if (this.swap16) {
                buf.swap16();
            }
            //this.log.info('got audio');
            this.emit(`data-${rinfo.port}`, buf, rinfo);
        });

        return this.socket.bind({
            port: this.port,
            address: this.host,
            exclusive: false
        });
    }

    createStream(port) {

        const stream = new DuplexThrough();

        this.log.info({ port }, 'Creating a new stream based on source port');

        stream.inRStream.on('close', () => {
            // not sure if this is actually working yet
            this.log.info({ port }, 'removing event listener for data on port as stream finished');
            this.removeAllListeners(`data-${port}`);
        });

        this.log.info(`listening on data-${port} for data`);

        this.once(`data-${port}`, (audio, rinfo) => {
            this.log.info(`Audio Stream started from port ${port}`);

            stream.outWStream.on('data', (audioData) => {
                //this.log.info('sending audio back to asterisk', audioData.length, rinfo.port, rinfo.address);
                this.socket.send(audioData, rinfo.port, rinfo.address);
            });
        });

        this.on(`data-${port}`, (data) => {
            stream.inRStream.write(data);
        });

        this.streams.set(port, stream);

        return stream;
    }

    endStream(port) {
        this.removeAllListeners(`data-${port}`);
        let stream = this.streams.get(port);
        if (stream) {
            stream.end();
            this.streams.delete(port);
        }
    }
}

module.exports = RtpUdpServerSocket;