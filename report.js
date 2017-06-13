var vapor = require('vapor');
var steamID = require("steamid");
var steamTotp = require('steam-totp');
var csgo = require('csgo');
var fs = require('fs');
var protos = require("./protos/protos.js");

if (!process.argv[3]) {
    console.log("Usage: node report.js [config file] [id]");
    process.exit();
}

// Create our config object
var config = JSON.parse(fs.readFileSync(process.argv[2]));
config.state = "Online";

// Create bot instance
var bot = vapor();

// Initialize bot with our config
bot.init(config);

// Enable plugins we use
bot.use(vapor.plugins.consoleLogger);
bot.use(vapor.plugins.fs);

// Add our custom 2FA-steamguard plugin
if (config["shared_secret"] && config["shared_secret"].length == 28) {
    bot.use({
        name: '2FA-steamguard',
        plugin: function(VaporAPI) {
            VaporAPI.registerHandler({
                emitter: 'vapor',
                event: 'steamGuard'
            }, function(callback) {
                callback(steamTotp.generateAuthCode(config["shared_secret"]));
            });
        }
    });
} else {
    bot.use(vapor.plugins.stdinSteamGuard);
}

// Proto stuff
var ClientHello = 4006;
var ClientWelcome = 4004;

var clientTimeout = null;
var helloMsgInterval = null;

function stop(msg) {
    if (msg)
        console.log(msg);

    clearTimeout(clientTimeout);
    clearInterval(helloMsgInterval);

    bot.disconnect();
}

function decodeMatchId(code) {
    if (code == null) {
        return 8;
    }

    if (!isNaN(parseInt(code))) {
        return parseInt(code);
    }

    if (code.startsWith("steam://")) {
        code = code.substring(61);
    }

    return new csgo.SharecodeDecoder(code).decode().matchId;
}

// Create custom plugin
bot.use({
    name: 'vapor-report',
    plugin: function(VaporAPI) {
        var Steam = VaporAPI.getSteam();
        var client = VaporAPI.getClient();
        var steamUser = VaporAPI.getHandler('steamUser');
        var steamGameCoordinator = new Steam.SteamGameCoordinator(client, 730);
        var clientMessage = { games_played: [ { game_id: 730 } ] };

        VaporAPI.registerHandler({
            emitter: 'vapor',
            event: 'ready'
        }, function() {
            steamUser.gamesPlayed(clientMessage);

            helloMsgInterval = setInterval(function() {
                if (!client.connected)
                    return;

                if (steamGameCoordinator._client._connection == undefined)
                    stop("[INFO] Disconnected: Someone is playing on this account right now");

                steamGameCoordinator.send({
                    msg: ClientHello,
                    proto: { }
                }, new protos.CMsgClientHello({}).toBuffer());
            }, 2000);

            clientTimeout = setTimeout(function() {
                stop("[INFO] Timed out after 15 seconds");
            }, 15000);
        });

        VaporAPI.registerHandler({
            emitter: 'vapor',
            event: 'disconnected'
        }, function(error) {
            clearTimeout(clientTimeout);
            clearInterval(helloMsgInterval);
        });

        steamGameCoordinator.on('message', function(header, buffer, callback) {
            switch (header.msg) {
                case ClientWelcome:
                    clearInterval(helloMsgInterval);
                    console.log("[INFO] Trying to report the user!");

                    steamGameCoordinator.send({
                        msg: protos.ECsgoGCMsg.k_EMsgGCCStrike15_v2_ClientReportPlayer,
                        proto: { }
                    }, new protos.CMsgGCCStrike15_v2_ClientReportPlayer({
                        accountId: new steamID(process.argv[3]).accountid,
                        matchId: decodeMatchId(process.argv[4]),
                        rptAimbot: 2,
                        rptWallhack: 3,
                        rptSpeedhack: 4,
                        rptTeamharm: 5,
                        rptTextabuse: 6,
                        rptVoiceabuse: 7
                    }).toBuffer());
                    break;
                case protos.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchmakingGC2ClientHello:
                    console.log("[INFO] MM Client Hello sent!");
                    break;
                case protos.ECsgoGCMsg.k_EMsgGCCStrike15_v2_ClientReportResponse:
                    stop("[INFO] Report with confirmation ID: " + protos.CMsgGCCStrike15_v2_ClientReportResponse.decode(buffer).confirmationId.toString() + " sent!");
                    break;
                default:
                    console.log(header);
                    break;
            }
        });
    }
});

// Start the bot
bot.connect();

// Handle SIGINT (Ctrl+C) gracefully
process.on('SIGINT', function() {
    stop();
    setTimeout(process.exit, 1000, 0);
});
