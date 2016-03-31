// https://steamcommunity.com/id/devoti

'use strict'

const util = require('util')
const EventEmitter = require('events').EventEmitter
var express = require('express')
var config = require('./config/config')
var glob = require('glob')
var mongoose = require('mongoose')


transactionQueue.on('error', function (error) {
  console.log(error)
})

lr.watch([__dirname + '/public', __dirname + '/app/views'])

var AppEvents = function () {
  EventEmitter.call(this)
}

util.inherits(AppEvents, EventEmitter)

var appEvents = new AppEvents()
appEvents.bitSkins = new TOTP(settings.bitSkinsSecret)

mongoose.connect(config.db)
var db = mongoose.connection
db.on('error', function () {
  throw new Error('unable to connect to database at ' + config.db)
})

var models = glob.sync(config.root + '/app/models/*.js')
models.forEach(function (model) {
  require(model)
})
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)

// io.set('transports', ['xhr-polling', 'jsonp-polling']) // fucking cloudflare

const User = mongoose.model('User')

const threshold = 50

var history = []

for (var i = 0; i < 10; i++) {
  history.push(Math.round(Math.random() * 15))
}

transactionQueue.process(function (job, done) { // type, steamid, credits, success(, othersteamid)
  console.log(job.data)
  if (job.data.type === 0) { // 0 = deposit, 1 = withdraw, 2 = transfer
    User.findOne({steamid: job.data.steamid}, function (err, user) {
      if (err) {
        done(err)
        return
      }
      user.credits += job.data.credits
      user.save(function (err) {
        if (err) {
          done(err)
          return
        }
        if (connectedUsers[user.steamid]) {
          connectedUsers[user.steamid].emit(job.data.socketmsg || 'updateCredits', user.credits)
        }
        done()
      })
    })
  } else if (job.data.type === 1) {
    User.findOne({steamid: job.data.steamid}, function (err, user) {
      if (err) {
        done(err)
        return
      }
      if (user.credits >= job.data.credits) {
        user.credits -= job.data.credits
        user.save(function (err) {
          if (err) {
            done(err)
            return
          }
          if (connectedUsers[user.steamid]) {
            connectedUsers[user.steamid].emit(job.data.socketmsg || 'updateCredits', user.credits)
          }
          if (job.data.color != null) {
            console.log("Bet " + job.data.color + " for " + job.data.credits)
            if (job.data.credits >= threshold) {
              io.emit('bet', job.data.credits, job.data.color, user)
            }
            if (job.data.color === 0) {
              betGreen.push({
                steamid: user.steamid,
                amount: job.data.credits
              })
            } else if (job.data.color === 1) {
              betRed.push({
                steamid: user.steamid,
                amount: job.data.credits
              })
            } else if (job.data.color === 2) {
              betBlack.push({
                steamid: user.steamid,
                amount: job.data.credits
              })
            }
          }
          done()
        })
      } else {
        done("Insufficient credits!");
      }
    })
  } else if (job.data.type === 2) {
    User.findOne({steamid: job.data.steamid}, function (err, user1) {
      if (err) {
        done(err)
        return
      }
      User.findOne({steamid: job.data.othersteamid}, function (err, user2) {
        if (err) {
          done(err)
          return
        }
        if (user1.credits >= job.data.credits) {
          user1.credits -= job.data.credits
          user2.credits += job.data.credits
          user1.save(function (err) {
            if (err) {
              done(err)
              return
            }
            user2.save(function (err) {
              if (err) {
                done(err)
                return
              }
              done()
            })
          })
        } else {
          done("Insufficient credits!");  
        }
      })
    })
  } else {
    done("NOPE");
  }
})
/*
EXAMPLE:

transactionQueue.add({
  type: 0,
  steamid: bet.steamid,
  credits: amount,
  success: function (credits) {
    if (connectedUsers[bet.steamid]) {
      connectedUsers[bet.steamid].emit('updateCredits', credits)
    }
  }
})
*/

// var admins = []

var nextSpin = Date.now() + 30000
setTimeout(spin, 30000)
io.emit('resetTimer')

function resetTimer () {
  io.emit('resetTimer')
}

var betGreen = []
var betRed = []
var betBlack = []

function consolidateBets (bets) {
  var players = {}
  bets.forEach(function (bet) {
    if (players[bet.steamid]) {
      players[bet.steamid] += bet.amount
    } else {
      players[bet.steamid] = bet.amount
    }
  })

  bets = []

  for (var player in players) {
    if (!players.hasOwnProperty(player)) {
      continue
    }
    bets.push({steamid: player, amount: players[player]})
  }
  return bets
}

