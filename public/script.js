document.write('<script src="http://' + (location.host || 'localhost').split(':')[0] +
':35729/livereload.js?snipver=1"></' + 'script>')


function runTimer(from) {
  $(".timer-inner").css({"width": from / 30 * 100 + '%'});
	$(".timer-inner").stop(true).animate({ "width": '0%' },
  {
    duration: from * 1000,
    queue: false,
    step: function(now, tween) {
      $(".timer-text").text((now / 100 * 30).toFixed(2));
    },
    easing: 'linear'
  });
}

var winQueue = -1;
function resetBar(complete) {
  $(".timer-inner").stop(true).animate({ "width": '98%' },
  {
    duration: 100,
    queue: false,
    step: function(now, tween) {
      $(".timer-text").text((tween.pos*30).toFixed(2));
    },
    complete:complete
  });
}

var drawing = false;

function runDraw(num) {
  if(num > 14) {
    num = num % 14;
  }
  offset = 0;
  oldnum = num;
  if(oldnum > 4) {
    offset = 75;
  }
  if(oldnum > 7) {
    offset=0;
  }
  if(oldnum > 8) {
    num = 16-oldnum;
  }
  if(oldnum > 11) {
    offset = -75;
  }
  if(oldnum == 0) {
    num = 12;
  }
  var x = -(6602 + (num * 150) + (Math.random() * 70) + offset) + $(".item-area").width() / 2;
  $(".item-area").transition({"background-position": x + "px 0px"}, 7000,"cubic-bezier(0,.84,.11,.99)");
  drawing = true;
  setTimeout(function() {
    bet.fill(0)
    updateBets();
    drawing = false;
    if(winQueue != -1) {
      var difference = winQueue - userCredits;
      if(difference > 0) {
        notify("Added " + difference + " to bank!", 0);
      }
      $(".credits").text("Balance: " + winQueue + " credits")
      userCredits = winQueue;
      winQueue = -1;
    }
    $("ul.red").text("");
      $("ul.green").text("");
      $("ul.black").text("");
  }, 7500);
}

function resetDraw() {
  $(".item-area").css({"background-position": $(".item-area").width() / 2 + "px 0px"});
}

function serverMsg(msg) {
  $('.chat-area').append("<div class='serverMsg'><i>" + msg + "</i></div>")
}

var userInfo = null;

var bots = {};

var userCredits = 0;

var bet = [0,0,0];

function updateWithdraw () {
  $('.withdraw-area').text('')
  bots.sort(function (a, b) {
    if (parseInt(a.suggested_price, 10) === parseInt(b.suggested_price, 10)) {
      return 0
    }
    return parseInt(a.suggested_price, 10) > parseInt(b.suggested_price, 10) ? -1 : 1
  })
  bots.forEach(function(item) {
    if(item.market_hash_name.startsWith("StatTrak")) {
      $(".withdraw-area").append("<div class='item tooltip-bottom' data-tooltip='" + item.market_hash_name + "'><div class='withdraw-item' data-asset-id='" + item.item_ids[0] + "'>" + Math.round(item.suggested_price * 1000) + "</div><div class='stattrak'>ST</div><img src='" + item.image + "'></div>")
    } else {
      $(".withdraw-area").append("<div class='item tooltip-bottom' data-tooltip='" + item.market_hash_name + "'><div class='withdraw-item' data-asset-id='" + item.item_ids[0] + "'>" + Math.round(item.suggested_price * 1000) + "</div><img src='" + item.image + "'></div>")
    }
  })
}

function updateInfo() {
  var sum = 0;
  itemsSelected = $(".item.selected .withdraw-item").each(function(item) {
    sum += parseInt($(this).text());
  });
  $(".credits-info").text(sum + " / " + userCredits + " Credits");
}

function updateBets() {
  for(var index = 0; index < 3; index++) {
    $('.player-header[data-id=' + index + '] .player-header-credits').text(bet[index])
  }
}

function notify(text, level) { //0 = success, 1 = info, 2 = warning, 3 = error
  var element = $("<div class='notification " + ["success", "info", "warning", "error"][level] + "'><div class='close'>x</div>" + text + "</div>");
  $(".notifications").prepend(element);
  element.fadeOut(0);
  element.fadeIn(200);
  setTimeout(function() {
    element.fadeOut(200, function() { $(this).remove(); });
  }, 5000);
}

