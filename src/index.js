require('dotenv').config();
const WebSocket = require('ws').WebSocket;

class Connection {
    constructor(token) {
        this.token = token;
        this.ws = null;
        this.heartbeatIndex = 0;
        this.heartbeatDelay = 30000;
        this.shouldRun = true;
        this.heartbeatRunning = false;
        this.connected = false;
    }

    async connect() {
        this.ws = new WebSocket('wss://gateway.discord.gg/?encoding=json&v=9');
        this.connected = true;
        this.ws.on('open', () => {
            console.log('connected');
            this.send({
                'op': 2,
                'd': {
                    'token': this.token,
                    'capabilities': 253,
                    'properties': {
                        'os': 'Windows',
                        'browser': 'Chrome',
                        'device': '',
                        'system_locale': 'en-US',
                        'browser_user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.79 Safari/537.36 ',
                        'browser_version': '100.0.4896.79',
                        'os_version': '10',
                        'referrer': '',
                        'referring_domain': '',
                        'referrer_current': '',
                        'referring_domain_current': '',
                        'release_channel': 'stable',
                        'client_build_number': 122739,
                        'client_event_source': null
                    },
                    'presence': {
                        'status': process.env.STATUS,
                        'since': 0,
                        'activities': [],
                        'afk': false
                    },
                    'compress': false,
                    'client_state': {
                        'guild_hashes': {},
                        'highest_last_message_id': '0',
                        'read_state_version': 0,
                        'user_guild_settings_version': -1,
                        'user_settings_version': -1
                    }
                }
            });
            this.sendStatus();

            if (process.env.STATUS_UPDATE) {
                this.statusUpdate();
            }
        });

        this.ws.on('close', (code, reason) => {
            console.log('disconnected:', reason.toString());
            this.heartbeatRunning = false;
            this.connected = false;
            new Connection(this.token).connect();
        });

        this.ws.on('message', (data) => {
            this.heartbeatIndex++;
            const packet = JSON.parse(data.toString());
            //console.log(packet);
            switch (packet.op) {
                case 10:
                    this.heartbeatDelay = packet['d']['heartbeat_interval'];
                    this.shouldRun = true;
                    this.heartbeat();
                    break;
            }
        })
    }

    async heartbeat() {
        if (this.heartbeatRunning) {
            return;
        }

        this.heartbeatRunning = true;
        while (this.shouldRun) {
            this.send({'op': 1, 'd': this.heartbeatIndex + 1});
            await new Promise(resolve => setTimeout(resolve, this.heartbeatDelay - 1000));
        }

        this.heartbeatRunning = false;
    }

    statusUpdate() {
        const con = this;
        setTimeout(() => {
            if (con.connected) {
                this.sendStatus(process.env.STATUS_UPDATE);
                setTimeout(() => {
                    if (con.connected) {
                        this.sendStatus();
                        this.statusUpdate();
                    }
                }, process.env.STATUS_UPDATE_DURATION * 60000);
            }
        }, process.env.STATUS_UPDATE_DELAY * 60000);
    }

    sendStatus(status, tempStatus) {
        if (!status) {
            status = process.env.STATUS;
        }
        console.log(`Changing status to ${status}`);
        const obj = {
            'op': 3,
            'd': {
                'status': status,
                'since': 0,
                'activities': [],
                'afk': false
            }
        };
        if ((!tempStatus || process.env.DISABLE_CUSTOM_STATUS == 'false') && process.env.CUSTOM_STATUS && process.env.CUSTOM_STATUS.length > 0) {
            obj['d']['activities'].push({
                'name': 'Custom Status',
                'type': 4,
                'state': process.env.CUSTOM_STATUS,
                'emoji': null
            });
        }
        this.send(obj);
    }

    send(data) {
        this.ws.send(JSON.stringify(data));
    }
}

const tokens = JSON.parse(process.env.TOKENS);

for (var i = 0; i < tokens.length; i++) {
    new Connection(tokens[i]).connect();
}