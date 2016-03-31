var fs = require('fs')
var util = require('util')
var request = require('request')
var readline = require('readline')
var _ = require("underscore")

var SteamTradeOffers = require('steam-tradeoffers')
var getSteamAPIKey = require('steam-web-api-key')
var SteamTotp = require('steam-totp')
var SteamCommunity = require('steamcommunity')
var bot = new SteamUser()
var steamTrade = new SteamTradeOffers()
var community = new SteamCommunity()

// Automatically generate code
bot.options.promptSteamGuardCode = false

var totp = null

var totpEnabled = false
if (fs.existsSync(params.username + '.2fa')) {
  totpEnabled = true
  totp = JSON.parse(fs.readFileSync(params.username + '.2fa'))
}

// Logging in with supplied info
var logOnInfo = {
  accountName: params.username,
  password: params.password
}

bot.logOn(logOnInfo)

console.log('Logging into trade confirmations')

function communityLogon () {
  community.login({
    'accountName': params.username,
    'password': params.password,
    'twoFactorCode': SteamTotp.generateAuthCode(totp.shared_secret)
  }, function (err) {
    if (err) {
      console.log(err)
      return
    }
    console.log('checking for confirmations...')
    community.startConfirmationChecker(2000, totp.identity_secret)
  })
}

community.on('newConfirmation', function (confirmation) {
  console.log(confirmation)
})

setTimeout(communityLogon, 35000)

function generateCodes () {
  console.log('New Auth Code: ' + SteamTotp.generateAuthCode(totp.shared_secret))
}
setInterval(generateCodes, 30000)

bot.on('webSession', function (sessID, cookie) {
  getSteamAPIKey({
    sessionID: sessID,
    webCookie: cookie
  }, function (err, APIKey) {
    if (err) {
      console.log(err)
      return
    }
    steamTrade.setup({
      sessionID: sessID,
      webCookie: cookie,
      APIKey: APIKey
    }, function () {
      handleTradeOffers()
      setInterval(function () {
        getActiveSentOffers(function (sent) {
          events.emit('updateSent', sent)
        })
      }, 1000)
    })
    if (!totpEnabled) {
      bot.enableTwoFactor(function (res) {
        fs.writeFile(params.username + '.2fa', JSON.stringify(res))
        totpEnabled = true
        totp = res
        rl.question('SMS Code: ', function (answer) {
          bot.finalizeTwoFactor(totp.shared_secret, answer, function (error) {
            if (error) {
              console.log(error)
            } else {
              console.log('success!')
              process.exit()
            }
          })
          rl.close()
        })
      })
    }
  })
})

bot.on('steamGuard', function (domain, callback) {
  if (!domain && !totpEnabled) {
    console.log('Steam auth already enabled on account! Need 2fa file!')
  }
  if (!domain && totpEnabled) {
    var code = SteamTotp.generateAuthCode(totp.shared_secret)
    console.log('Using code: ' + SteamTotp.generateAuthCode(totp.shared_secret))
    callback(code)
  }
  if (domain && !totpEnabled) {
    console.log('Enabling 2-factor-auth')
  }
  if (domain) {
    console.log('Email confirmations enabled!')
  }
})

bot.on('friend', function (other, type) {
  if (type === Steam.EFriendRelationship.PendingInvitee) {
    console.log('Added friend!')
    bot.addFriend(other)
  }
})

bot.on('loggedOn', function (res) {
  console.log('Successfully logged in!')
  bot.setPersona(Steam.EPersonaState.LookingToTrade)
  bot.gamesPlayed(params.siteName)
  bot.getSteamGuardDetails(function (enabled, enabledTime, machineTime, canTrade) {
    if (enabled) {
      console.log('Steam guard has been enabled for ' + (new Date() - new Date(machineTime)) / 86400000 + ' days!')
      if (canTrade) {
        console.log('This device can trade!')
      } else {
        console.log("This device can't trade!")
      }
    } else {
      console.log('Steam guard is not enabled!!')
    }
  })
})

bot.on('error', function (error) {
  console.log('Caught Steam error', error)
})

bot.on('loggedOff', function () {
  console.log('Logged off!')
  bot.logOn(logOnInfo)
})

bot.on('tradeOffers', function (number) {
  if (number > 0) {
    handleTradeOffers()
  }
})

bot.on('friendRelationship', function (other, type) {
  if (type === Steam.EFriendRelationship.RequestRecipient) {
    console.log('Adding friend ' + other)
    bot.addFriend(other)
  }
})

function sendTradeOffer (steamId, tradeToken, items, msg) {
  console.log({
    partnerSteamId: steamId,
    accessToken: tradeToken,
    itemsFromThem: [],
    itemsFromMe: items,
    message: msg
  })
  steamTrade.makeOffer({
    partnerSteamId: steamId,
    accessToken: tradeToken,
    itemsFromThem: [],
    itemsFromMe: items,
    message: msg
  }, function (err, response) {
    if (err === 'Error: There was an error sending your trade offer.  Please try again later. (15)') {
      console.log('Inventory is full. Canceling offer!')
      return
    }
    if (err) {
      console.log('Error! Retrying in 2 seconds...')
      console.log(util.inspect(err))
      setTimeout(function () {
        sendTradeOffer(steamId, tradeToken, items, msg)
      }, 2000)
    } else {
      console.log('Sent Trade Offer!')
    }
  })
}

