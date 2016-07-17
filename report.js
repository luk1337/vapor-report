var vapor = require('vapor');
var steamID = require("steamid");
var fs = require('fs');
var protos = require("./protos/protos.js");

if (!process.argv[3]) {
    console.log("Usage: node report.js [config file] [id...]");
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

if (config["2FA"] && config["2FA"].length == 5) {
    bot.use({
        name: '2FA-steamguard',
        plugin: function(VaporAPI) {
            VaporAPI.registerHandler({
                emitter: 'vapor',
                event: 'steamGuard'
            }, function(callback) {
                callback(config["2FA"]);
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

// Counter
var counter = 0;
var idNum = process.argv.length - 3;

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

            if (steamGameCoordinator) {
                helloMsgInterval = setInterval(function() {
                    steamGameCoordinator.send({
                        msg: ClientHello,
                        proto: { }
                    }, new protos.CMsgClientHello({}).toBuffer());
                }, 2000);
            }

            clientTimeout = setTimeout(function() {
                console.log("[INFO] Timed out: this account has no CS:GO subscribtion?");
                bot.disconnect();
                process.exit();
            }, 10000);
        });

        steamGameCoordinator.on('message', function(header, buffer, callback) {
            switch (header.msg) {
                case ClientWelcome:
                    clearTimeout(clientTimeout);
                    clearInterval(helloMsgInterval);
                    console.log("[INFO] Trying to report the user(s)!");

                    for (i = 0; i < idNum; i++) {
                        setTimeout(function(id) {
                            steamGameCoordinator.send({
                                msg: protos.ECsgoGCMsg.k_EMsgGCCStrike15_v2_ClientReportPlayer,
                                proto: { }
                            }, new protos.CMsgGCCStrike15_v2_ClientReportPlayer({
                                accountId: new steamID(id).accountid,
                                matchId: 8,
                                rptAimbot: 2,
                                rptWallhack: 3,
                                rptSpeedhack: 4,
                                rptTeamharm: 5,
                                rptTextabuse: 6,
                                rptVoiceabuse: 7
                            }).toBuffer());
                        }, i * 1500, process.argv[i + 3]);
                    }
                    break;
                case protos.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchmakingGC2ClientHello:
                    console.log("[INFO] MM Client Hello sent!");
                    break;
                case protos.ECsgoGCMsg.k_EMsgGCCStrike15_v2_ClientReportResponse:
                    console.log("[INFO] Report with confirmation ID: " + protos.CMsgGCCStrike15_v2_ClientReportResponse.decode(buffer).confirmationId.toString() + " sent!");

                    counter++;
                    if (idNum == counter) {
                        bot.disconnect();
                    }
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
    bot.disconnect();
    setTimeout(process.exit, 1000, 0);
});