$(function() {

  $(document.body).on("click",".close",function(){
    $(this).parent().fadeOut(200, function() { $(this).remove(); });
  })

  $(document.body).on("click",".item",function(){
    $(this).toggleClass("selected");
    updateInfo();
  })


  $(".withdraw-menu").click(function() {
    if(userInfo) {
      $('.withdraw-container').show().animate({opacity: 1}, 500)
    } else {
      notify("Please login to withdraw!", 3)
    }
  })

  $(".cancel-button").click(function() {
    $('.withdraw-container').animate({opacity: 0}, 500).hide()
    $(".selected").removeClass('selected');
  })

  $(".withdraw-button").click(function() {
    assetIds = [];
    itemsSelected = $(".item.selected .withdraw-item").each(function(item) {
      assetIds.push(parseInt($(this).data("asset-id")));
    });
    socket.emit("withdraw", assetIds);
    $(".selected").removeClass('selected');
    $('.withdraw-container').animate({opacity: 0}, 500).hide()
  })

  $(".circle").click(function(e) {
    original = $(".deposit-form").val() || 0;
    if($(this).text() == "X") {
      $(".deposit-form").val(0)
    } else if ($(this).text() == "x2") {
      $(".deposit-form").val(parseInt(original) * 2)
    } else if ($(this).text() == "1/2") {
      $(".deposit-form").val(parseInt(original) / 2)
    } else {
      $(".deposit-form").val(parseInt(original) + parseInt($(this).text()))
    }
    e.preventDefault();
  });

  $(".player-header").click(function(e){
      e.preventDefault();
      if(!drawing) {
        var msg = $('.deposit-form').val();
        betId = $(this).data("id")
        bet[betId] += parseInt(msg);
        socket.emit("bet", msg, betId);
        console.log("bet", msg, betId)
        notify("Placed bet of " + msg, 0)
        updateBets();
      }
  }); 

  var socket = io.connect();

  socket.on('history', function (history) {
    console.log(history)
    var historyHTML = '';
    history.forEach(function (val) {
      console.log(val)
      if (val === 0) {
        historyHTML += '<div class="circle green">' + val + '</div>';
      } else if (val > 8) {
        historyHTML += '<div class="circle black">' + val + '</div>';
      } else if (val > 0 && val < 8) {
        historyHTML += '<div class="circle red">' + val + '</div>';
      }
    })
    $('.history').html(historyHTML);
  })

  socket.on("connect", function() {
    fetchBotInfo();
    serverMsg("Connected!");
  });

  socket.on("spin", function(num) {
    resetDraw();
    runDraw(num);
  })

  socket.on("bet", function(amount, color, user) {
    console.log(amount, color, user)
    if(color == 0) {
      $("ul.green").append("<li><img class='profile-pic' src='" + user.profilePicture + "'><div class='player-name'>" + user.name + "</div><div class='player-value'>" + amount + "</div></li>")
    }
    if(color == 1) {
      $("ul.red").append("<li><img class='profile-pic' src='" + user.profilePicture + "'><div class='player-name'>" + user.name + "</div><div class='player-value'>" + amount + "</div></li>")
    }
    if(color == 2) {
      $("ul.black").append("<li><img class='profile-pic' src='" + user.profilePicture + "'><div class='player-name'>" + user.name + "</div><div class='player-value'>" + amount + "</div></li>")
    }
  })

  socket.on("resetTimer", function() {
    resetBar();
    runTimer(30);
  })

  socket.on("chat", function(msg) {
    $(".chat-area").append("<div class='chat-bubble'>");
    $(".chat-area").append("<img class='profile-pic' src='" + msg.user.photos[0].value + "'>");
    $(".chat-area").append("<b>" + msg.user.displayName + "</b>");
    $(".chat-area").append("<div class='chat-message'>" + msg.message + "</div>");
    $('.chat-area').scrollTop($('.chat-area')[0].scrollHeight);
  })

  socket.on("updateCredits", function(credits) {
    difference = credits - userCredits;
    if(difference > 0) {
      notify("Added " + difference + " to bank!", 0);
    }
    $(".credits").text("Balance: " + credits + " credits");
    userCredits = credits;
    updateInfo();
  })

  socket.on("win", function(credits) {
    winQueue = credits
  })

  function fetchBotInfo() {
    socket.emit("botInfo");
  }

  socket.on("botInfo", function(res) {
    bots = res;
    console.log(bots)
    updateWithdraw();
  })

  function setTradeURL() {
    swal({
      title: "Trade URL",
      text: "Enter your updated trade url here. You can find your trade url <a target='_blank' href='http://steamcommunity.com/id/julian__/tradeoffers/privacy#trade_offer_access_url'>here</a>.",
      type: "input",
      showCancelButton: true,
      closeOnConfirm: false,
      animation: "slide-from-top",
      inputPlaceholder: "Trade URL...",
      html: true
    }, function(inputValue) {
      if (inputValue === false) return false;
      if (inputValue === "") {
          swal.showInputError("You need to write something!");
          return false
      }
      $(".deposit").attr("href", "https://steamcommunity.com/tradeoffer/new/?partner=104732495&token=pxpVsgJn").attr("target", "_blank");
      swal("Trade URL Set!", "Your trade URL has been successfully set! You can now deposit items.", "success");
      socket.emit("tradeUrl", inputValue)
      $(".deposit").off("click");
    });
  }

  $('.change-url').click(setTradeURL);

  function deposit(info) {
    console.log('ayy')
    if(userInfo) {
      if(info.tradeUrlSet) {
        $(".deposit").attr("href", "https://steamcommunity.com/tradeoffer/new/?partner=291561516&token=h5IhXSLX").attr("target", "_blank");
      } else {
        $(".deposit").click(setTradeURL);
      }
    }
  }

  socket.on("userInfo", function(info) {
    runTimer(info.nextSpin / 1000)
    if(info.success) {
      $(".deposit").off("click")
      $(".glyphicon-log-in").removeClass('glyphicon-log-in').addClass('glyphicon-log-out').parent().attr("href", "/logout")
      userInfo = info.data.user;
      $(".credits").text("Balance: " + info.credits + " credits")
      userCredits = info.credits;
      deposit(info)
    } else {
      $(".credits").text("Not logged in!")
      $(".deposit").click(function() {
        notify("Please login to deposit!", 3)
      })
    }
    updateInfo();
  })

  $(".chat-box").keydown(function(e){
    if (e.keyCode == 13) {
      e.preventDefault();
      var msg = $(this).val();
      $(this).val("");
      socket.emit("chat", msg);
    }
  }); 
  resetDraw();
  resetBar();
})
