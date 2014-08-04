"use strict";

var request = require('request');
var Enumerable = require('linq');
var querystring = require('querystring');

var async = require('async');
var _ = require('underscore');

var Trello = require("node-trello");
var config = require("./config.js");
var Card = require('./model/card.js');

var organization;
var otrsTickets;
var boardNames;
var bothExistingBoards;
var board;

function otrsClientUrl(params) {
    var url = config.otrsBaseAddress.concat("json.pl?User=", config.otrsUser, "&Password=", config.otrsPassword, "&Object=iPhoneObject", params);
    return url;
}

function trelloClientUrl(uri, params) {
    var url = 'https://api.trello.com'.concat(uri).concat('?')
        .concat(params != null ? params : "")
        .concat('&key=' + config.trelloKey)
        .concat('&token=' + config.trelloToken);
    return url;
}

function getTrelloBoards(callback) {
    var url = trelloClientUrl('/1/organizations/' + config.trelloOrganizationName, "boards=all&board_lists=all");
    request.get(url, function (err, httpResponse, body) {
        var res = JSON.parse(body)
        console.info(httpResponse.statusCode + ' ' + httpResponse.req._header);
        callback(err, res);
    });
}

function getOtrsTickets(callback) {
    var url = otrsClientUrl('&Method=StatusView&Data={"Filter":"Open"}'); //Filters open because API rejects 'All'
    request.get(url, function (err, httpResponse, body) {
        console.info(httpResponse.statusCode + ' ' + httpResponse.req._header);
        var result = JSON.parse(body);
        callback(err, result.Data);
    });
}

function addTrelloBoardList(item, listCallback) {
    var url = trelloClientUrl('/1/lists/', querystring.stringify(item));
    request.post(url, {}, function (err, httpResponse, data) {
        console.info(httpResponse.statusCode + ' ' + httpResponse.req._header);
        listCallback(err, data);
    });
}

function UpdateCard(ticket,callback) {
    
    var identifier = ticket.TicketNumber;
    
    var existInboth = Enumerable.from(board.cards)
                        .any(function (x) { return x.name.indexOf(identifier) != -1; });
    
    if (existInboth) {
        //Should update - PUT
        var existing = Enumerable.from(board.cards)
                                    .where(function (x) { return x.name.indexOf(identifier) != -1; })
                                    .first();
        
        var entityToPut = new Card(ticket, existing);
        entityToPut.idList = Enumerable.from(board.lists)
                                    .where(function (x) { return x.name == entityToPut.state; })
                                    .select("$.id")
                                    .first();
        
        var url = trelloClientUrl('/1/cards/' + existing.shortLink, querystring.stringify(entityToPut));
        request.put(url, {}, function optionalCallback(err, httpResponse, body) {
            console.info(httpResponse.statusCode + ' ' + httpResponse.req._header);
            callback();
        })
    } else {
        //Should insert - POST
        var entityToPost = new Card(ticket, {});
        entityToPost.idList = Enumerable.from(board.lists)
                                .where(function (x) { return x.name == entityToPost.state; })
                                .select("$.id")
                                .first();
        
        var url = trelloClientUrl('/1/cards/', querystring.stringify(entityToPost));
        request.post(url, {}, function optionalCallback(err, httpResponse, body) {
            console.info(httpResponse.statusCode + ' ' + httpResponse.req._header);
            callback();
        })
    }
}

function IterateAndUpdateCards(callback) {
    var tickets = Enumerable.from(otrsTickets)
                    .where(function (x) { return x.Queue == board.name; })
                    .toArray();
    
    async.each(tickets, UpdateCard, callback);

}

function FetchCards(callback) {
    
    var url = trelloClientUrl('/1/boards/' + board.id, querystring.stringify({ cards: 'all' }));
    request.get(url , function (err, httpResponse, data) {
        console.info(httpResponse.statusCode + ' ' + httpResponse.req._header);
        board.cards = JSON.parse(data).cards;
        callback();
    });

}

function UpdateLists(callback) {
    
    var ticketStates = Enumerable.from(otrsTickets)
              .where(function (x) { return x.Queue == board.name; })
              .distinct("$.State")
              .select("$.State")
              .toArray();
    
    var listNames = Enumerable.from(board.lists)
              .distinct("$.name")
              .select("$.name")
              .toArray();
    
    var missingLists = Enumerable.from(ticketStates)
              .where(function (x) { return listNames.indexOf(x) < 0; })
              .select(function (x) { return { name : x , idBoard : board.id }; })
              .toArray();
    
    async.each(missingLists, addTrelloBoardList, callback);
}

function UpdateBoard(boardName, callback) {
    board = Enumerable.from(organization.boards)
            .first(function (x) { return x.name == boardName });
    
    async.series([UpdateLists,FetchCards,IterateAndUpdateCards], callback);
}

function IterateBoards(callback) {
    async.eachSeries(bothExistingBoards, UpdateBoard, callback);
}

function FindBoards(callback) {
    
    //Find boards that exist in OTRS queues
    var otrsQueues = Enumerable.from(otrsTickets)
      .distinct("$.Queue")
      .select("$.Queue")
      .toArray();
    
    boardNames = Enumerable.from(organization.boards)
      .distinct("$.name")
      .select("$.name")
      .toArray();
    
    bothExistingBoards = Enumerable.from(boardNames)
      .where(function (x) { return otrsQueues.indexOf(x) > -1; })
      .toArray();
    
    callback();
}

function InitialFetch(callback) {
    //Fetch trello boards (without cards just yet) and otrs tickets in parallel;
    async.parallel([getTrelloBoards,getOtrsTickets], function callbackInitialFetch(err, results) {
        if (err) throw err;
        
        organization = results[0];
        otrsTickets = results[1];
        
        callback();
    });
}

async.series([InitialFetch,FindBoards,IterateBoards]);