function getHoldDuration (params, callback) {
  steamTrade.getHoldDuration(params, function (err, data) {
    if (err || data === undefined) {
      console.log('Error fetching escrow. This is usually caused by a lack of trade URL.')
      callback('escrow', null)
    } else {
      callback(null, data)
    }
  })
}

function verifyOffer(offer, callback) {
  var shouldAccept = true
  if (offer.items_to_give !== undefined && params.admins.indexOf(offer.steamid_other) === -1) {
    console.log('Declined trade because user wanted items!')
    shouldAccept = false
  }
  if (offer.items_to_receive) {
    offer.items_to_receive.forEach(function (item) {
      if (item.appid !== '730') {
        console.log('Declined trade because an item was not for CS:GO!')
        console.log('App ID: ' + item.appid)
        shouldAccept = false
      }
    }, this)
  }

  if (offer.items_to_receive && offer.items_to_receive.length > 10) {
    console.log('Declined trade because of over 10 items!')
    console.log('# of Items: ' + offer.items_to_receive.length)
    shouldAccept = false
  }
  if (params.admins.indexOf(offer.steamid_other) > -1 && offer.items_to_receive === undefined) {
    console.log('Admin withdraw attempt')
  }
  if(shouldAccept) {
    request('http://steamcommunity.com/profiles/' + offer.steamid_other + '/inventory/json/730/2', function(err, res, body) {
      var items = [];
      body = JSON.parse(body);
      var toGo = offer.items_to_receive.length;
      offer.items_to_receive.forEach(function(item) {
        var classid = body.rgInventory[item.assetid].classid;
        var instanceid = body.rgInventory[item.assetid].instanceid;
        var item = body.rgDescriptions[classid + '_' + instanceid];
        if(item.market_hash_name.indexOf("Souvenir") != -1 || item.market_hash_name.indexOf("Music") != -1) {
          console.log("Souvenir or Music Kit! Declining...")
          callback(false)
          return;
        }
        request('http://csgobackpack.net/api/GetItemPrice/?id=' + encodeURIComponent(item.market_hash_name) + '&time=1', function(err, res, body) {
          body = JSON.parse(body)
          if(body.amount_sold <= 30) {
            console.log("too rare");
            callback(false);
            return
          }
          if(body.median_price < 0.5) {
            console.log("too cheap")
            callback(false)
            return
          }
          toGo -= 1;
          if(toGo <= 0) {
            console.log("yep")
            callback(true);
          }
        })
      })
    })
  }
}

function getOffers() {
  return new Promise(function(fulfill, reject) {
    steamTrade.getOffers({
      get_received_offers: 1,
      active_only: 1
    }, function (err, body) {
      if(err) {
        reject(err);
      } else {
        fulfill(body);
      }
    })
  })
}

function getActiveSentOffers (callback) {
  steamTrade.getOffers({
    get_sent_offers: 1,
    active_only: 1
  }, function (err, body) {
    if (err) {
      callback("SENT:" + err)
      return
    }
    var itemsInTrade = []
    if(body.response.trade_offers_sent) {
      body.response.trade_offers_sent.forEach(function (offer) {
        if(offer.items_to_give) {
	  offer.items_to_give.forEach(function (item) {
            itemsInTrade.push(parseInt(item.assetid, 10))
          })
	}
      })
      callback(itemsInTrade)
    } else {
      callback([])
    }
  })
}

function verifyOffers(body) {
  return new Promise(function(fulfill, reject) {
    if (body.response.trade_offers_received != undefined) {
      body.response.trade_offers_received.forEach(function (offer) {
        if (offer.trade_offer_state === 2) {
          console.log('Steam trade request...')

          if (params.admins.indexOf(offer.steamid_other) > -1 && offer.items_to_receive === undefined) {
            console.log('Admin withdraw attempt')
            steamTrade.acceptOffer({
              tradeOfferId: offer.tradeofferid
            })
            return;
          }
          verifyOffer(offer, function(result) {
            if(result == false) {
              steamTrade.declineOffer({
                tradeOfferId: offer.tradeofferid
              })
              return;
            }
            console.log('Offer verified! Checking for escrow...')
            events.emit("tradeToken", offer.steamid_other, function(token) {
              steamTrade.getHoldDuration({
                partnerSteamId: offer.steamid_other,
                accessToken: token
              }, function (err, data) {
                if (err || data === undefined) {
                  steamTrade.declineOffer({
                    tradeOfferId: offer.tradeofferid
                  })
                  reject(err)
                  return
                }
                if (data.my > 0) {
                  console.log('Bot is trade banned from mobile!')
                  steamTrade.declineOffer({
                    tradeOfferId: offer.tradeofferid
                  })
                  reject('Bot is trade banned!')
                  return
                }
                if (data.their > 0) {
                  steamTrade.declineOffer({
                    tradeOfferId: offer.tradeofferid
                  })
                  reject('Other player is trade banned from mobile!')
                  return
                }
                if (data.my === 0 && data.their === 0) {
                  console.log('Successfully verified escrow!')
                  steamTrade.acceptOffer({
                    tradeOfferId: offer.tradeofferid
                  }, function (err) {
                    if (err) {
                      reject('Duping offers!');
                      return
                    }
                    fulfill({
                      items: offer.items_to_receive,
                      owner: offer.steamid_other
                    });
                  })
                }
              })
            })
          })    
        }
      })
    }
  });
}


function handleTradeOffers () {
  getOffers()
    .then(verifyOffers)
    .catch(console.log)
    .then(data => events.emit('deposit', data));
  
}

module.exports = function (app) {
  events = app
  events.on('sendOffer', sendTradeOffer)
}