function spin () {
  var outcome = Math.round(Math.random() * 14)
  betRed = consolidateBets(betRed)
  betGreen = consolidateBets(betGreen)
  betBlack = consolidateBets(betBlack)
  history.shift()
  history.push(outcome)
  setTimeout(function() {
    io.emit('history', history)
  }, 10000)
  if (outcome === 0) {
    betGreen.forEach(function (bet) {
      var amount = 14 * bet.amount
      transactionQueue.add({
        type: 0,
        steamid: bet.steamid,
        credits: amount,
        socketmsg: 'win'
      })
    })
    betRed = []
    betBlack = []
    betGreen = []
  } else if (outcome > 1 && outcome < 8) {
    betRed.forEach(function (bet) {
      var amount = 2 * bet.amount
      transactionQueue.add({
        type: 0,
        steamid: bet.steamid,
        credits: amount,
        socketmsg: 'win'
      })
    })
    betRed = []
    betBlack = []
    betGreen = []
  } else if (outcome > 7 && outcome < 15) {
    betBlack.forEach(function (bet) {
      var amount = 2 * bet.amount
      transactionQueue.add({
        type: 0,
        steamid: bet.steamid,
        credits: amount,
        socketmsg: 'win'
      })
    })
    betRed = []
    betBlack = []
    betGreen = []
  }
  io.emit('spin', outcome)
  nextSpin = Date.now() + 30000
  setTimeout(spin, 32000)
  resetTimer();
}

function getBotInventory (callback) {
  if (botCachedInventory.length === 0 || Date.now() - botCachedTime > 1000) {
    request('https://bitskins.com/api/v1/get_my_inventory?api_key=' + settings.bitSkinsAPI + '&code=' + appEvents.bitSkins.now(), function (err, body, res) {
      if (err) {
        return
      }
      var items = JSON.parse(res).data.steam_inventory.items
      items = _.reject(items, function(item){ return inTrade.indexOf(parseInt(item.item_ids[0])) > -1 });
      // console.log(items)
      callback(items)
      botCachedInventory = items
      botCachedTime = Date.now()
    })
  } else {
    callback(botCachedInventory)
  }
}

var connectedUsers = {}

appEvents.getBotInventory = getBotInventory;

var botCachedInventory = []
var botCachedTime = Date.now()
var inTrade = []

io.on('connection', function (socket) {
  io.emit('history', history)
  if (socket.handshake.session.passport !== undefined && socket.handshake.session.passport.user !== undefined) {
    connectedUsers[socket.handshake.session.passport.user.id] = socket
    User.findOne({steamid: socket.handshake.session.passport.user.id}, function (err, user) {
      if (err) {
        return
      }
      socket.emit('userInfo', {success: 1, data: socket.handshake.session.passport, tradeUrlSet: user.tradeToken, nextSpin: nextSpin - Date.now(), credits: user.credits})
    })
  } else {
    socket.emit('userInfo', {success: 0, data: 'Not logged in!', nextSpin: nextSpin - Date.now()})
  }

  socket.on('chat', function (msg) {
    if (socket.handshake.session.passport !== undefined && socket.handshake.session.passport.user !== undefined) {
      io.emit('chat', {message: msg, user: socket.handshake.session.passport.user})
    }
  })

  socket.on('withdraw', function (items) {
    if (socket.handshake.session.passport === undefined || socket.handshake.session.passport.user === undefined) {
      console.log('not logged in')
      return
    }
    if (items.length === 0) {
      console.log('no items')
      return
    }
    for (var item in items) {
      if (inTrade.indexOf(items[item]) > -1) {
        console.log('skipped')
        return
      }
    }
    getBotInventory(function (inventory) {
      console.log('inv')
      var amount = 0
      items = items.map(function (item) {
        for (var item2index in inventory) {
          var item2 = inventory[item2index]
          if (item2.item_ids[0].indexOf('' + item) !== -1) {
            amount += parseFloat(item2.suggested_price, 10) * 1000
            return {
              'appid': 730,
              'contextid': 2,
              'amount': 1,
              'assetid': '' + item
            }
          }
        }
        console.log("Couldn't find an item")
        return null
      })
      console.log(amount)
      console.log(items)
      var userCallback = function (err, user) {
        if (err) {
          console.log(err)
          return
        }

        if (user.credits >= amount) {
          items.forEach(function (item) {
            inTrade.push(parseInt(item.assetid, 10))
          })
          inTrade.push()
          transactionQueue.add({
            type: 1,
            steamid: user.steamid,
            credits: parseFloat(amount) * 1000,
            socketmsg: 'updateCredits'
          })
          appEvents.emit('sendOffer', user.steamid, user.tradeToken, items, 'ACCEPT THIS OFFER OR THE BOT WILL TAKE YOUR COINS!')
        }
      }
      User.findOne({steamid: socket.handshake.session.passport.user.id}, userCallback)
    })
  })

  socket.on('botInfo', function () {
    getBotInventory(function (inventory) {
      socket.emit('botInfo', inventory)
    })
  })

  socket.on('bet', function (amount, color) { // 0 = green 1 = red 2 = black
    amount = parseInt(amount, 10)
    color = parseInt(color, 10)
    if (socket.handshake.session.passport !== undefined && socket.handshake.session.passport.user !== undefined) {
      transactionQueue.add({
        type: 1,
        steamid: socket.handshake.session.passport.user.id,
        credits: amount,
        socketmsg: 'updateCredits',
        color: color
      })
    }
  })

  socket.on('disconnect', function () {
    if (socket.handshake.session.passport !== undefined && socket.handshake.session.passport.user !== undefined) {
      connectedUsers[socket.handshake.session.passport.user.id] = null
    }
  })

  socket.on('tradeUrl', function (url) {
    if (socket.handshake.session.passport !== undefined && socket.handshake.session.passport.user !== undefined) {
      User.findOneAndUpdate({steamid: socket.handshake.session.passport.user.id}, {tradeToken: url.substr(url.length - 8)}, function (err, user) {
        if (err) {
          console.log(err)
        }
        console.log(user)
      })
    }
  })
})

