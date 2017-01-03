var vapor = require('vapor');
var steamID = require("steamid");
var steamTotp = require('steam-totp');
var fs = require('fs');
var protos = require("./protos/protos.js");

if (!process.argv[3]) {
    console.log("Usage: node commend.js [config file] [id]");
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

// Create custom plugin
bot.use({
    name: 'vapor-commend',
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
                    clearTimeout(clientTimeout);
                    clearInterval(helloMsgInterval);
                    console.log("[INFO] Trying to commend the user!");

                    steamGameCoordinator.send({
                        msg: protos.ECsgoGCMsg.k_EMsgGCCStrike15_v2_ClientCommendPlayer,
                        proto: { }
                    }, new protos.CMsgGCCStrike15_v2_ClientCommendPlayer({
                        accountId: new steamID(process.argv[3]).accountid,
                        matchId: 8,
                        commendation: new protos.PlayerCommendationInfo({
                            cmdFriendly: 1,
                            cmdTeaching: 2,
                            cmdLeader: 4
                        }),
                        tokens: 10
                    }).toBuffer());

                    setTimeout(function() {
                        stop();
                    }, 3000);
                    break;
                case protos.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchmakingGC2ClientHello:
                    console.log("[INFO] MM Client Hello sent!");
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