// STEAM AUTH

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Steam profile is serialized
//   and deserialized.
passport.serializeUser(function (user, done) {
  User.findOne({steamid: user.id}, function (err, record) {
    if (err) {
      console.log(err)
      return
    }
    if (!record) {
      var userObj = new User({
        name: user.displayName,
        steamid: user.id,
        profilePicture: user._json.avatarfull,
        credits: 0
      })
      userObj.save()
    }
  })
  done(null, user)
})

passport.deserializeUser(function (obj, done) {
  done(null, obj)
})

// Use the SteamStrategy within Passport.
//   Strategies in passport require a `validate` function, which accept
//   credentials (in this case, an OpenID identifier and profile), and invoke a
//   callback with a user object.
passport.use(new SteamStrategy({
  returnURL: 'http://skinduel.com:3000/auth/steam/return',
  realm: 'http://skinduel.com:3000/',
  apiKey: '29C1ABCF682442DDCD8207890A2D658D'
}, function (identifier, profile, done) {
  // asynchronous verification, for effect...
  process.nextTick(function () {
    // To keep the example simple, the user's Steam profile is returned to
    // represent the logged-in user.  In a typical application, you would want
    // to associate the Steam account with a user record in your database,
    // and return that user instead.
    profile.identifier = identifier
    return done(null, profile)
  })
}))

// END STEAM AUTH

require('./config/express')(app, config, io)

require('./bot')(appEvents)

appEvents.on('tradeToken', function (user, callback) {
  User.findOne({steamid: user}, function (err, user) {
    if (err || !user) {
      console.log(err)
      return
    }
    callback(user.tradeToken)
  })
})

appEvents.on('deposit', function (data) {
  var items = data.items
  request('http://steamcommunity.com/profiles/' + settings.botSteamId + '/inventory/json/730/2', function (err, response) {
    if (err) {
      console.log(err)
      return
    }
    var bodyJson = JSON.parse(response.body)
    var rgDescriptions = bodyJson.rgDescriptions
    items.forEach(function (item) {
      var itemDesc = rgDescriptions[item.classid + '_' + item.instanceid]

      // TODO: Check if unusual -> get effect -> priceindex
      request.get('http://csgobackpack.net/api/GetItemPrice/?id=' + encodeURIComponent(itemDesc.market_hash_name), function (err, price) {
        if (err) {
          console.log(err)
          return
        }

        // Parse the BP.tf data
        var priceObj = JSON.parse(price.body)
        var latestPrice = parseFloat(priceObj.median_price) * 1000

        transactionQueue.add({
          type: 0,
          steamid: data.owner,
          credits: Math.round(latestPrice),
          socketmsg: 'updateCredits'
        })
      })
    })
  })
})

appEvents.on('updateSent', function (sent) {
  inTrade = sent
})

http.listen(config.port, function () {
  console.log('Express server listening on port ' + config.port)
})
